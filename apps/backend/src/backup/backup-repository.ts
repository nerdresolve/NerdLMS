import { TABELAS_DO_BACKUP, type TabelaDoBackup } from "@nerdlms/core/backup/manifest.ts";
import type { ColunaDeReferencia } from "@nerdlms/core/backup/remissao.ts";

import { query } from "../db/pool.ts";

/**
 * Leitura do banco para o backup — F5-06.
 *
 * O desafio: cada tabela se liga ao cliente de um jeito. `users` tem
 * `tenant_id`; `lessons` pertence a um módulo, que pertence a um curso, que
 * tem `tenant_id`. O recorte de uma precisa atravessar três tabelas.
 *
 * A alternativa seria uma consulta escrita à mão por tabela — 46 consultas,
 * cada uma uma chance de esquecer o recorte e levar dado de outro cliente. Aqui
 * o recorte é DERIVADO do vínculo declarado no manifesto, e o vínculo é uma
 * decisão que se lê num lugar só.
 */

/**
 * O `WHERE` que recorta a tabela para um cliente.
 *
 * Sempre por subconsulta ancorada em `tenant_id`, nunca por junção solta: uma
 * tabela sem recorte aqui vira dado de outro cliente dentro do arquivo — e
 * dentro do cliente que restaurar.
 */
function recorteDoTenant(tabela: TabelaDoBackup): string {
  switch (tabela.vinculo) {
    case "tenant":
      return `t.tenant_id = $1`;

    case "curso":
      return `t.${tabela.chave} IN (SELECT id FROM courses WHERE tenant_id = $1)`;

    case "modulo":
      return `t.${tabela.chave} IN (
        SELECT m.id FROM modules m
          JOIN courses c ON c.id = m.course_id
         WHERE c.tenant_id = $1)`;

    case "aula":
      return `t.${tabela.chave} IN (
        SELECT l.id FROM lessons l
          JOIN modules m ON m.id = l.module_id
          JOIN courses c ON c.id = m.course_id
         WHERE c.tenant_id = $1)`;

    case "matricula":
      return `t.${tabela.chave} IN (
        SELECT e.id FROM enrollments e
          JOIN courses c ON c.id = e.course_id
         WHERE c.tenant_id = $1)`;

    case "pessoa":
      return `t.${tabela.chave} IN (SELECT id FROM users WHERE tenant_id = $1)`;

    case "questao":
      return `t.${tabela.chave} IN (SELECT id FROM questions WHERE tenant_id = $1)`;

    case "prova":
      return `t.${tabela.chave} IN (SELECT id FROM quizzes WHERE tenant_id = $1)`;

    case "trabalho":
      return `t.${tabela.chave} IN (
        SELECT s.id FROM submissions s
          JOIN enrollments e ON e.id = s.enrollment_id
          JOIN courses c ON c.id = e.course_id
         WHERE c.tenant_id = $1)`;

    case "rubrica":
      return `t.${tabela.chave} IN (SELECT id FROM rubrics WHERE tenant_id = $1)`;

    case "tentativa":
      /* `quiz_answers` aponta para `quiz_attempts`; `scorm_interactions` para
         `scorm_tracking`. As duas chegam ao cliente pela matrícula. */
      return `t.${tabela.chave} IN (
        SELECT a.id FROM ${tabela.nome === "quiz_answers" ? "quiz_attempts" : "scorm_tracking"} a
          JOIN enrollments e ON e.id = a.enrollment_id
          JOIN courses c ON c.id = e.course_id
         WHERE c.tenant_id = $1)`;

    case "topico":
      return `t.${tabela.chave} IN (
        SELECT ${tabela.nome === "forum_attachments" ? "p.id FROM forum_posts p JOIN forum_topics ft ON ft.id = p.topic_id WHERE ft.tenant_id = $1" : "id FROM forum_topics WHERE tenant_id = $1"})`;

    case "comentario":
      return `t.${tabela.chave} IN (
        SELECT cm.id FROM comments cm
          JOIN lessons l ON l.id = cm.lesson_id
          JOIN modules m ON m.id = l.module_id
          JOIN courses c ON c.id = m.course_id
         WHERE c.tenant_id = $1)`;

    case "trilha":
      return `t.${tabela.chave} IN (SELECT id FROM tracks WHERE tenant_id = $1)`;

    case "turma":
      return `t.${tabela.chave} IN (SELECT id FROM course_classes WHERE tenant_id = $1)`;

    case "webhook":
      return `t.${tabela.chave} IN (SELECT id FROM webhooks WHERE tenant_id = $1)`;
  }
}

