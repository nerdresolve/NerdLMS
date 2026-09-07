import type { ContentKind } from "@nerdlms/core/courses/content.ts";

import { query } from "../db/pool.ts";

/**
 * Gravação de progresso.
 *
 * A escrita é uma instrução só, com a decisão dentro do SQL. Ler o valor atual
 * na aplicação, decidir, e então gravar abriria uma janela entre a leitura e a
 * escrita: duas abas do mesmo aluno, ou o player enviando duas posições
 * seguidas, poderiam fazer a menor sobrescrever a maior.
 *
 * `GREATEST` no `ON CONFLICT` resolve isso no próprio banco — o progresso
 * nunca retrocede, mesmo com escritas concorrentes.
 */

export interface ProgressTarget {
  learnerId: string;
  lessonId: string;
}

export interface ProgressContext {
  enrollmentId: string;
  courseId: string;
  courseAuthorId: string;
  courseTitle: string;
  courseSlug: string;
  lessonTitle: string;
  durationSeconds: number;
  watchedSeconds: number;
  /**
   * Instante do último registro de posição. Nulo na primeira vez.
   *
   * É o relógio contra o qual a trava do player mede o avanço — ver
   * `packages/core/src/courses/watch-guard.ts`.
   */
  progressUpdatedAt: Date | null;
  /** `manual` impede que o consumo conclua a aula sozinho. */
  completionMode: "auto" | "manual";
  /**
   * A trava do player vale neste curso?
   *
   * Vem do curso, e não da aula: a decisão é sobre o treinamento inteiro. Um
   * curso com metade das aulas travadas seria incompreensível para quem
   * assiste.
   */
  watchGuard: boolean;
  /** Já concluída? Impede reescrever a data da conclusão. */
  alreadyCompleted: boolean;

  /**
   * A regra de conclusão da aula de conteúdo, quando é uma.
   *
   * Ausente na aula de vídeo, onde o critério é o consumo. Presente quando há
   * páginas a percorrer ou tempo mínimo a cumprir.
   */
  contentRule?: { kind: ContentKind; pageCount?: number; minSeconds?: number };
  pagesSeen: number[];
  secondsOnPage: number;
}

interface ContextRow {
  enrollment_id: string;
  course_id: string;
  course_author_id: string;
  course_title: string;
  course_slug: string;
  lesson_title: string;
  duration_seconds: number;
  watched_seconds: number | null;
  completion_mode: "auto" | "manual";
  completed_at: Date | null;
  kind: ContentKind | null;
  page_count: number | null;
  min_seconds: number | null;
  pages_seen: number[] | null;
  seconds_on_page: number | null;
  progress_updated_at: Date | null;
  watch_guard: boolean | null;
}

/**
 * Onde a aula está e quanto o aluno já assistiu dela.
 *
 * Devolve `null` quando a aula não existe **ou** o aluno não está matriculado
 * no curso dela — a mesma resposta nos dois casos, para que trocar o id na URL
 * não revele quais aulas existem.
 */
