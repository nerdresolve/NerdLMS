import type { Evidence } from "@nerdlms/core/competencies/proficiency.ts";
import type { Exigencia } from "@nerdlms/core/competencies/plano-de-formacao.ts";

import { query, withTransaction } from "../db/pool.ts";

/**
 * O plano de formação por cargo: leitura.
 *
 * "O que forma um Analista de Desenvolvimento PLENO, e quem já está formado?"
 *
 * O QUE É "CURSO CONCLUÍDO" MORA NUM LUGAR SÓ
 *
 * Ter visto todas as aulas e, quando o curso exige, ter batido a nota mínima —
 * a mesma regra do certificado e da avaliação de eficácia. A parte da nota é
 * aplicada em TypeScript pelo caso de uso, com as mesmas funções que aquelas
 * duas usam; reescrever a média ponderada em SQL daria uma terceira versão da
 * regra, e um dia as três discordariam.
 */

export interface PlanoDeCargo {
  id: string;
  nome: string;
  descricao: string | null;
  /** O cargo alcançado. Nulo: só quem for atribuído à mão. */
  jobTitle: string | null;
  /** O plano que este continua. Nulo: não continua nenhum. */
  continuaId: string | null;
  prazo: Date | null;
  ativo: boolean;
  exigencias: Exigencia[];
}

/** Os planos do cliente, com as exigências de cada um. */
export async function planosDeFormacao(tenantId: string): Promise<PlanoDeCargo[]> {
  const planos = await query<{
    id: string;
    name: string;
    description: string | null;
    job_title: string | null;
    extends_plan_id: string | null;
    due_date: Date | null;
    active: boolean;
  }>(
    `SELECT id, name, description, job_title, extends_plan_id, due_date, active
       FROM learning_plans
      WHERE tenant_id = $1
      ORDER BY name`,
    [tenantId],
  );

  if (planos.length === 0) return [];

  const itens = await query<{
    id: string;
    plan_id: string;
    competency_id: string | null;
    track_id: string | null;
    course_id: string | null;
    required_level: number | null;
    nome: string;
  }>(
    /* Um `COALESCE` sobre três junções à esquerda: o item aponta para uma das
       três coisas, e o CHECK da tabela garante que é exatamente uma. */
    `SELECT i.id, i.plan_id, i.competency_id, i.track_id, i.course_id, i.required_level,
            COALESCE(comp.name, t.title, c.title, '(removido)') AS nome
       FROM learning_plan_items i
       JOIN learning_plans p ON p.id = i.plan_id
       LEFT JOIN competencies comp ON comp.id = i.competency_id
       LEFT JOIN tracks t ON t.id = i.track_id
       LEFT JOIN courses c ON c.id = i.course_id
      WHERE p.tenant_id = $1`,
    [tenantId],
  );

  const porPlano = new Map<string, Exigencia[]>();

  for (const item of itens) {
    const lista = porPlano.get(item.plan_id) ?? [];

    if (item.track_id) {
      lista.push({ id: item.id, tipo: "trilha", alvoId: item.track_id, nome: item.nome });
    } else if (item.course_id) {
      lista.push({ id: item.id, tipo: "curso", alvoId: item.course_id, nome: item.nome });
    } else if (item.competency_id) {
      lista.push({
        id: item.id,
        tipo: "competencia",
        alvoId: item.competency_id,
        nome: item.nome,
        nivelExigido: item.required_level ?? 1,
      });
    }

    porPlano.set(item.plan_id, lista);
  }

  return planos.map((plano) => ({
    id: plano.id,
    nome: plano.name,
    descricao: plano.description,
    jobTitle: plano.job_title,
    continuaId: plano.extends_plan_id,
    prazo: plano.due_date,
    ativo: plano.active,
    exigencias: porPlano.get(plano.id) ?? [],
  }));
}

export interface PessoaDoPlano {
  id: string;
  nome: string;
  jobTitle: string | null;
}

