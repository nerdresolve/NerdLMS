import { progressUseCase } from "@nerdlms/backend/courses/progress-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/progresso
 *
 * Registra a posição assistida de uma aula, ou marca a aula como concluída.
 *
 * A rota só traduz HTTP: lê o corpo, pega o ator da sessão e delega. A regra
 * de "nunca retroceder", o limite pela duração e a autorização moram em
 * `@nerdlms/backend` e `@nerdlms/core`.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();

  /* 401 antes de ler o corpo: sem sessão não há o que autorizar, e processar a
     requisição primeiro só gastaria trabalho. */
  if (!user) {
    return Response.json({ error: "Sessão exigida." }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isUuid(body.lessonId)) {
    return Response.json({ error: "Aula não informada." }, { status: 400 });
  }

  const outcome = await progressUseCase({
    actor: actorOf(user),
    lessonId: body.lessonId,
    ...(typeof body.watchedSeconds === "number" ? { watchedSeconds: body.watchedSeconds } : {}),
    ...(body.complete === true ? { complete: true } : {}),
    ...(body.complete === false ? { complete: false } : {}),
    /* Aula de conteúdo: a página por onde a pessoa passou. */
    ...(typeof body.pageSeen === "number" ? { pageSeen: body.pageSeen } : {}),
    ...(typeof body.secondsOnPage === "number" ? { secondsOnPage: body.secondsOnPage } : {}),
  });

  /* 204 quando a posição não avançou: o player envia periodicamente, e um erro
     a cada vídeo pausado seria ruído, não informação. */
  if (outcome.status === 204) return new Response(null, { status: 204 });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ watchedSeconds: outcome.watchedSeconds, completed: outcome.completed });
}
