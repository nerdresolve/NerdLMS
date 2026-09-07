import { query } from "../db/pool.ts";

/**
 * Gravação de matrícula.
 *
 * `enrolled_by` guarda quem matriculou: o próprio aluno na auto-inscrição, o
 * gestor no treinamento atribuído. Sem esse campo, "por que estou neste curso"
 * não teria resposta depois de alguns meses.
 */

export interface EnrollmentSummary {
  courseId: string;
  courseStatus: "draft" | "published" | "archived";
  enrollmentMode: "open" | "assigned";
  enrolled: boolean;
  /** Autor do curso — a permissão de matrícula atribuída o exige. */
  courseAuthorId: string;
  /** Título, para a notificação de matrícula dizer em que curso (F4-03). */
  courseTitle: string;
}

interface SummaryRow {
  course_id: string;
  course_status: EnrollmentSummary["courseStatus"];
  enrollment_mode: EnrollmentSummary["enrollmentMode"];
  enrollment_id: string | null;
  course_author_id: string;
  course_title: string;
}

/**
 * O que a decisão de matrícula precisa saber sobre um curso.
 *
 * Devolve `null` só quando o curso não existe — situação e modo vêm junto para
 * que a regra decida com uma consulta, não três.
 */
export async function findEnrollmentSummary(
  courseId: string,
  learnerId: string,
): Promise<EnrollmentSummary | null> {
  const rows = await query<SummaryRow>(
    `SELECT c.id        AS course_id,
            c.status    AS course_status,
            c.author_id AS course_author_id, c.title AS course_title,
            c.enrollment_mode,
            e.id        AS enrollment_id
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.learner_id = $2
      WHERE c.id = $1
      LIMIT 1`,
    [courseId, learnerId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    courseId: row.course_id,
    courseStatus: row.course_status,
    enrollmentMode: row.enrollment_mode,
    enrolled: row.enrollment_id !== null,
    courseAuthorId: row.course_author_id,
    courseTitle: row.course_title,
  };
}

/**
 * Cria a matrícula.
 *
 * `ON CONFLICT DO NOTHING` em vez de erro: dois cliques no mesmo botão não
 * podem virar falha para quem clicou. A unicidade é garantida pela restrição
 * `(course_id, learner_id)` do schema, e não pela ausência de corrida.
 */
export async function createEnrollment(
  courseId: string,
  learnerId: string,
  enrolledBy: string,
): Promise<void> {
  await query(
    `INSERT INTO enrollments (course_id, learner_id, enrolled_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (course_id, learner_id) DO NOTHING`,
    [courseId, learnerId, enrolledBy],
  );
}

/**
 * Marca ou desmarca o curso como salvo.
 *
 * Só faz sentido para quem já está matriculado — `saved` é uma coluna da
 * matrícula, não uma lista à parte. Devolve `false` quando não havia matrícula
 * para alterar.
 */
export async function setSaved(
  courseId: string,
  learnerId: string,
  saved: boolean,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE enrollments SET saved = $3
      WHERE course_id = $1 AND learner_id = $2
      RETURNING id`,
    [courseId, learnerId, saved],
  );
  return rows.length > 0;
}
