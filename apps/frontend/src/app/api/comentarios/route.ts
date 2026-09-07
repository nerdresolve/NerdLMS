import {
  commentUseCase,
  deleteCommentUseCase,
  editCommentUseCase,
  voteCommentUseCase,
} from "@nerdlms/backend/courses/comment-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { featureGate } from "@/lib/feature-guard.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/comentarios
 *
 * Publica um comentário numa aula, ou responde a outro.
 *
 * `highlighted` não é aceito do cliente **de propósito**: quem decide o
 * destaque de professor é o servidor, comparando autoria. Um campo enviado
 * aqui é simplesmente ignorado.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  /* Funcionalidade desligada para este cliente responde 404: a URL continua
     digitável, e esconder só o botão não desliga nada. */
  const bloqueio = await featureGate("comentarios");
  if (bloqueio) return bloqueio;

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isUuid(body.lessonId)) {
    return Response.json({ error: "Aula não informada." }, { status: 400 });
  }

  /* Responder é ramo próprio: há cliente que quer conversa plana — cada
     pessoa comenta, ninguém responde. */
  if (isUuid(body.parentId)) {
    const semResposta = await featureGate("comentarios.respostas");
    if (semResposta) return semResposta;
  }

  const outcome = await commentUseCase({
    actor: actorOf(user),
    lessonId: body.lessonId,
    body: typeof body.body === "string" ? body.body : "",
    ...(isUuid(body.parentId) ? { parentId: body.parentId } : {}),
  });

  if (outcome.status !== 201) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ comment: outcome.comment }, { status: 201 });
}


/**
 * DELETE /api/comentarios
 *
 * Remove um comentário. A regra de quem pode vive em `can()`: o autor apaga o
 * próprio, o instrutor modera o que está no curso dele.
 */
export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  /* Funcionalidade desligada para este cliente responde 404: a URL continua
     digitável, e esconder só o botão não desliga nada. */
  const bloqueio = await featureGate("comentarios");
  if (bloqueio) return bloqueio;

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isUuid(body.commentId)) {
    return Response.json({ error: "Comentário não informado." }, { status: 400 });
  }

  const outcome = await deleteCommentUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    commentId: body.commentId,
  });

  if (outcome.status !== 204) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return new Response(null, { status: 204 });
}


/**
 * PATCH /api/comentarios — vota ou edita.
 *
 * As duas ações moram aqui porque operam sobre o mesmo recurso e nenhuma cria
 * nada. O corpo decide qual é: `voted` para o marcador de útil, `body` para o
 * texto. Nunca os dois — editar e votar são intenções diferentes, e aceitar a
 * combinação abriria espaço para um voto silencioso junto de uma edição.
 */
export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  /* Funcionalidade desligada para este cliente responde 404: a URL continua
     digitável, e esconder só o botão não desliga nada. */
  const bloqueio = await featureGate("comentarios");
  if (bloqueio) return bloqueio;

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isUuid(body.commentId)) {
    return Response.json({ error: "Comentário não informado." }, { status: 400 });
  }

  if (typeof body.body === "string") {
    const outcome = await editCommentUseCase({
      actor: actorOf(user),
      commentId: body.commentId,
      body: body.body,
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ body: outcome.body, editedAt: outcome.editedAt });
  }

  if (typeof body.voted !== "boolean") {
    return Response.json({ error: "Informe se o comentário é útil." }, { status: 400 });
  }

  /* O voto tem chave própria: o cliente pode querer comentários SEM o marcador
     de útil, que é exatamente o caso que motivou a árvore de features. */
  const semVoto = await featureGate("comentarios.upvotes");
  if (semVoto) return semVoto;

  const outcome = await voteCommentUseCase({
    actor: actorOf(user),
    commentId: body.commentId,
    voted: body.voted,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ upvotes: outcome.upvotes });
}
