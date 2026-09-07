import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  COMMENT_REFUSAL_MESSAGE,
  isHighlighted,
  validateComment,
} from "@nerdlms/core/courses/comment-rules.ts";
import type { Comment } from "@nerdlms/core/courses/types.ts";

import {
  createComment,
  findCommentContext,
  findCommentOwnership,
  setCommentVote,
  softDeleteComment,
  updateComment,
} from "./comment-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Publicação de comentário.
 *
 * O destaque de professor é decidido **aqui**, comparando o autor do
 * comentário com o autor do curso. O cliente não envia esse campo, e se
 * enviasse seria ignorado: um aluno adulterando o payload não consegue
 * publicar como professor (PRD §8).
 */

export interface CommentCommand {
  actor: Actor;
  lessonId: string;
  body: string;
  parentId?: string;
}

export type CommentOutcome =
  | { status: 201; comment: Comment }
  | { status: 400 | 403 | 404; error: string };

export async function commentUseCase(command: CommentCommand): Promise<CommentOutcome> {
  const context = await findCommentContext(command.lessonId, command.actor.id);
  if (!context) return { status: 404, error: "Aula não encontrada." };

  const allowed = can(command.actor, "comment", {
    kind: "comment",
    authorId: command.actor.id,
    courseAuthorId: context.courseAuthorId,
  });
  if (!allowed) {
    return { status: 403, error: "Sem permissão para comentar." };
  }

  /* Matrícula é exigida de quem não escreveu o curso: comentar numa aula que
     não se cursa não faz sentido, e abriria a conversa para quem passou o id
     na URL. O autor comenta no próprio curso sem estar matriculado nele. */
  const isAuthor = context.courseAuthorId === command.actor.id;
  if (!isAuthor && !context.enrolled) {
    return { status: 403, error: "Matricule-se no curso para participar da conversa." };
  }

  const validated = validateComment(command.body);
  if (!validated.ok) {
    return { status: 400, error: COMMENT_REFUSAL_MESSAGE[validated.reason] };
  }

  const comment = await createComment({
    lessonId: command.lessonId,
    authorId: command.actor.id,
    body: validated.body,
    highlighted: isHighlighted(command.actor.id, context.courseAuthorId),
    ...(command.parentId ? { parentId: command.parentId } : {}),
  });

  return { status: 201, comment };
}


export interface DeleteCommentCommand {
  actor: Actor;
  actorName: string;
  commentId: string;
}

export type DeleteCommentOutcome = { status: 204 } | { status: 403 | 404; error: string };

/**
 * Remove um comentário.
 *
 * Quem escreveu apaga o próprio; o instrutor modera o que está no curso dele.
 * A regra vive em `can()` e é a mesma já coberta por teste — aqui só se busca
 * de quem é o comentário e de quem é o curso para poder perguntar.
 *
 * Comentário inexistente e comentário alheio devolvem o MESMO 404: distinguir
 * diria a quem tenta que aquele id existe.
 */
export async function deleteCommentUseCase(command: DeleteCommentCommand): Promise<DeleteCommentOutcome> {
  const ownership = await findCommentOwnership(command.commentId);
  if (!ownership) return { status: 404, error: "Comentário não encontrado." };

  const allowed = can(command.actor, "delete", {
    kind: "comment",
    authorId: ownership.authorId,
    courseAuthorId: ownership.courseAuthorId,
  });

  if (!allowed) return { status: 404, error: "Comentário não encontrado." };

  await softDeleteComment(command.commentId);

  /* Moderação de conteúdo alheio é ação de responsabilidade: fica registrada.
     Apagar o próprio comentário é rotina e não polui a auditoria. */
  if (ownership.authorId !== command.actor.id) {
    await recordAudit({
      actorId: command.actor.id,
      actorName: command.actorName,
      action: "comment_deleted",
      target: `comentário ${command.commentId}`,
      outcome: "allowed",
    });
  }

  return { status: 204 };
}

export interface VoteCommand {
  actor: Actor;
  commentId: string;
  voted: boolean;
}

export type VoteOutcome =
  | { status: 200; upvotes: number }
  | { status: 400 | 403 | 404; error: string };

/**
 * Marca ou desmarca "útil" num comentário.
 *
 * A regra é a mesma de comentar: participa da conversa quem cursa a aula, mais
 * o autor do curso. Sem isso, qualquer conta autenticada inflaria a contagem
 * de um curso que nem pode abrir, bastando o id do comentário.
 *
 * Votar no próprio comentário é permitido de propósito — é ruído irrelevante
 * perto do custo de explicar a recusa, e nenhuma decisão depende do número.
 *
 * Fora da auditoria: voto é sinal de leitura, não ação sensível.
 */
export async function voteCommentUseCase(command: VoteCommand): Promise<VoteOutcome> {
  const ownership = await findCommentOwnership(command.commentId);
  if (!ownership) return { status: 404, error: "Comentário não encontrado." };

  const context = await findCommentContext(ownership.lessonId, command.actor.id);
  if (!context) return { status: 404, error: "Comentário não encontrado." };

  const allowed = can(command.actor, "comment", {
    kind: "comment",
    authorId: command.actor.id,
    courseAuthorId: context.courseAuthorId,
  });
  const isAuthor = context.courseAuthorId === command.actor.id;

  if (!allowed || (!isAuthor && !context.enrolled)) {
    return { status: 403, error: "Matricule-se no curso para participar da conversa." };
  }

  const upvotes = await setCommentVote(command.commentId, command.actor.id, command.voted);
  return { status: 200, upvotes };
}


export interface EditCommentCommand {
  actor: Actor;
  commentId: string;
  body: string;
}

export type EditCommentOutcome =
  | { status: 200; body: string; editedAt: string }
  | { status: 400 | 404; error: string };

/**
 * Edição de comentário.
 *
 * Só o autor edita — nem o instrutor, nem o admin. Moderar é remover, e
 * remover deixa rastro; reescrever a fala de outra pessoa mantendo o nome dela
 * embaixo seria pôr palavras na boca de alguém. `can()` já expressa isso:
 * `update` sobre comentário exige autoria, enquanto `delete` aceita o
 * instrutor do curso.
 *
 * A recusa é 404, não 403: confirmar que o comentário existe permitiria varrer
 * ids para descobrir o que há em cursos alheios.
 *
 * Sem auditoria: editar o que se escreveu é rotina, e `edited_at` já é o
 * registro visível de que houve mudança.
 */
export async function editCommentUseCase(
  command: EditCommentCommand,
): Promise<EditCommentOutcome> {
  const ownership = await findCommentOwnership(command.commentId);
  if (!ownership) return { status: 404, error: "Comentário não encontrado." };

  const allowed = can(command.actor, "update", {
    kind: "comment",
    authorId: ownership.authorId,
    courseAuthorId: ownership.courseAuthorId,
  });
  if (!allowed) return { status: 404, error: "Comentário não encontrado." };

  const validated = validateComment(command.body);
  if (!validated.ok) {
    return { status: 400, error: COMMENT_REFUSAL_MESSAGE[validated.reason] };
  }

  const updated = await updateComment(command.commentId, command.actor.id, validated.body);
  if (!updated) return { status: 404, error: "Comentário não encontrado." };

  /* A hora vem daqui e não do banco: uma segunda consulta só para ler
     `edited_at` não se justifica, e a diferença é de milissegundos. */
  return { status: 200, body: validated.body, editedAt: new Date().toISOString() };
}