/**
 * Quem o plano alcança.
 *
 * A UNIÃO de duas origens: quem tem o cargo do plano, e quem foi atribuído à
 * mão. As duas, e não uma ou outra — o cargo cobre a regra geral e a atribuição
 * cobre a exceção, que existe em toda organização.
 *
 * Só contas ativas: convite pendente e conta desativada distorceriam "quantas
 * pessoas estão formadas" sem que ninguém precisasse ser formado hoje.
 */
export async function pessoasDoPlano(
  tenantId: string,
  planId: string,
  jobTitle: string | null,
): Promise<PessoaDoPlano[]> {
  const linhas = await query<{ id: string; full_name: string; job_title: string | null }>(
    `SELECT DISTINCT u.id, u.full_name, u.job_title
       FROM users u
       LEFT JOIN learning_plan_assignments a ON a.user_id = u.id AND a.plan_id = $2
      WHERE u.tenant_id = $1
        AND u.status = 'active'
        AND (
          a.plan_id IS NOT NULL
          OR ($3::text IS NOT NULL
              AND lower(btrim(u.job_title)) = lower(btrim($3)))
        )
      ORDER BY u.full_name`,
    [tenantId, planId, jobTitle],
  );

  return linhas.map((l) => ({ id: l.id, nome: l.full_name, jobTitle: l.job_title }));
}

export interface ProgressoBruto {
  /** Cursos em que a pessoa viu TODAS as aulas. A nota é conferida depois. */
  cursosComAulasVistas: string[];
  /** Nota mínima do curso, quando ele exige. */
  exigenciaDeNota: Map<string, number>;
  /** Matrícula por curso, para buscar as notas. */
  matriculaPorCurso: Map<string, string>;
}

/**
 * O que a pessoa terminou de assistir, por curso.
 *
 * A condição é "não falta nenhuma aula", e não "a contagem bate": a segunda
 * daria conclusão para um curso sem nenhuma aula, onde 0 = 0.
 */
export async function progressoBruto(userId: string): Promise<ProgressoBruto> {
  const linhas = await query<{
    course_id: string;
    enrollment_id: string;
    min_grade_percent: string | null;
  }>(
    `SELECT c.id AS course_id, e.id AS enrollment_id, c.min_grade_percent
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.learner_id = $1
        AND EXISTS (
              SELECT 1 FROM modules m JOIN lessons l ON l.module_id = m.id
               WHERE m.course_id = c.id
            )
        AND NOT EXISTS (
              SELECT 1
                FROM modules m
                JOIN lessons l ON l.module_id = m.id
               WHERE m.course_id = c.id
                 AND NOT EXISTS (
                       SELECT 1 FROM lesson_progress lp
                        WHERE lp.enrollment_id = e.id
                          AND lp.lesson_id = l.id
                          AND lp.completed_at IS NOT NULL
                     )
            )`,
    [userId],
  );

  const exigenciaDeNota = new Map<string, number>();
  const matriculaPorCurso = new Map<string, string>();

  for (const linha of linhas) {
    matriculaPorCurso.set(linha.course_id, linha.enrollment_id);
    if (linha.min_grade_percent !== null) {
      exigenciaDeNota.set(linha.course_id, Number(linha.min_grade_percent));
    }
  }

  return {
    cursosComAulasVistas: linhas.map((l) => l.course_id),
    exigenciaDeNota,
    matriculaPorCurso,
  };
}

/** Os cursos de cada trilha, para saber quando a jornada inteira acabou. */
export async function cursosDasTrilhas(tenantId: string): Promise<Map<string, string[]>> {
  const linhas = await query<{ track_id: string; course_id: string }>(
    `SELECT tc.track_id, tc.course_id
       FROM track_courses tc
       JOIN tracks t ON t.id = tc.track_id
      WHERE t.tenant_id = $1
      ORDER BY tc.track_id, tc.position`,
    [tenantId],
  );

  const porTrilha = new Map<string, string[]>();

  for (const linha of linhas) {
    const lista = porTrilha.get(linha.track_id) ?? [];
    lista.push(linha.course_id);
    porTrilha.set(linha.track_id, lista);
  }

  return porTrilha;
}

