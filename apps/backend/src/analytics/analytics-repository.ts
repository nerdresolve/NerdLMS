import type {
  AbandonedEnrollment,
  ActivityDay,
  LessonStep,
} from "@nerdlms/core/analytics/advanced.ts";

import { query } from "../db/pool.ts";

/**
 * Consultas do analytics avançado — F6-06 (guia §21).
 *
 * As contas ficam no core, puras e testadas. Aqui só o que exige o banco: somar
 * progresso de milhares de matrículas em memória seria carregar o histórico
 * inteiro para responder um número.
 */

/**
 * O funil de um curso: uma linha por aula, com quem começou e quem concluiu.
 *
 * `started` conta quem tem QUALQUER progresso — inclusive quem abriu e saiu.
 * É o que distingue "ninguém abriu" de "todos abriram e desistiram", e as duas
 * pedem ações opostas.
 */
export async function lessonSteps(
  tenantId: string,
  courseId: string,
): Promise<LessonStep[]> {
  const rows = await query<{
    lesson_id: string;
    title: string;
    module_title: string;
    position: string;
    completed: string;
    started: string;
    duration_seconds: number;
    watched_seconds: string;
  }>(
    `SELECT l.id AS lesson_id, l.title, m.title AS module_title,
            row_number() OVER (ORDER BY m.position, l.position) AS position,
            l.duration_seconds,
            count(p.enrollment_id) FILTER (WHERE p.completed_at IS NOT NULL) AS completed,
            count(p.enrollment_id)                                            AS started,
            COALESCE(sum(p.watched_seconds), 0)                               AS watched_seconds
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
       LEFT JOIN lesson_progress p ON p.lesson_id = l.id
      WHERE c.tenant_id = $1 AND c.id = $2
      GROUP BY l.id, l.title, m.title, m.position, l.position, l.duration_seconds
      ORDER BY m.position, l.position`,
    [tenantId, courseId],
  );

  return rows.map((row) => ({
    lessonId: row.lesson_id,
    title: row.title,
    moduleTitle: row.module_title,
    position: Number(row.position),
    completed: Number(row.completed),
    started: Number(row.started),
    durationSeconds: row.duration_seconds,
    watchedSeconds: Number(row.watched_seconds),
  }));
}

/** Quantas pessoas matriculadas no curso — o denominador do funil. */
export async function enrollmentCount(
  tenantId: string,
  courseId: string,
): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
      WHERE c.tenant_id = $1 AND c.id = $2`,
    [tenantId, courseId],
  );

  return Number(rows[0]?.n ?? 0);
}

/**
 * Quem assistiu até o fim, por aula.
 *
 * 95% e não 100%: créditos finais, o segundo em que a pessoa fecha a aba e o
 * arredondamento do player fazem quase ninguém chegar a 100%. Exigir 100%
 * mostraria zero conclusões num vídeo que todo mundo viu inteiro.
 */
export async function finishedByLesson(
  tenantId: string,
  courseId: string,
): Promise<Map<string, number>> {
  const rows = await query<{ lesson_id: string; n: string }>(
    `SELECT l.id AS lesson_id, count(*)::text AS n
       FROM lesson_progress p
       JOIN lessons l ON l.id = p.lesson_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE c.tenant_id = $1 AND c.id = $2
        AND l.duration_seconds > 0
        AND p.watched_seconds >= l.duration_seconds * 0.95
      GROUP BY l.id`,
    [tenantId, courseId],
  );

  return new Map(rows.map((row) => [row.lesson_id, Number(row.n)]));
}

/**
 * Pessoas distintas ativas por dia, nos últimos N dias.
 *
 * `generate_series` para que dia SEM ninguém apareça como zero. Sem ele, a
 * média seria sobre os dias com atividade — e uma plataforma parada metade do
 * mês pareceria tão ativa quanto uma que roda todo dia.
 */
export async function dailyActiveUsers(
  tenantId: string,
  dias: number,
): Promise<ActivityDay[]> {
  const rows = await query<{ dia: string; n: string }>(
    `SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
            count(DISTINCT u.id)::text   AS n
       FROM generate_series(
              (now() - make_interval(days => $2::int))::date,
              now()::date,
              interval '1 day'
            ) AS d(dia)
       LEFT JOIN users u
              ON u.tenant_id = $1
             AND u.last_access_at::date = d.dia
      GROUP BY d.dia
      ORDER BY d.dia`,
    [tenantId, dias],
  );

  return rows.map((row) => ({ date: row.dia, users: Number(row.n) }));
}

/** Pessoas distintas ativas num período — WAU e MAU. */
export async function activeInPeriod(tenantId: string, dias: number): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM users
      WHERE tenant_id = $1
        AND last_access_at >= now() - make_interval(days => $2::int)`,
    [tenantId, dias],
  );

  return Number(rows[0]?.n ?? 0);
}

