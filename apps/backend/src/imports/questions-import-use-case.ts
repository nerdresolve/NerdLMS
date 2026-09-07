import { type Actor } from "@nerdlms/core/auth/permissions.ts";
import { parseTable } from "@nerdlms/core/imports/csv-parse.ts";
import {
  planQuestionsImport,
  type PlanoQuestoes,
} from "@nerdlms/core/imports/questions-import.ts";
import { planQtiImport } from "@nerdlms/core/imports/qti-import.ts";

import { createQuestion } from "../assessment/question-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";
import { query } from "../db/pool.ts";

/**
 * Importação de questões em massa — F5-05 (guia §24).
 *
 * Mesmo desenho da importação de usuários: **conferir devolve o plano sem
 * gravar, aplicar grava o que o plano prometeu**, e o plano é refeito no
 * servidor na hora de aplicar.
 *
 * A conferência importa ainda mais aqui do que em usuário. Uma questão
 * objetiva importada sem gabarito vale zero para todo mundo que responder — e
 * ninguém descobre até a prova ser corrigida, quando já foi aplicada.
 */

export interface QuestionsImportCommand {
  actor: Actor;
  actorName: string;
  csv: string;
  /** Curso a que as questões pertencem. Nulo é banco geral do cliente. */
  courseId?: string | null;
}

export type QuestionsPreviewOutcome =
  | { status: 200; plano: PlanoQuestoes }
  | { status: 400 | 403; error: string };

/**
 * Quem importa questão: instrutor e admin.
 *
 * Questão é conteúdo de curso, e conteúdo é do instrutor — a mesma regra que
 * decide quem cria curso. Gestor acompanha e matricula, mas não escreve prova;
 * aluno, por motivos óbvios, também não.
 */
function autorizado(actor: Actor): boolean {
  return actor.role === "admin" || actor.role === "instructor";
}

export async function previewQuestionsImport(
  command: QuestionsImportCommand,
): Promise<QuestionsPreviewOutcome> {
  if (!autorizado(command.actor)) {
    return { status: 403, error: "Sem permissão para importar questões." };
  }

  if (!command.actor.tenantId) {
    return { status: 400, error: "Sessão sem cliente definido." };
  }

  const { headers, rows } = parseTable(command.csv);

  if (headers.length === 0) return { status: 400, error: "O arquivo está vazio." };
  if (rows.length === 0) {
    return { status: 400, error: "O arquivo só tem o cabeçalho, sem nenhuma questão." };
  }

  return { status: 200, plano: planQuestionsImport(rows) };
}

export interface AppliedQuestions {
  criadas: number;
  /** Categorias que passaram a existir por causa desta importação. */
  categoriasNovas: number;
}

export type QuestionsApplyOutcome =
  | { status: 200; resultado: AppliedQuestions }
  | { status: 400 | 403; error: string };

/**
 * Acha ou cria a categoria pelo nome.
 *
 * A planilha traz o NOME ("Tratamento"), não um id — ninguém preenche uuid à
 * mão. Criar a que falta é o comportamento útil: recusar a questão porque a
 * categoria ainda não existe obrigaria a cadastrar tudo antes, numa tela
 * diferente, para só então importar.
 *
 * `ON CONFLICT DO NOTHING` seguido de leitura: entre verificar e inserir cabe
 * outra importação criando o mesmo nome.
 */
async function categoriaId(
  tenantId: string,
  nome: string,
  criadas: { total: number },
): Promise<string | null> {
  /* O alvo do ON CONFLICT repete a EXPRESSÃO do índice da migração 018 —
     `lower(btrim(name))`, não `name`. Um índice por expressão só é reconhecido
     quando a instrução nomeia a mesma expressão; escrever `(tenant_id, name)`
     aqui faria o Postgres recusar por não achar restrição correspondente. */
  const inserida = await query<{ id: string }>(
    `INSERT INTO question_categories (tenant_id, name)
     VALUES ($1, btrim($2))
     ON CONFLICT (tenant_id, lower(btrim(name))) DO NOTHING
     RETURNING id`,
    [tenantId, nome],
  );

  if (inserida[0]) {
    criadas.total += 1;
    return inserida[0].id;
  }

  const existente = await query<{ id: string }>(
    `SELECT id FROM question_categories
      WHERE tenant_id = $1 AND lower(name) = lower(btrim($2))
      LIMIT 1`,
    [tenantId, nome],
  );

  return existente[0]?.id ?? null;
}