/** As evidências de competência de uma pessoa. */
export async function evidenciasDe(tenantId: string, userId: string): Promise<Evidence[]> {
  const linhas = await query<{
    id: string;
    competency_id: string;
    level: number;
    source: Evidence["source"];
    created_at: Date;
    expires_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT id, competency_id, level, source, created_at, expires_at, revoked_at
       FROM competency_evidence
      WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId],
  );

  return linhas.map((l) => ({
    id: l.id,
    competencyId: l.competency_id,
    level: l.level,
    source: l.source,
    createdAt: l.created_at.toISOString(),
    expiresAt: l.expires_at?.toISOString() ?? null,
    revokedAt: l.revoked_at?.toISOString() ?? null,
  }));
}

export interface NovoPlano {
  tenantId: string;
  nome: string;
  descricao: string | null;
  jobTitle: string | null;
  /** O plano que este continua. Nulo: não continua nenhum. */
  continuaId: string | null;
  criadoPor: string;
}

/**
 * Cria o plano JUNTO com as exigências, numa transação só.
 *
 * Eram duas escritas separadas, e a primeira falha mostrou por que isso não
 * serve: o plano foi criado, a inserção dos itens bateu num CHECK, e sobrou um
 * plano vazio no banco enquanto a tela dizia que não deu certo. Plano sem
 * exigência não forma ninguém e mostra 0% para todo mundo sem explicar por quê.
 *
 * O alvo de cada item precisa ser do MESMO cliente: um id de outro tenant
 * montaria um plano que atravessa a fronteira, e ela é a que nada atravessa.
 */
export async function criarPlanoComExigencias(
  novo: NovoPlano,
  itens: ItemDoPlano[],
): Promise<string> {
  return withTransaction(async (executar) => {
    const linhas = await executar<{ id: string }>(
      /* O plano continuado precisa ser do MESMO cliente: a subconsulta devolve
         nulo para um id de fora, e o plano nasce sem herança em vez de
         atravessar a fronteira. */
      `INSERT INTO learning_plans
         (tenant_id, name, description, job_title, extends_plan_id, created_by)
       VALUES ($1, $2, $3, $4,
               (SELECT p.id FROM learning_plans p
                 WHERE p.id = $5 AND p.tenant_id = $1),
               $6)
       RETURNING id`,
      [
        novo.tenantId,
        novo.nome,
        novo.descricao,
        novo.jobTitle,
        novo.continuaId,
        novo.criadoPor,
      ],
    );

    const planId = linhas[0]!.id;
    await inserirExigencias(executar, novo.tenantId, planId, itens);

    return planId;
  });
}

export interface ItemDoPlano {
  tipo: "trilha" | "curso" | "competencia";
  alvoId: string;
  nivelExigido?: number;
}

export interface DadosDoPlano {
  nome: string;
  descricao: string | null;
  jobTitle: string | null;
  continuaId: string | null;
}

/**
 * Reescreve o plano e as exigências dele, numa transação só.
 *
 * Devolve `false` quando o plano não é deste cliente — ou não existe. Plano de
 * outro tenant responde como inexistente: a diferença entre "não existe" e
 * "não é seu" já é informação (§18).
 *
 * Uma transação porque as duas escritas são a mesma mudança: apagar as
 * exigências e falhar ao inserir as novas deixaria um plano vazio, que mostra
 * 0% para todo mundo sem explicar por quê. Foi assim que a criação quebrou
 * antes de virar transação.
 */
