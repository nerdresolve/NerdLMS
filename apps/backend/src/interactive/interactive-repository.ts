import type {
  InteractiveContent,
  InteractiveItem,
  InteractiveKind,
  InteractiveOption,
  ResponseRecord,
} from "@nerdlms/core/interactive/interactive.ts";

import { query, withTransaction } from "../db/pool.ts";

/**
 * Conteúdo interativo — F6-05.
 *
 * O gabarito vive aqui e NÃO sai daqui montado: quem serializa para o navegador
 * usa `toPublicItem` do core, e este módulo devolve o item completo só para o
 * servidor conferir a resposta.
 */

interface ContentDbRow {
  id: string;
  kind: string;
  title: string;
  media_key: string | null;
  media_url: string | null;
  required_interactions: number | null;
  items:
    | Array<{
        id: string;
        position: number;
        atSeconds: number | null;
        xPercent: string | null;
        yPercent: string | null;
        prompt: string;
        body: string | null;
        options: InteractiveOption[];
        blocking: boolean;
      }>
    | null;
}

function toContent(row: ContentDbRow): InteractiveContent {
  return {
    id: row.id,
    kind: row.kind as InteractiveKind,
    title: row.title,
    /* A URL direta ganha da chave de storage: conteúdo interativo pode apontar
       para um vídeo externo, e nesse caso não há arquivo nosso. */
    mediaUrl: row.media_url ?? (row.media_key ? `/api/materiais/${row.media_key}` : null),
    requiredInteractions: row.required_interactions,
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      position: item.position,
      atSeconds: item.atSeconds,
      /* `numeric` chega como texto no driver. */
      xPercent: item.xPercent === null ? null : Number(item.xPercent),
      yPercent: item.yPercent === null ? null : Number(item.yPercent),
      prompt: item.prompt,
      body: item.body,
      options: Array.isArray(item.options) ? item.options : [],
      blocking: item.blocking,
    })),
  };
}

const SELECT_CONTENT = `
  SELECT c.id, c.kind, c.title, c.media_key, c.media_url, c.required_interactions,
         (SELECT jsonb_agg(jsonb_build_object(
                   'id', i.id,
                   'position', i.position,
                   'atSeconds', i.at_seconds,
                   'xPercent', i.x_percent,
                   'yPercent', i.y_percent,
                   'prompt', i.prompt,
                   'body', i.body,
                   'options', i.options,
                   'blocking', i.blocking) ORDER BY i.position, i.at_seconds)
            FROM interactive_items i
           WHERE i.content_id = c.id) AS items
    FROM interactive_content c
   WHERE c.tenant_id = $1`;

/** O conteúdo interativo de uma aula, COM gabarito. Só para o servidor. */
export async function findInteractiveOfLesson(
  tenantId: string,
  lessonId: string,
): Promise<InteractiveContent | null> {
  const rows = await query<ContentDbRow>(`${SELECT_CONTENT} AND c.lesson_id = $2 LIMIT 1`, [
    tenantId,
    lessonId,
  ]);

  return rows[0] ? toContent(rows[0]) : null;
}