export interface ColunaDaTabela {
  nome: string;
  /**
   * `jsonb` precisa voltar como TEXTO no INSERT.
   *
   * O driver entrega jsonb já parseado — vira objeto JavaScript. Devolvê-lo
   * como parâmetro faz o driver chamar `toString()` nele, e o Postgres recebe
   * "[object Object]": `invalid input syntax for type json`. Foi exatamente o
   * que quebrou a primeira restauração, em `quiz_answers.response`.
   */
  json: boolean;
  /**
   * `GENERATED ALWAYS AS IDENTITY` — o banco recusa valor explícito.
   *
   * `audit_log.id` é assim. Mandá-lo no INSERT devolve "cannot insert a
   * non-DEFAULT value into column id" e derruba a restauração inteira. A coluna
   * é omitida e o banco gera o próximo valor: o id novo é diferente do antigo,
   * o que não importa — o que se restaura de uma auditoria é o REGISTRO, e nada
   * aponta para o id dela.
   */
  identidadeSempre: boolean;
}

/** As colunas da tabela, com o que decide como cada valor volta. */
export async function colunasDe(tabela: string): Promise<ColunaDaTabela[]> {
  const rows = await query<{
    column_name: string;
    data_type: string;
    is_identity: string;
    identity_generation: string | null;
  }>(
    `SELECT column_name, data_type, is_identity, identity_generation
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [tabela],
  );

  return rows.map((row) => ({
    nome: row.column_name,
    json: row.data_type === "json" || row.data_type === "jsonb",
    identidadeSempre: row.is_identity === "YES" && row.identity_generation === "ALWAYS",
  }));
}

/**
 * Lê uma tabela inteira, recortada pelo cliente.
 *
 * O nome da tabela vem do MANIFESTO, nunca de entrada externa: ele é
 * interpolado na consulta — o Postgres não aceita nome de tabela como
 * parâmetro —, e interpolar algo que veio de fora seria injeção de SQL. O
 * `tenantId` continua parametrizado.
 */
export async function lerTabela(
  tabela: TabelaDoBackup,
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  return query<Record<string, unknown>>(
    `SELECT t.* FROM ${tabela.nome} t WHERE ${recorteDoTenant(tabela)}`,
    [tenantId],
  );
}

/**
 * Lê a tabela recortada por UM curso.
 *
 * Usada no backup de curso — migrar um curso de um cliente para outro, que o
 * guia §24 pede. Só as tabelas marcadas com `noBackupDeCurso` passam por aqui.
 */
export async function lerTabelaDoCurso(
  tabela: TabelaDoBackup,
  tenantId: string,
  courseId: string,
): Promise<Array<Record<string, unknown>>> {
  const recorte = recorteDeCurso(tabela);
  if (!recorte) return [];

  return query<Record<string, unknown>>(
    `SELECT t.* FROM ${tabela.nome} t WHERE ${recorte}`,
    [tenantId, courseId],
  );
}

/** O `WHERE` que recorta a tabela para um curso. `$2` é o curso. */
function recorteDeCurso(tabela: TabelaDoBackup): string | null {
  switch (tabela.nome) {
    case "courses":
      return `t.id = $2 AND t.tenant_id = $1`;

    case "modules":
      return `t.course_id = $2`;

    case "lessons":
      return `t.module_id IN (SELECT id FROM modules WHERE course_id = $2)`;

    case "materials":
      return `t.lesson_id IN (
        SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id
         WHERE m.course_id = $2)`;

    case "course_tags":
      return `t.course_id = $2`;

    case "course_classes":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    case "unlock_rules":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    case "questions":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    case "question_options":
      return `t.question_id IN (SELECT id FROM questions WHERE course_id = $2 AND tenant_id = $1)`;

    case "question_tags":
      return `t.question_id IN (SELECT id FROM questions WHERE course_id = $2 AND tenant_id = $1)`;

    case "question_categories":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    case "quizzes":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    case "quiz_questions":
      return `t.quiz_id IN (SELECT id FROM quizzes WHERE course_id = $2 AND tenant_id = $1)`;

    case "assignments":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    case "rubrics":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    case "rubric_criteria":
      return `t.rubric_id IN (SELECT id FROM rubrics WHERE course_id = $2 AND tenant_id = $1)`;

    case "scorm_packages":
      return `t.course_id = $2 AND t.tenant_id = $1`;

    default:
      /* O que não está aqui não vai no backup de curso — inclusive tudo que é
         histórico de aluno. É a mesma decisão do `noBackupDeCurso`, e o teste
         do manifesto garante que as duas listas concordam. */
      return null;
  }
}

/** Quantas linhas cada tabela tem, para a tela mostrar o tamanho antes de gerar. */
export async function contarTabelas(tenantId: string): Promise<Record<string, number>> {
  const contagens: Record<string, number> = {};

  for (const tabela of TABELAS_DO_BACKUP) {
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${tabela.nome} t WHERE ${recorteDoTenant(tabela)}`,
      [tenantId],
    );

    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) contagens[tabela.nome] = n;
  }

  return contagens;
}

