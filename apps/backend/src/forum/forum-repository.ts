import { query } from "../db/pool.ts";

/**
 * Fórum do curso — F4-01.
 */

export interface ForumTopic {
  id: string;
  courseId: string;
  authorId?: string;
  authorName: string;
  title: string;
  body: string;
  pinned: boolean;
  closed: boolean;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  /** Quem está lendo acompanha este tópico? */
  subscribed: boolean;
}

export interface ForumPost {
  id: string;
  topicId: string;
  authorId?: string;
  authorName: string;
  body: string;
  parentId?: string;
  createdAt: string;
  editedAt?: string;
  hidden: boolean;
  hiddenReason?: string;
  /** Quantas denúncias — só o moderador vê. */
  reportCount: number;
}

/**
 * Os tópicos de um curso.
 *
 * Ordena por FIXADO e depois por última atividade, não por criação: um tópico
 * de março com resposta hoje é mais relevante que um de ontem sem nenhuma.
 */
export async function findTopics(courseId: string, viewerId: string): Promise<ForumTopic[]> {
  const rows = await query<{
    id: string;
    course_id: string;
    author_id: string | null;
    author_name: string | null;
    title: string;
    body: string;
    pinned: boolean;
    closed: boolean;
    created_at: Date;
    last_activity_at: Date;
    reply_count: string;
    subscribed: boolean;
  }>(
    `SELECT t.id, t.course_id, t.author_id, u.full_name AS author_name,
            t.title, t.body, t.pinned, t.closed, t.created_at, t.last_activity_at,
            (SELECT count(*) FROM forum_posts p
              WHERE p.topic_id = t.id AND p.hidden_at IS NULL) AS reply_count,
            EXISTS (SELECT 1 FROM forum_subscriptions s
                     WHERE s.topic_id = t.id AND s.user_id = $2) AS subscribed
       FROM forum_topics t
       LEFT JOIN users u ON u.id = t.author_id
      WHERE t.course_id = $1
      ORDER BY t.pinned DESC, t.last_activity_at DESC`,
    [courseId, viewerId],
  );

  return rows.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    /* Autor removido vira "Usuário removido", não sumiço: a conversa continua
       fazendo sentido, e apagar o nome apagaria o contexto de quem lê. */
    authorName: row.author_name ?? "Usuário removido",
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    closed: row.closed,
    createdAt: row.created_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    replyCount: Number(row.reply_count),
    subscribed: row.subscribed,
    ...(row.author_id ? { authorId: row.author_id } : {}),
  }));
}

/** Um tópico. */
export async function findTopic(topicId: string, viewerId: string): Promise<ForumTopic | null> {
  const rows = await query<{
    id: string;
    course_id: string;
    author_id: string | null;
    author_name: string | null;
    title: string;
    body: string;
    pinned: boolean;
    closed: boolean;
    created_at: Date;
    last_activity_at: Date;
    reply_count: string;
    subscribed: boolean;
  }>(
    `SELECT t.id, t.course_id, t.author_id, u.full_name AS author_name,
            t.title, t.body, t.pinned, t.closed, t.created_at, t.last_activity_at,
            (SELECT count(*) FROM forum_posts p
              WHERE p.topic_id = t.id AND p.hidden_at IS NULL) AS reply_count,
            EXISTS (SELECT 1 FROM forum_subscriptions s
                     WHERE s.topic_id = t.id AND s.user_id = $2) AS subscribed
       FROM forum_topics t
       LEFT JOIN users u ON u.id = t.author_id
      WHERE t.id = $1
      LIMIT 1`,
    [topicId, viewerId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    courseId: row.course_id,
    authorName: row.author_name ?? "Usuário removido",
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    closed: row.closed,
    createdAt: row.created_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    replyCount: Number(row.reply_count),
    subscribed: row.subscribed,
    ...(row.author_id ? { authorId: row.author_id } : {}),
  };
}

/**
 * As respostas de um tópico.
 *
 * `canModerate` decide o que fazer com o que está oculto: o moderador vê tudo,
 * com a marca; quem lê não vê. Filtrar no SQL para quem não modera é mais
 * seguro que filtrar na tela — a mensagem oculta não chega ao navegador.
 */
export async function findPosts(topicId: string, canModerate: boolean): Promise<ForumPost[]> {
  const rows = await query<{
    id: string;
    topic_id: string;
    author_id: string | null;
    author_name: string | null;
    body: string;
    parent_id: string | null;
    created_at: Date;
    edited_at: Date | null;
    hidden_at: Date | null;
    hidden_reason: string | null;
    report_count: string;
  }>(
    `SELECT p.id, p.topic_id, p.author_id, u.full_name AS author_name, p.body,
            p.parent_id, p.created_at, p.edited_at, p.hidden_at, p.hidden_reason,
            (SELECT count(*) FROM forum_reports r WHERE r.post_id = p.id) AS report_count
       FROM forum_posts p
       LEFT JOIN users u ON u.id = p.author_id
      WHERE p.topic_id = $1
        AND ($2::bool OR p.hidden_at IS NULL)
      ORDER BY p.created_at`,
    [topicId, canModerate],
  );

  return rows.map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    authorName: row.author_name ?? "Usuário removido",
    body: row.body,
    createdAt: row.created_at.toISOString(),
    hidden: row.hidden_at !== null,
    /* A contagem de denúncias só sai para quem modera: mostrá-la a todos
       transformaria o fórum em placar de reprovação. */
    reportCount: canModerate ? Number(row.report_count) : 0,
    ...(row.author_id ? { authorId: row.author_id } : {}),
    ...(row.parent_id ? { parentId: row.parent_id } : {}),
    ...(row.edited_at ? { editedAt: row.edited_at.toISOString() } : {}),
    ...(row.hidden_reason && canModerate ? { hiddenReason: row.hidden_reason } : {}),
  }));
}