export async function atualizarPlanoComExigencias(
  tenantId: string,
  planId: string,
  dados: DadosDoPlano,
  itens: ItemDoPlano[],
): Promise<boolean> {
  return withTransaction(async (executar) => {
    const alterados = await executar<{ id: string }>(
      /* O plano continuado precisa ser do MESMO cliente, e a subconsulta é o
         que garante isso: um id de fora vira nulo em vez de atravessar a
         fronteira. */
      `UPDATE learning_plans
          SET name = $3, description = $4, job_title = $5,
              extends_plan_id = (SELECT p.id FROM learning_plans p
                                  WHERE p.id = $6 AND p.tenant_id = $1),
              updated_at = now()
        WHERE id = $2 AND tenant_id = $1
        RETURNING id`,
      [tenantId, planId, dados.nome, dados.descricao, dados.jobTitle, dados.continuaId],
    );

    if (alterados.length === 0) return false;

    await executar(`DELETE FROM learning_plan_items WHERE plan_id = $1`, [planId]);
    await inserirExigencias(executar, tenantId, planId, itens);

    return true;
  });
}

type Executor = <R>(text: string, params?: readonly unknown[]) => Promise<R[]>;

/**
 * As três inserções possíveis, num lugar só.
 *
 * Estavam duplicadas entre criar e editar. Duas cópias da mesma regra de
 * fronteira — o `AND tenant_id` de cada uma — são duas oportunidades de alguém
 * corrigir uma e esquecer a outra.
 */
async function inserirExigencias(
  executar: Executor,
  tenantId: string,
  planId: string,
  itens: ItemDoPlano[],
): Promise<void> {
  for (const item of itens) {
    if (item.tipo === "trilha") {
      await executar(
        `INSERT INTO learning_plan_items (plan_id, track_id)
         SELECT $1, t.id FROM tracks t WHERE t.id = $2 AND t.tenant_id = $3`,
        [planId, item.alvoId, tenantId],
      );
      continue;
    }

    if (item.tipo === "curso") {
      await executar(
        `INSERT INTO learning_plan_items (plan_id, course_id)
         SELECT $1, c.id FROM courses c WHERE c.id = $2 AND c.tenant_id = $3`,
        [planId, item.alvoId, tenantId],
      );
      continue;
    }

    await executar(
      `INSERT INTO learning_plan_items (plan_id, competency_id, required_level)
       SELECT $1, k.id, $4 FROM competencies k WHERE k.id = $2 AND k.tenant_id = $3`,
      [planId, item.alvoId, tenantId, item.nivelExigido ?? 1],
    );
  }
}

/**
 * Os planos que CONTINUAM este.
 *
 * Quem quiser excluí-lo precisa saber deles antes: a coluna é
 * `ON DELETE SET NULL`, então apagar sem avisar faria cada um desses perder a
 * herança em silêncio. O plano do PLENO deixaria de exigir o que o JR exigia, e
 * a única pista seria o percentual de todo mundo subindo sem motivo.
 */
export async function planosQueContinuam(
  tenantId: string,
  planId: string,
): Promise<string[]> {
  const linhas = await query<{ name: string }>(
    `SELECT name
       FROM learning_plans
      WHERE tenant_id = $1 AND extends_plan_id = $2
      ORDER BY name`,
    [tenantId, planId],
  );

  return linhas.map((l) => l.name);
}

/**
 * Apaga o plano. Devolve o nome dele, ou `null` se não era deste cliente.
 *
 * As exigências e as atribuições manuais saem por CASCADE — fora do plano elas
 * não significam nada. O que NÃO sai é o progresso de ninguém: a formação é
 * derivada do que a pessoa concluiu, e apagar o plano só apaga a exigência.
 */
export async function excluirPlano(
  tenantId: string,
  planId: string,
): Promise<string | null> {
  const linhas = await query<{ name: string }>(
    `DELETE FROM learning_plans WHERE id = $1 AND tenant_id = $2 RETURNING name`,
    [planId, tenantId],
  );

  return linhas[0]?.name ?? null;
}