/**
 * As colunas da chave primária da tabela.
 *
 * O `ON CONFLICT DO NOTHING` sem alvo deixa o Postgres escolher o árbitro entre
 * TODAS as restrições únicas — e ele recusa a operação quando alguma delas é
 * DEFERRABLE: "ON CONFLICT does not support deferrable unique constraints as
 * arbiters". `modules(course_id, position)` é assim, porque reordenar módulos
 * precisa poder passar por um estado temporariamente duplicado.
 *
 * Nomeando a chave primária, o árbitro fica decidido e as demais restrições
 * saem da conta. A chave primária também é a comparação certa para a
 * restauração: "esta linha, esta mesma, já existe?".
 *
 * Nem toda tabela tem PK de uma coluna — `lesson_progress` e `course_tags` têm
 * duas —, então a lista vem do banco em vez de ser suposta.
 */
export async function chavePrimariaDe(tabela: string): Promise<string[]> {
  const rows = await query<{ coluna: string }>(
    `SELECT a.attname AS coluna
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE c.contype = 'p' AND n.nspname = 'public' AND t.relname = $1
      ORDER BY k.ord`,
    [tabela],
  );

  return rows.map((row) => row.coluna);
}

/**
 * As colunas que apontam para outra linha, lidas do SCHEMA.
 *
 * Do banco e não de uma lista em código: são 181 chaves estrangeiras, e uma
 * lista escrita à mão envelheceria na primeira migração. O que envelhece em
 * silêncio aqui deixa uma referência apontando para o cliente errado — o pior
 * defeito que a migração entre clientes poderia ter.
 *
 * O resultado é cacheado pelo tempo do processo: o schema não muda entre duas
 * requisições, e a consulta ao catálogo do Postgres não é barata.
 */
let cacheDeReferencias: ColunaDeReferencia[] | null = null;

export async function colunasDeReferencia(): Promise<ColunaDeReferencia[]> {
  if (cacheDeReferencias) return cacheDeReferencias;

  const rows = await query<{
    tabela: string;
    coluna: string;
    destino: string;
    aceitaNulo: boolean;
  }>(
    `SELECT c.conrelid::regclass::text   AS tabela,
            a.attname                    AS coluna,
            c.confrelid::regclass::text  AS destino,
            /* attnotnull é o oposto do que precisamos: a coluna aceita nulo
               quando NÃO é obrigatória. É o que decide, numa migração entre
               clientes, se uma referência ausente anula a coluna ou recusa a
               operação inteira. */
            NOT a.attnotnull             AS "aceitaNulo"
       FROM pg_constraint c
       JOIN pg_attribute a
         ON a.attrelid = c.conrelid
        AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace`,
  );

  /* QUAIS COLUNAS DESCARTAM A LINHA, lido do próprio schema.
   *
   * Uma coluna opcional que aparece num CHECK "exatamente uma origem" não
   * pode ser anulada: a linha existe por causa dela. `grade_entries` é o caso
   * — nota de prova, de tarefa ou de ferramenta LTI, e uma só. Anular a do
   * LTI produz uma nota sem origem, que o banco recusa.
   *
   * Derivar do CHECK em vez de listar à mão: uma lista aqui envelheceria na
   * primeira origem de nota nova, e o erro só apareceria numa migração. */
  const exclusivas = await query<{ tabela: string; coluna: string }>(
    /* UMA LINHA POR COLUNA, sem `array_agg`.

       O driver entrega `array_agg` como TEXTO — `"{a,b,c}"`, não um array —, e
       iterar sobre isso percorre caracteres em vez de nomes. O `Set` ficava
       cheio de letras soltas, nenhuma coluna era marcada, e a migração
       quebrava no CHECK do banco com um erro que não apontava para cá. */
    `SELECT c.conrelid::regclass::text AS tabela,
            a.attname                 AS coluna
       FROM pg_constraint c
       JOIN pg_attribute a
         ON a.attrelid = c.conrelid
        AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'c'
        AND c.connamespace = 'public'::regnamespace
        AND pg_get_constraintdef(c.oid) LIKE '%IS NOT NULL))::integer%= 1)%'`,
  );

  const descartam = new Set(exclusivas.map((e) => `${e.tabela}.${e.coluna}`));

  cacheDeReferencias = rows.map((r) => ({
    ...r,
    ...(descartam.has(`${r.tabela}.${r.coluna}`) ? { descartaLinha: true } : {}),
  }));

  return cacheDeReferencias;
}
