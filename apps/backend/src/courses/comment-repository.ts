import type { Comment } from "@nerdlms/core/courses/types.ts";

import { query } from "../db/pool.ts";

/**
 * Comentários de aula.
 *
 * `deleted_at` existe na tabela e as consultas o respeitam: comentário
 * removido some da tela mas continua no banco, porque apagar de vez levaria
 * junto as respostas que penduram nele.
 */

export interface CommentContext {
  lessonId: string;
  courseId: string;
  courseAuthorId: string;
  enrolled: boolean;
}

interface ContextRow {
  lesson_id: string;
  course_id: string;
  course_author_id: string;
  enrollment_id: string | null;
}

/**
 * Onde a aula está e se o autor participa do curso.
 *
 * Devolve `null` quando a aula não existe. Matrícula ausente **não** é null:
 * quem decide o que fazer com isso é a regra, e o instrutor do curso comenta
 * sem estar matriculado nele.
 */
export async function findCommentContext(
  lessonId: string,
  userId: string,
): Promise<CommentContext | null> {
  const rows = await query<ContextRow>(
    `SELECT l.id        AS lesson_id,
            c.id        AS course_id,
            c.author_id AS course_author_id,
            e.id        AS enrollment_id
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.learner_id = $2
      WHERE l.id = $1
      LIMIT 1`,
    [lessonId, userId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    lessonId: row.lesson_id,
    courseId: row.course_id,
    courseAuthorId: row.course_author_id,
    enrolled: row.enrollment_id !== null,
  };
}

interface CommentRow {
  id: string;
  lesson_id: string;
  author_id: string;
  author_name: string;
  parent_id: string | null;
  body: string;
  highlighted: boolean;
  created_at: Date;
  /* Nulo até a primeira edição. */
  edited_at?: Date | null;
  /* Ausentes em `createComment`, que devolve o comentário recém-criado: ele
     nasce com zero voto e sem voto de quem o escreveu. */
  upvotes?: string | number;
  voted?: boolean;
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    highlighted: row.highlighted,
    /* `count(*)` volta como string no driver: sem o Number, "10" < "9" na
       ordenação e a soma vira concatenação. */
    upvotes: Number(row.upvotes ?? 0),
    votedByViewer: row.voted === true,
    ...(row.edited_at ? { editedAt: row.edited_at.toISOString() } : {}),
    ...(row.parent_id ? { parentId: row.parent_id } : {}),
  };
}

/**
 * Comentários da aula, do mais antigo para o mais recente.
 *
 * A contagem de votos vem junto, por subconsulta, e não em outra chamada: uma
 * consulta por comentário seria o N+1 clássico numa aula com discussão longa.
 *
 * `viewerId` decide o estado inicial do botão. Sem ele a pessoa marcaria como
 * útil algo que já marcou, e só descobriria ao recarregar.
 */
export async function findComments(lessonId: string, viewerId: string): Promise<Comment[]> {
  const rows = await query<CommentRow>(
    `SELECT c.id, c.lesson_id, c.author_id, u.full_name AS author_name,
            c.parent_id, c.body, c.highlighted, c.created_at, c.edited_at,
            (SELECT count(*) FROM comment_votes v WHERE v.comment_id = c.id)     AS upvotes,
            EXISTS (SELECT 1 FROM comment_votes v
                     WHERE v.comment_id = c.id AND v.voter_id = $2)              AS voted
       FROM comments c
       JOIN users u ON u.id = c.author_id
      WHERE c.lesson_id = $1
        AND c.deleted_at IS NULL
      ORDER BY c.created_at`,
    [lessonId, viewerId],
  );

  return rows.map(toComment);
}

/**
 * Marca ou desmarca "útil".
 *
 * A chave primária é (comment_id, voter_id), então o banco já impede voto
 * repetido — `ON CONFLICT DO NOTHING` transforma o clique duplo em operação
 * inofensiva em vez de erro.
 *
 * Devolve a contagem depois da mudança: o cliente pinta o número otimista, mas
 * quem manda é este valor. Se dois navegadores votarem ao mesmo tempo, ambos
 * convergem para o total real.
 */
export async function setCommentVote(
  commentId: string,
  voterId: string,
  voted: boolean,
): Promise<number> {
  if (voted) {
    await query(
      `INSERT INTO comment_votes (comment_id, voter_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [commentId, voterId],
    );
  } else {
    await query(`DELETE FROM comment_votes WHERE comment_id = $1 AND voter_id = $2`, [
      commentId,
      voterId,
    ]);
  }

  const rows = await query<{ total: string }>(
    `SELECT count(*) AS total FROM comment_votes WHERE comment_id = $1`,
    [commentId],
  );
  return Number(rows[0]?.total ?? 0);
}

export interface NewComment {
  lessonId: string;
  authorId: string;
  body: string;
  highlighted: boolean;
  parentId?: string;
}

/** Publica o comentário e devolve como ele ficou. */
export async function createComment(input: NewComment): Promise<Comment> {
  const rows = await query<CommentRow>(
    `WITH inserido AS (
       INSERT INTO comments (lesson_id, author_id, parent_id, body, highlighted)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, lesson_id, author_id, parent_id, body, highlighted, created_at
     )
     SELECT i.*, u.full_name AS author_name
       FROM inserido i
       JOIN users u ON u.id = i.author_id`,
    [input.lessonId, input.authorId, input.parentId ?? null, input.body, input.highlighted],
  );

  const row = rows[0];
  if (!row) throw new Error("Comentário não pôde ser publicado.");
  return toComment(row);
}

/** Dono do comentário e autor do curso: o que a regra de exclusão precisa. */
export interface CommentOwnership {
  authorId: string;
  courseAuthorId: string;
  /** A aula onde o comentário vive — o voto precisa dela para checar matrícula. */
  lessonId: string;
}

/** Quem escreveu o comentário e de quem é o curso. `null` se não existe. */
export async function findCommentOwnership(commentId: string): Promise<CommentOwnership | null> {
  const rows = await query<{ author_id: string; course_author_id: string; lesson_id: string }>(
    `SELECT cm.author_id, cm.lesson_id, c.author_id AS course_author_id
       FROM comments cm
       JOIN lessons l ON l.id = cm.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE cm.id = $1 AND cm.deleted_at IS NULL
      LIMIT 1`,
    [commentId],
  );

  const row = rows[0];
  return row
    ? { authorId: row.author_id, courseAuthorId: row.course_author_id, lessonId: row.lesson_id }
    : null;
}

/**
 * Reescreve o corpo do comentário.
 *
 * `edited_at` passa a valer: a tela mostra "editado" a partir daí, e sem essa
 * marca uma pessoa poderia trocar o que disse depois de alguém responder, sem
 * deixar sinal. A coluna já existia na tabela e nunca havia sido usada.
 *
 * O `author_id` entra no WHERE além do id — a permissão já foi checada no caso
 * de uso, mas o filtro aqui é a segunda tranca: um id trocado no corpo da
 * requisição não encontra linha.
 */
export async function updateComment(
  commentId: string,
  authorId: string,
  body: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE comments SET body = $3, edited_at = now()
      WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
      RETURNING id`,
    [commentId, authorId, body],
  );
  return rows.length > 0;
}

/**
 * Marca o comentário como removido.
 *
 * `deleted_at` em vez de `DELETE`: as respostas penduradas nele continuam
 * existindo, e a auditoria de moderação precisa do registro. As consultas de
 * leitura já filtram por `deleted_at IS NULL`.
 */
export async function softDeleteComment(commentId: string): Promise<void> {
  await query(`UPDATE comments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [commentId]);
}
