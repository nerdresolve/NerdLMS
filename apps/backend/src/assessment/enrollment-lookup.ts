import { query } from "../db/pool.ts";

/**
 * A matrícula de uma pessoa num curso.
 *
 * Vive aqui, e não no repositório de matrícula, porque é o que a avaliação
 * precisa: a tentativa de prova e a entrega de trabalho pertencem ao VÍNCULO
 * com o curso, não à pessoa solta. Sem matrícula não há prova.
 */
export async function findEnrollmentId(
  courseId: string,
  learnerId: string,
): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM enrollments WHERE course_id = $1 AND learner_id = $2 LIMIT 1`,
    [courseId, learnerId],
  );

  return rows[0]?.id ?? null;
}

/**
 * Quem é o aluno de uma matrícula.
 *
 * O caminho inverso de `findEnrollmentId`: a correção conhece a matrícula, e a
 * notificação precisa da pessoa.
 */
export async function findLearnerOfEnrollment(enrollmentId: string): Promise<string | null> {
  const rows = await query<{ learner_id: string }>(
    `SELECT learner_id FROM enrollments WHERE id = $1 LIMIT 1`,
    [enrollmentId],
  );

  return rows[0]?.learner_id ?? null;
}