export async function findProgressContext(target: ProgressTarget): Promise<ProgressContext | null> {
  const rows = await query<ContextRow>(
    `SELECT e.id            AS enrollment_id,
            c.id            AS course_id,
            c.author_id     AS course_author_id,
            /* Títulos e slug para o statement xAPI (F6-03): o IRI do objeto e o
               nome legível saem daqui, e a consulta já tinha as duas tabelas —
               buscá-los depois seriam duas idas ao banco por aula concluída. */
            c.title         AS course_title,
            c.slug          AS course_slug,
            l.title         AS lesson_title,
            l.duration_seconds,
            l.completion_mode, l.kind, l.page_count, l.min_seconds,
            lp.watched_seconds,
            /* Quando a posição foi gravada pela última vez.

               É o relógio contra o qual a trava do player mede: o avanço entre
               dois registros não pode passar do tempo real decorrido vezes a
               velocidade máxima. Sem esta coluna, um único envio com a duração
               inteira seria indistinguível de alguém que assistiu. */
            lp.updated_at   AS progress_updated_at,
            c.watch_guard,
            lp.completed_at, lp.pages_seen, lp.seconds_on_page
       FROM lessons l
       JOIN modules m     ON m.id = l.module_id
       JOIN courses c     ON c.id = m.course_id
       JOIN enrollments e ON e.course_id = c.id AND e.learner_id = $2
       LEFT JOIN lesson_progress lp
              ON lp.enrollment_id = e.id AND lp.lesson_id = l.id
      WHERE l.id = $1
      LIMIT 1`,
    [target.lessonId, target.learnerId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    enrollmentId: row.enrollment_id,
    courseId: row.course_id,
    courseAuthorId: row.course_author_id,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    lessonTitle: row.lesson_title,
    durationSeconds: row.duration_seconds,
    watchedSeconds: row.watched_seconds ?? 0,
    progressUpdatedAt: row.progress_updated_at ?? null,
    completionMode: row.completion_mode,
    /* `?? true` e não `?? false`: se a coluna faltar por qualquer motivo, o
       comportamento seguro é manter a trava. */
    watchGuard: row.watch_guard ?? true,
    alreadyCompleted: row.completed_at !== null,
    pagesSeen: row.pages_seen ?? [],
    secondsOnPage: row.seconds_on_page ?? 0,

    /* A regra só existe quando há o que percorrer ou cumprir. Uma aula de
       vídeo, ou um documento sem contagem de páginas e sem tempo mínimo, não
       tem critério de conteúdo — e inventar um travaria a conclusão. */
    ...(row.kind && row.kind !== "video" && (row.page_count || row.min_seconds)
      ? {
          contentRule: {
            kind: row.kind,
            ...(row.page_count ? { pageCount: row.page_count } : {}),
            ...(row.min_seconds ? { minSeconds: row.min_seconds } : {}),
          },
        }
      : {}),
  };
}

/**
 * Grava a posição assistida.
 *
 * `GREATEST` garante a regra "nunca retrocede" dentro da transação do banco, e
 * não só na decisão da aplicação: é a diferença entre uma regra e uma
 * expectativa.
 *
 * `completed_at` é definido uma vez e não se apaga — desmarcar conclusão porque
 * alguém reviu o começo seria punir quem revisa.
 */
export async function saveProgress(
  enrollmentId: string,
  lessonId: string,
  watchedSeconds: number,
  completed: boolean,
  lastPositionSeconds?: number,
): Promise<number> {
  /* A posição é onde o vídeo estava; o consumo é o ponto mais distante já
     alcançado. Quando quem chama não informa a posição, ela vale o consumo —
     é o que acontecia antes desta separação. */
  const posicao = lastPositionSeconds ?? watchedSeconds;

  const rows = await query<{ watched_seconds: number }>(
    `INSERT INTO lesson_progress
            (enrollment_id, lesson_id, watched_seconds, last_position_seconds,
             completed_at, completion_source)
     VALUES ($1, $2, $3, $5,
             CASE WHEN $4 THEN now() ELSE NULL END,
             CASE WHEN $4 THEN 'auto' ELSE NULL END)
     ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
       watched_seconds = GREATEST(lesson_progress.watched_seconds, EXCLUDED.watched_seconds),
       /* Esta NÃO usa GREATEST: quem volta para rever um trecho e sai precisa
          retomar dali. É a diferença entre as duas colunas. */
       last_position_seconds = EXCLUDED.last_position_seconds,
       completed_at      = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
       completion_source = COALESCE(lesson_progress.completion_source, EXCLUDED.completion_source),
       updated_at        = now()
     RETURNING watched_seconds`,
    [enrollmentId, lessonId, watchedSeconds, completed, posicao],
  );

  return rows[0]?.watched_seconds ?? watchedSeconds;
}

/**
 * Marca ou desmarca a conclusão manualmente.
 *
 * Existe separada de `saveProgress` porque não é a mesma operação: aqui não há
 * vídeo envolvido, e o progresso de consumo não muda. É o que permite concluir
 * uma aula de leitura — e desmarcar, que a conclusão automática nunca permite.
 *
 * `completed_by` guarda quem marcou. Na conclusão automática fica nulo:
 * ninguém apertou nada.
 */
export async function setManualCompletion(
  enrollmentId: string,
  lessonId: string,
  completed: boolean,
  actorId: string,
): Promise<void> {
  if (completed) {
    await query(
      `INSERT INTO lesson_progress
              (enrollment_id, lesson_id, watched_seconds, last_position_seconds,
               completed_at, completion_source, completed_by)
       VALUES ($1, $2, 0, 0, now(), 'manual', $3)
       ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
         completed_at      = COALESCE(lesson_progress.completed_at, now()),
         completion_source = COALESCE(lesson_progress.completion_source, 'manual'),
         completed_by      = COALESCE(lesson_progress.completed_by, EXCLUDED.completed_by),
         updated_at        = now()`,
      [enrollmentId, lessonId, actorId],
    );
    return;
  }

  /* Desmarcar limpa a conclusão e PRESERVA o consumo: quem assistiu assistiu,
     e apagar isso junto destruiria dado que ninguém pediu para destruir. As
     três colunas caem juntas por causa do CHECK de coerência. */
  await query(
    `UPDATE lesson_progress
        SET completed_at = NULL, completion_source = NULL, completed_by = NULL, updated_at = now()
      WHERE enrollment_id = $1 AND lesson_id = $2`,
    [enrollmentId, lessonId],
  );
}

/**
 * Registra que a pessoa passou por uma página do documento — F3 (aula de
 * conteúdo).
 *
 * A união acontece NO BANCO, não na aplicação: duas abas do mesmo documento, ou
 * duas viradas de página seguidas, sobrescreveriam uma à outra se cada uma
 * lesse o array, acrescentasse e gravasse. `array_agg(DISTINCT …)` resolve isso
 * na própria instrução — mesma razão do `GREATEST` no progresso de vídeo.
 */
export async function recordPageSeen(
  enrollmentId: string,
  lessonId: string,
  page: number,
): Promise<number[]> {
  const rows = await query<{ pages_seen: number[] }>(
    `INSERT INTO lesson_progress (enrollment_id, lesson_id, pages_seen)
     VALUES ($1, $2, ARRAY[$3::int])
     ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
       pages_seen = ARRAY(
         SELECT DISTINCT unnest(lesson_progress.pages_seen || ARRAY[$3::int]) ORDER BY 1
       ),
       updated_at = now()
     RETURNING pages_seen`,
    [enrollmentId, lessonId, page],
  );

  return rows[0]?.pages_seen ?? [];
}

/** Acumula segundos de permanência na aula. */
export async function addSecondsOnPage(
  enrollmentId: string,
  lessonId: string,
  seconds: number,
): Promise<void> {
  await query(
    `INSERT INTO lesson_progress (enrollment_id, lesson_id, seconds_on_page)
     VALUES ($1, $2, $3)
     ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
       seconds_on_page = lesson_progress.seconds_on_page + EXCLUDED.seconds_on_page,
       updated_at = now()`,
    [enrollmentId, lessonId, Math.max(0, Math.round(seconds))],
  );
}

/**
 * O curso está concluído — todas as aulas dele?
 *
 * Existe para as competências (F6-02): elas vêm da conclusão do CURSO, não da
 * aula. Conceder "sabe operar uma ETA" a quem viu o primeiro vídeo seria
 * afirmar algo que manda a pessoa errada para o campo.
 *
 * A contagem é feita no banco, e não trazendo o progresso para o Node: a
 * pergunta é um booleano, e carregar o histórico inteiro para respondê-la
 * custaria a cada aula concluída.
 */
export async function isCourseComplete(
  enrollmentId: string,
  courseId: string,
): Promise<boolean> {
  const rows = await query<{ completo: boolean }>(
    `SELECT (
       (SELECT count(*) FROM lessons l
          JOIN modules m ON m.id = l.module_id
         WHERE m.course_id = $2) > 0
       AND
       (SELECT count(*) FROM lessons l
          JOIN modules m ON m.id = l.module_id
         WHERE m.course_id = $2)
       = (SELECT count(*) FROM lesson_progress p
            JOIN lessons l ON l.id = p.lesson_id
            JOIN modules m ON m.id = l.module_id
           WHERE p.enrollment_id = $1 AND m.course_id = $2
             AND p.completed_at IS NOT NULL)
     ) AS completo`,
    [enrollmentId, courseId],
  );

  return rows[0]?.completo ?? false;
}
