import {
  answerQuizUseCase,
  startQuizUseCase,
  submitQuizUseCase,
} from "@nerdlms/backend/assessment/quiz-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/provas — começa uma tentativa (`quizId`).
 * PATCH /api/provas — grava uma resposta, ou envia a tentativa.
 *
 * As questões voltam SEM gabarito: o caso de uso saneia antes, e há um teste
 * estrutural que reprova o build se o tipo do aluno voltar a carregar
 * `isCorrect`.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.quizId)) {
    return Response.json({ error: "Prova não informada." }, { status: 400 });
  }

  const outcome = await startQuizUseCase({ actor: actorOf(user), quizId: String(body.quizId) });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({
    attemptId: outcome.attempt.id,
    attemptNumber: outcome.attempt.attemptNumber,
    startedAt: outcome.attempt.startedAt,
    questions: outcome.questions,
    quiz: {
      title: outcome.quiz.title,
      timeLimitMinutes: outcome.quiz.timeLimitMinutes ?? null,
      questionsPerPage: outcome.quiz.questionsPerPage ?? null,
      sequentialNavigation: outcome.quiz.sequentialNavigation,
      totalPoints: outcome.quiz.totalPoints,
    },
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.attemptId)) {
    return Response.json({ error: "Tentativa não informada." }, { status: 400 });
  }

  const actor = actorOf(user);
  const attemptId = String(body.attemptId);

  /* Enviar é um caminho próprio: fecha a tentativa e corrige. */
  if (body.submit === true) {
    const outcome = await submitQuizUseCase({ actor, attemptId });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }

    return Response.json({
      percent: outcome.percent,
      passed: outcome.passed,
      needsReview: outcome.needsReview,
    });
  }

  if (!isUuid(body.questionId)) {
    return Response.json({ error: "Questão não informada." }, { status: 400 });
  }

  const outcome = await answerQuizUseCase({
    actor,
    attemptId,
    questionId: String(body.questionId),
    /* A resposta não é validada aqui: a forma muda com o tipo da questão, e o
       motor de correção já trata qualquer formato como zero em vez de quebrar.
       Validar duas vezes daria duas definições do que é resposta válida. */
    response: body.response,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ ok: true });
}