/**
 * Matrículas candidatas a abandono: começadas, não concluídas, com o último
 * progresso datado.
 *
 * O filtro final — quantos dias parados contam como abandono — fica no core,
 * onde é testável e ajustável por quem chama.
 */
export async function abandonCandidates(
  tenantId: string,
  project: string | null,
): Promise<AbandonedEnrollment[]> {
  const rows = await query<{
    learner_id: string;
    learner_name: string;
    course_id: string;
    course_title: string;
    percent: string;
    days_idle: string;
  }>(
    `WITH progresso AS (
       SELECT e.id AS enrollment_id, e.learner_id, c.id AS course_id, c.title AS course_title,
              u.full_name AS learner_name,
              (SELECT count(*) FROM lessons l
                 JOIN modules m ON m.id = l.module_id
                WHERE m.course_id = c.id) AS total,
              count(p.lesson_id) FILTER (WHERE p.completed_at IS NOT NULL) AS concluidas,
              max(GREATEST(p.completed_at, p.updated_at)) AS ultimo
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         JOIN users u ON u.id = e.learner_id
         LEFT JOIN lesson_progress p ON p.enrollment_id = e.id
        WHERE c.tenant_id = $1
          AND ($2::text IS NULL OR u.project = $2)
        GROUP BY e.id, e.learner_id, c.id, c.title, u.full_name
     )
     SELECT learner_id, learner_name, course_id, course_title,
            CASE WHEN total = 0 THEN 0
                 ELSE round(concluidas::numeric / total * 100) END::text AS percent,
            COALESCE(EXTRACT(DAY FROM now() - ultimo), 0)::text          AS days_idle
       FROM progresso
      WHERE ultimo IS NOT NULL`,
    [tenantId, project],
  );

  return rows.map((row) => ({
    learnerId: row.learner_id,
    learnerName: row.learner_name,
    courseId: row.course_id,
    courseTitle: row.course_title,
    percent: Number(row.percent),
    daysIdle: Number(row.days_idle),
  }));
}

/** Uma linha por matrícula, com a unidade — a base do desempenho por área. */
export async function enrollmentsByDepartment(
  tenantId: string,
): Promise<
  Array<{ department: string | null; learnerId: string; percent: number; completed: boolean }>
> {
  const rows = await query<{
    department: string | null;
    learner_id: string;
    percent: string;
    completed: boolean;
  }>(
    `SELECT u.project AS department, e.learner_id,
            CASE WHEN t.total = 0 THEN 0
                 ELSE round(t.concluidas::numeric / t.total * 100) END::text AS percent,
            (t.total > 0 AND t.concluidas = t.total)                         AS completed
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.learner_id
       JOIN LATERAL (
         SELECT (SELECT count(*) FROM lessons l
                   JOIN modules m ON m.id = l.module_id
                  WHERE m.course_id = c.id) AS total,
                (SELECT count(*) FROM lesson_progress p
                   JOIN lessons l2 ON l2.id = p.lesson_id
                   JOIN modules m2 ON m2.id = l2.module_id
                  WHERE p.enrollment_id = e.id AND m2.course_id = c.id
                    AND p.completed_at IS NOT NULL) AS concluidas
       ) t ON true
      WHERE c.tenant_id = $1`,
    [tenantId],
  );

  return rows.map((row) => ({
    department: row.department,
    learnerId: row.learner_id,
    percent: Number(row.percent),
    completed: row.completed,
  }));
}