export async function applyQuestionsImport(
  command: QuestionsImportCommand,
): Promise<QuestionsApplyOutcome> {
  const conferido = await previewQuestionsImport(command);
  if (conferido.status !== 200) return conferido;

  return gravarQuestoes(command, conferido.plano);
}

/**
 * Grava as questões de um plano já conferido.
 *
 * Separado de `applyQuestionsImport` para o QTI reaproveitá-lo: o formato de
 * entrada é outro, mas o que acontece DEPOIS de conferir é idêntico —
 * categoria, alternativas, auditoria. Duas cópias divergiriam na primeira
 * correção, e a que ficasse para trás gravaria questão pela metade.
 */
async function gravarQuestoes(
  command: QuestionsImportCommand,
  plano: PlanoQuestoes,
): Promise<QuestionsApplyOutcome> {
  const paraCriar = plano.linhas.filter((l) => l.situacao === "criar");
  const tenantId = command.actor.tenantId!;

  /* As categorias são resolvidas UMA vez por nome, e não por questão: uma
     planilha com 200 questões de 5 assuntos faria 200 idas ao banco para
     descobrir os mesmos 5 ids. */
  const criadas = { total: 0 };
  const porNome = new Map<string, string | null>();

  for (const linha of paraCriar) {
    if (!linha.categoria || porNome.has(linha.categoria)) continue;
    porNome.set(linha.categoria, await categoriaId(tenantId, linha.categoria, criadas));
  }

  let criadasQuestoes = 0;

  for (const linha of paraCriar) {
    await createQuestion({
      tenantId,
      courseId: command.courseId ?? null,
      categoryId: linha.categoria ? (porNome.get(linha.categoria) ?? null) : null,
      kind: linha.tipo,
      prompt: linha.enunciado,
      points: linha.pontos,
      explanation: linha.explicacao,
      authorId: command.actor.id,
      options: linha.alternativas.map((alternativa, posicao) => ({
        text: alternativa.texto,
        isCorrect: alternativa.correta,
        position: posicao,
      })),
    });

    criadasQuestoes += 1;
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "questions_imported",
    target: `${criadasQuestoes} ${criadasQuestoes === 1 ? "questão importada" : "questões importadas"}`,
    outcome: "allowed",
  });

  return {
    status: 200,
    resultado: { criadas: criadasQuestoes, categoriasNovas: criadas.total },
  };
}

/**
 * Confere um arquivo QTI — o guia §30.
 *
 * QTI é o padrão da 1EdTech para questões. Quem vem de outro LMS exporta o
 * banco nesse formato, e sem isto a migração é redigitar tudo.
 *
 * Devolve o MESMO `PlanoQuestoes` da planilha, de propósito: a tela de
 * conferência, a contagem e a gravação já existem e não precisam saber de onde
 * o arquivo veio.
 */
export async function previewQtiImport(
  command: QuestionsImportCommand,
): Promise<QuestionsPreviewOutcome> {
  if (!autorizado(command.actor)) {
    return { status: 403, error: "Sem permissão para importar questões." };
  }

  if (!command.actor.tenantId) {
    return { status: 400, error: "Sessão sem cliente definido." };
  }

  const xml = command.csv.trim();
  if (!xml) return { status: 400, error: "O arquivo está vazio." };

  if (!/<(?:qti-)?assessment(?:Item|-item|Test|-test)\b/i.test(xml)) {
    /* Recusa cedo e com mensagem específica: um CSV enviado no campo errado
       chegaria aqui e produziria "nenhuma questão encontrada", que não diz à
       pessoa que ela trocou o arquivo. */
    return { status: 400, error: "O arquivo não parece ser QTI." };
  }

  const plano = planQtiImport(xml);

  if (plano.linhas.length === 0) {
    return { status: 400, error: "Nenhuma questão encontrada no arquivo." };
  }

  return { status: 200, plano };
}

export async function applyQtiImport(
  command: QuestionsImportCommand,
): Promise<QuestionsApplyOutcome> {
  const conferido = await previewQtiImport(command);
  if (conferido.status !== 200) return conferido;

  return gravarQuestoes(command, conferido.plano);
}