export async function createTopic(input: {
  tenantId: string;
  courseId: string;
  authorId: string;
  title: string;
  body: string;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO forum_topics (tenant_id, course_id, author_id, title, body)
     VALUES ($1, $2, $3, btrim($4), btrim($5))
     RETURNING id`,
    [input.tenantId, input.courseId, input.authorId, input.title, input.body],
  );

  const id = rows[0]!.id;

  /* Quem abre o tópico o acompanha por padrão: perguntou, quer a resposta. */
  await subscribe(id, input.authorId);
  return id;
}

/**
 * Cria a resposta e atualiza a atividade do tópico.
 *
 * As duas coisas numa instrução só: se a segunda falhasse, a resposta existiria
 * sem subir o tópico na lista, e ninguém a veria.
 */
export async function createPost(input: {
  topicId: string;
  authorId: string;
  body: string;
  parentId?: string | null;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `WITH nova AS (
       INSERT INTO forum_posts (topic_id, author_id, body, parent_id)
       VALUES ($1, $2, btrim($3), $4)
       RETURNING id, topic_id
     ),
     toque AS (
       UPDATE forum_topics SET last_activity_at = now()
        WHERE id = (SELECT topic_id FROM nova)
       RETURNING 1
     )
     SELECT id FROM nova`,
    [input.topicId, input.authorId, input.body, input.parentId ?? null],
  );

  return rows[0]!.id;
}

/** Fixa/desafixa ou fecha/reabre. */
export async function setTopicFlags(
  topicId: string,
  flags: { pinned?: boolean; closed?: boolean },
): Promise<void> {
  await query(
    `UPDATE forum_topics
        SET pinned = COALESCE($2, pinned),
            closed = COALESCE($3, closed)
      WHERE id = $1`,
    [topicId, flags.pinned ?? null, flags.closed ?? null],
  );
}

/**
 * Oculta ou revela uma mensagem.
 *
 * Ocultar não apaga: o guia §16 pede histórico, e apagar impediria auditar por
 * que a mensagem saiu. As três colunas andam juntas por CHECK.
 */
export async function moderatePost(
  postId: string,
  hide: boolean,
  moderatorId: string,
  reason: string | null,
): Promise<void> {
  if (hide) {
    await query(
      `UPDATE forum_posts SET hidden_at = now(), hidden_by = $2, hidden_reason = $3
        WHERE id = $1`,
      [postId, moderatorId, reason],
    );
    return;
  }

  await query(
    `UPDATE forum_posts SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
      WHERE id = $1`,
    [postId],
  );
}

/** Registra uma denúncia. Repetida pela mesma pessoa não conta de novo. */
export async function reportPost(
  postId: string,
  reporterId: string,
  reason: string,
): Promise<void> {
  await query(
    `INSERT INTO forum_reports (post_id, reporter_id, reason)
     VALUES ($1, $2, btrim($3))
     ON CONFLICT (post_id, reporter_id) DO NOTHING`,
    [postId, reporterId, reason],
  );
}

export async function subscribe(topicId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO forum_subscriptions (topic_id, user_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [topicId, userId],
  );
}

export async function unsubscribe(topicId: string, userId: string): Promise<void> {
  await query(`DELETE FROM forum_subscriptions WHERE topic_id = $1 AND user_id = $2`, [
    topicId,
    userId,
  ]);
}

/**
 * Quem acompanha o tópico, exceto quem acabou de escrever.
 *
 * Notificar o autor da própria resposta seria ruído — ele sabe que respondeu.
 */
export async function findSubscribers(topicId: string, exceptId: string): Promise<string[]> {
  const rows = await query<{ user_id: string }>(
    `SELECT user_id FROM forum_subscriptions WHERE topic_id = $1 AND user_id <> $2`,
    [topicId, exceptId],
  );

  return rows.map((row) => row.user_id);
}
