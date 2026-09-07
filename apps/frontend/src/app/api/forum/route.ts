import {
  createPostUseCase,
  createTopicUseCase,
  moderateUseCase,
  reportUseCase,
  subscribeUseCase,
} from "@nerdlms/backend/forum/forum-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { featureGate } from "@/lib/feature-guard.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/forum — cria tópico ou responde.
 * PATCH /api/forum — modera (fixar, fechar, ocultar), assina ou denuncia.
 *
 * O fórum inteiro fica atrás da feature `forum`: um cliente que não quer fórum
 * não tem fórum, e a rota responde 404 — não 403, que confirmaria a existência
 * do que aquele cliente não contratou.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const bloqueio = await featureGate("forum");
  if (bloqueio) return bloqueio;

  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const actor = actorOf(user);

  /* Responder: identificado pelo tópico. */
  if (isUuid(body.topicId)) {
    const outcome = await createPostUseCase({
      actor,
      actorName: user.fullName,
      topicId: String(body.topicId),
      body: typeof body.body === "string" ? body.body : "",
      ...(isUuid(body.parentId) ? { parentId: String(body.parentId) } : {}),
    });

    if (outcome.status !== 201) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ id: outcome.id }, { status: 201 });
  }

  if (!isUuid(body.courseId)) {
    return Response.json({ error: "Curso não informado." }, { status: 400 });
  }

  const outcome = await createTopicUseCase({
    actor,
    courseId: String(body.courseId),
    title: typeof body.title === "string" ? body.title : "",
    body: typeof body.body === "string" ? body.body : "",
  });

  if (outcome.status !== 201) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ id: outcome.id }, { status: 201 });
}

export async function PATCH(request: Request): Promise<Response> {
  const bloqueio = await featureGate("forum");
  if (bloqueio) return bloqueio;

  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const actor = actorOf(user);

  /* Denunciar vem antes de moderar: quem denuncia é participante, quem modera
     é dono do curso, e as duas ações chegam com `postId`. */
  if (isUuid(body.postId) && typeof body.report === "string") {
    const outcome = await reportUseCase({
      actor,
      postId: String(body.postId),
      reason: body.report,
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  if (isUuid(body.topicId) && typeof body.subscribe === "boolean") {
    const outcome = await subscribeUseCase({
      actor,
      topicId: String(body.topicId),
      subscribe: body.subscribe,
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  const outcome = await moderateUseCase({
    actor,
    ...(isUuid(body.topicId) ? { topicId: String(body.topicId) } : {}),
    ...(isUuid(body.postId) ? { postId: String(body.postId) } : {}),
    ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
    ...(typeof body.closed === "boolean" ? { closed: body.closed } : {}),
    ...(typeof body.hide === "boolean" ? { hide: body.hide } : {}),
    ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ ok: true });
}
