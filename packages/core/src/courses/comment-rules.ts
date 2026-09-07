/**
 * Regras de publicação de comentário.
 *
 * O voto já tem casa em `social.ts`; aqui fica o que decide se um texto pode
 * virar comentário, e quem aparece com a tag de professor.
 */

export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 4000;

export type CommentRefusal = "empty" | "too_long";

export const COMMENT_REFUSAL_MESSAGE: Record<CommentRefusal, string> = {
  empty: "Escreva algo antes de publicar.",
  too_long: `O comentário pode ter no máximo ${COMMENT_MAX_LENGTH} caracteres.`,
};

export type CommentDecision =
  | { ok: true; body: string }
  | { ok: false; reason: CommentRefusal };

/**
 * Valida e normaliza o texto.
 *
 * O corte de espaços acontece **antes** da medida: um comentário de vinte
 * espaços é vazio, e aceitar isso encheria a aula de linhas em branco. O
 * limite de 4000 espelha o `CHECK` da tabela — validar só no banco daria um
 * erro de constraint em vez de uma mensagem legível.
 */
export function validateComment(raw: string): CommentDecision {
  const body = raw.trim();

  if (body.length < COMMENT_MIN_LENGTH) return { ok: false, reason: "empty" };
  if (body.length > COMMENT_MAX_LENGTH) return { ok: false, reason: "too_long" };

  return { ok: true, body };
}

/**
 * Decide se o comentário sai com a tag de professor.
 *
 * A tag identifica **autoria do conteúdo**, não hierarquia: quem escreveu o
 * curso responde como professor nele. Um admin comentando num curso alheio é
 * só mais uma pessoa na conversa — e é por isso que a decisão é do servidor, e
 * nunca um campo que o cliente envia (PRD §8).
 */
export function isHighlighted(authorId: string, courseAuthorId: string): boolean {
  return authorId === courseAuthorId;
}