/** Um item pelo id, para conferir a resposta. */
export async function findItem(
  tenantId: string,
  itemId: string,
): Promise<{ item: InteractiveItem; contentId: string; lessonId: string } | null> {
  const rows = await query<{
    id: string;
    content_id: string;
    lesson_id: string;
    position: number;
    at_seconds: number | null;
    x_percent: string | null;
    y_percent: string | null;
    prompt: string;
    body: string | null;
    options: InteractiveOption[];
    blocking: boolean;
  }>(
    `SELECT i.id, i.content_id, c.lesson_id, i.position, i.at_seconds,
            i.x_percent, i.y_percent, i.prompt, i.body, i.options, i.blocking
       FROM interactive_items i
       JOIN interactive_content c ON c.id = i.content_id
      WHERE c.tenant_id = $1 AND i.id = $2
      LIMIT 1`,
    [tenantId, itemId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    contentId: row.content_id,
    lessonId: row.lesson_id,
    item: {
      id: row.id,
      position: row.position,
      atSeconds: row.at_seconds,
      xPercent: row.x_percent === null ? null : Number(row.x_percent),
      yPercent: row.y_percent === null ? null : Number(row.y_percent),
      prompt: row.prompt,
      body: row.body,
      options: Array.isArray(row.options) ? row.options : [],
      blocking: row.blocking,
    },
  };
}

/** As respostas de uma matrícula neste conteúdo. */
export async function findResponses(
  enrollmentId: string,
  contentId: string,
): Promise<ResponseRecord[]> {
  const rows = await query<{
    item_id: string;
    answer: string | null;
    correct: boolean | null;
    attempts: number;
  }>(
    `SELECT r.item_id, r.answer, r.correct, r.attempts
       FROM interactive_responses r
       JOIN interactive_items i ON i.id = r.item_id
      WHERE r.enrollment_id = $1 AND i.content_id = $2`,
    [enrollmentId, contentId],
  );

  return rows.map((row) => ({
    itemId: row.item_id,
    answer: row.answer,
    correct: row.correct,
    attempts: row.attempts,
  }));
}

/**
 * Grava a resposta.
 *
 * Tentar de novo ATUALIZA e incrementa o contador, em vez de criar outra linha:
 * conteúdo interativo existe para aprender, e o que interessa é a resposta
 * final e quantas tentativas foram precisas — não o histórico completo, que
 * seria ruído.
 */
export async function recordResponse(input: {
  itemId: string;
  enrollmentId: string;
  answer: string | null;
  correct: boolean | null;
}): Promise<number> {
  const rows = await query<{ attempts: number }>(
    `INSERT INTO interactive_responses (item_id, enrollment_id, answer, correct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (item_id, enrollment_id) DO UPDATE
       SET answer = EXCLUDED.answer,
           correct = EXCLUDED.correct,
           attempts = interactive_responses.attempts + 1,
           last_at = now()
     RETURNING attempts`,
    [input.itemId, input.enrollmentId, input.answer, input.correct],
  );

  return rows[0]?.attempts ?? 1;
}

export interface NewInteractive {
  tenantId: string;
  lessonId: string;
  kind: InteractiveKind;
  title: string;
  mediaUrl: string | null;
  requiredInteractions: number | null;
  items: Array<{
    position: number;
    atSeconds: number | null;
    xPercent: number | null;
    yPercent: number | null;
    prompt: string;
    body: string | null;
    options: InteractiveOption[];
    blocking: boolean;
  }>;
}

/**
 * Cria (ou substitui) o conteúdo interativo de uma aula.
 *
 * Substituir apaga as respostas junto, por cascata — e isso é o certo: as
 * respostas eram de perguntas que não existem mais. Guardá-las deixaria a conta
 * de conclusão fechando por causa de conteúdo que ninguém vê.
 */
export async function saveInteractive(input: NewInteractive): Promise<string> {
  return withTransaction(async (exec) => {
    await exec(
      `DELETE FROM interactive_content WHERE tenant_id = $1 AND lesson_id = $2`,
      [input.tenantId, input.lessonId],
    );

    const criado = await exec<{ id: string }>(
      `INSERT INTO interactive_content
              (tenant_id, lesson_id, kind, title, media_url, required_interactions)
       VALUES ($1, $2, $3, btrim($4), $5, $6)
       RETURNING id`,
      [
        input.tenantId,
        input.lessonId,
        input.kind,
        input.title,
        input.mediaUrl,
        input.requiredInteractions,
      ],
    );

    const contentId = criado[0]!.id;

    if (input.items.length > 0) {
      /* `unnest` para uma instrução só: uma por item abriria uma janela em que
         o conteúdo existe com metade das perguntas. */
      await exec(
        `INSERT INTO interactive_items
                (content_id, position, at_seconds, x_percent, y_percent,
                 prompt, body, options, blocking)
         SELECT $1, t.pos, t.at, t.x, t.y, t.prompt, t.body, t.options::jsonb, t.blocking
           FROM unnest($2::int[], $3::int[], $4::numeric[], $5::numeric[],
                       $6::text[], $7::text[], $8::text[], $9::bool[])
             AS t(pos, at, x, y, prompt, body, options, blocking)`,
        [
          contentId,
          input.items.map((i) => i.position),
          input.items.map((i) => i.atSeconds),
          input.items.map((i) => i.xPercent),
          input.items.map((i) => i.yPercent),
          input.items.map((i) => i.prompt),
          input.items.map((i) => i.body),
          input.items.map((i) => JSON.stringify(i.options)),
          input.items.map((i) => i.blocking),
        ],
      );
    }

    /* A aula passa a ser do tipo `interactive`: é o que faz o player certo
       abrir. Sem isto o conteúdo existiria e ninguém o veria. */
    await exec(`UPDATE lessons SET kind = 'interactive' WHERE id = $1`, [input.lessonId]);

    return contentId;
  });
}

export interface ItemStat {
  itemId: string;
  prompt: string;
  answered: number;
  correct: number;
  /** Média de tentativas — o número que revela pergunta mal escrita. */
  averageAttempts: number;
}

/**
 * Como cada interação se saiu.
 *
 * É a pergunta que justifica ter conteúdo interativo em vez de vídeo comum:
 * "quantas pessoas erraram a pergunta dos 4 minutos?". Média de tentativas alta
 * costuma dizer que a pergunta está mal escrita, não que a turma é fraca.
 */
export async function itemStats(
  tenantId: string,
  lessonId: string,
): Promise<ItemStat[]> {
  const rows = await query<{
    item_id: string;
    prompt: string;
    answered: string;
    correct: string;
    media: string | null;
  }>(
    `SELECT i.id AS item_id, i.prompt,
            count(r.id)                              AS answered,
            count(r.id) FILTER (WHERE r.correct)     AS correct,
            avg(r.attempts)                          AS media
       FROM interactive_items i
       JOIN interactive_content c ON c.id = i.content_id
       LEFT JOIN interactive_responses r ON r.item_id = i.id
      WHERE c.tenant_id = $1 AND c.lesson_id = $2
      GROUP BY i.id, i.prompt, i.position
      ORDER BY i.position`,
    [tenantId, lessonId],
  );

  return rows.map((row) => ({
    itemId: row.item_id,
    prompt: row.prompt,
    answered: Number(row.answered),
    correct: Number(row.correct),
    averageAttempts: row.media === null ? 0 : Math.round(Number(row.media) * 10) / 10,
  }));
}
