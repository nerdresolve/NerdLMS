import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { acaoDoAluno, aprovado, notaFormatada, validarDecisao } from "@nerdlms/core/assessment/retake.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import { notify } from "../notifications/notify.ts";
import { findEnrollmentId } from "./enrollment-lookup.ts";
import { findCourseForPermission } from "./course-permission.ts";
import { findAttempts, findQuiz } from "./quiz-repository.ts";
import {
  criarPedido,
  decidirPedido,
  pedidoPendente,
  pedidoPorId,
  retestesAprovados,
} from "./retake-repository.ts";

/**
 * Reteste: o aluno pede, o instrutor decide.
 *
 * POR QUE NÃO É AUTOSSERVIÇO
 *
 * Com tentativas livres, a primeira prova vira rascunho: quem reprova refaz no
 * mesmo minuto e ninguém fica sabendo. Reprovar só significa alguma coisa se
 * custar alguma coisa — aqui custa um pedido, e a resposta fica escrita.
 *
 * O COMENTÁRIO É OBRIGATÓRIO nos dois sentidos. Aprovar sem justificar é um
 * clique; recusar sem justificar é a pior mensagem que um aluno pode receber.
 */

export interface PedirCommand {
  actor: Actor;
  actorName: string;
  quizId: string;
  /** O que o aluno escreveu. Opcional — ver `validarDecisao` para o contraste. */
  nota: string | null;
}

export type PedirOutcome =
  | { status: 200; pedidoId: string }
  | { status: 400 | 403 | 404; error: string };

export async function pedirRetesteUseCase(command: PedirCommand): Promise<PedirOutcome> {
  const quiz = await findQuiz(command.quizId);
  if (!quiz) return { status: 404, error: "Prova não encontrada." };

  /* Sem matrícula não há prova nem pedido: a tentativa pertence ao vínculo com
     o curso, e o pedido também. Mesma resposta de prova inexistente, para não
     revelar o catálogo por tentativa. */
  const enrollmentId = await findEnrollmentId(quiz.courseId, command.actor.id);
  if (!enrollmentId) return { status: 404, error: "Prova não encontrada." };

  const tentativas = await findAttempts(quiz.id, enrollmentId);
  const enviadas = tentativas.filter((t) => t.submittedAt);

  const melhor = enviadas.reduce(
    (maior, t) => Math.max(maior, t.scorePercent ?? 0),
    0,
  );

  const acao = acaoDoAluno({
    tentativasUsadas: enviadas.length,
    retestesAprovados: await retestesAprovados(quiz.id, enrollmentId),
    pedidoPendente: (await pedidoPendente(quiz.id, enrollmentId)) !== null,
    jaAprovado: enviadas.length > 0 && aprovado(melhor),
  });

  /* A MESMA função que a tela usa para decidir o que mostrar decide aqui se o
     pedido vale. Duas regras separadas divergiriam, e o botão apareceria para
     quem o servidor recusa. */
  if (acao.tipo !== "pedir-reteste") {
    const motivo: Record<string, string> = {
      fazer: "Você ainda tem tentativa disponível nesta prova.",
      aguardando: "Você já tem um pedido de reteste aguardando decisão.",
      aprovado: "Você já foi aprovado nesta prova.",
      "sem-saida": "Esta prova não está disponível.",
    };
    return { status: 403, error: motivo[acao.tipo] ?? "Pedido indisponível." };
  }

  if (!command.actor.tenantId) return { status: 403, error: "Cliente não identificado." };

  const nota = command.nota?.trim().slice(0, 1000) || null;

  const pedidoId = await criarPedido({
    tenantId: command.actor.tenantId,
    quizId: quiz.id,
    enrollmentId,
    learnerNote: nota,
  });

  /* Nulo: o índice parcial barrou um segundo pendente — dois cliques. Não é
     erro; o estado desejado já existe. */
  if (!pedidoId) {
    return { status: 403, error: "Você já tem um pedido de reteste aguardando decisão." };
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "config_changed",
    target: `reteste solicitado, ${quiz.title}`,
    outcome: "allowed",
    tenantId: command.actor.tenantId,
  });

  return { status: 200, pedidoId };
}

export interface DecidirCommand {
  actor: Actor;
  actorName: string;
  pedidoId: string;
  status: "approved" | "denied";
  comentario: string;
}

export type DecidirOutcome =
  | { status: 200 }
  | { status: 400 | 403 | 404; error: string };

export async function decidirRetesteUseCase(
  command: DecidirCommand,
): Promise<DecidirOutcome> {
  const validado = validarDecisao({ status: command.status, comentario: command.comentario });
  if (!validado.ok) return { status: 400, error: validado.erro };

  const pedido = await pedidoPorId(command.pedidoId);
  if (!pedido) return { status: 404, error: "Pedido não encontrado." };

  /* A MESMA permissão que decide quem edita o curso: quem responde pelo
     conteúdo responde pela segunda chance. `can` já trata o administrador, o
     gestor e o instrutor autor — reimplementar a hierarquia aqui criaria uma
     segunda regra de acesso, e a que ficasse para trás liberaria o que a outra
     nega.

     Vale mesmo com a fila já filtrada por autoria: a fila é uma consulta, e
     nada impede alguém de mandar o id de um pedido que não veio dela. */
  const curso = await findCourseForPermission(pedido.courseId);
  if (!curso) return { status: 404, error: "Pedido não encontrado." };

  const podeDecidir = can(command.actor, "update", {
    kind: "course",
    authorId: curso.authorId,
    status: curso.status,
  });

  if (!podeDecidir) {
    return { status: 403, error: "Sem permissão para decidir este pedido." };
  }

  const gravou = await decidirPedido({
    id: command.pedidoId,
    status: command.status,
    comentario: validado.comentario,
    decidedBy: command.actor.id,
  });

  /* Já decidido por outra pessoa, ou dois cliques. Não sobrescreve o
     comentário de quem chegou primeiro. */
  if (!gravou) return { status: 403, error: "Este pedido já foi decidido." };

  const liberado = command.status === "approved";

  await notify({
    userId: pedido.learnerId,
    kind: "announcement",
    title: liberado
      ? `Reteste liberado: ${pedido.quizTitle}`
      : `Reteste não liberado: ${pedido.quizTitle}`,
    body: validado.comentario,
    link: `/cursos/${pedido.courseId}`,
  });

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "config_changed",
    target:
      `reteste ${liberado ? "liberado" : "recusado"}, ${pedido.learnerName} · ` +
      `${pedido.quizTitle} (melhor nota ${pedido.melhorPercentual === null ? "-" : notaFormatada(pedido.melhorPercentual)})`,
    outcome: liberado ? "allowed" : "denied",
    tenantId: command.actor.tenantId ?? null,
  });

  return { status: 200 };
}
