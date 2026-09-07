import { query } from "../db/pool.ts";

/**
 * Correção manual — F3-06.
 *
 * A dissertativa da prova e a entrega de trabalho compartilham este módulo
 * porque compartilham o gesto: alguém lê, atribui pontos e escreve um
 * comentário.
 */

/** Grava a nota de UMA questão dissertativa. */
export async function saveManualGrade(
  attemptId: string,
  questionId: string,
  points: number,
  feedback: string | null,
): Promise<void> {
  await query(
    `UPDATE quiz_answers
        SET points_awarded = $3, feedback = $4
      WHERE attempt_id = $1 AND question_id = $2`,
    [attemptId, questionId, points, feedback],
  );
}

/**
 * Fecha a tentativa com a nota recalculada, depois da correção manual.
 *
 * Esta é a ÚNICA escrita que altera uma tentativa já enviada, e existe porque a
 * correção da dissertativa é exatamente o evento que muda a nota. O
 * `submitAttempt` continua recusando reenvio — o que se atualiza aqui é o
 * resultado da correção, não a resposta do aluno.
 */
export async function finalizeAttemptScore(
  attemptId: string,
  points: number,
  percent: number,
  passed: boolean,
  needsReview: boolean,
): Promise<void> {
  await query(
    `UPDATE quiz_attempts
        SET score_points = $2, score_percent = $3, passed = $4, needs_review = $5
      WHERE id = $1 AND submitted_at IS NOT NULL`,
    [attemptId, points, percent, passed, needsReview],
  );
}

export interface SubmissionRef {
  id: string;
  assignmentId: string;
  enrollmentId: string;
  isLate: boolean;
}

/** A entrega, com o vínculo — o suficiente para autorizar e lançar a nota. */
export async function findSubmissionById(submissionId: string): Promise<SubmissionRef | null> {
  const rows = await query<{
    id: string;
    assignment_id: string;
    enrollment_id: string;
    is_late: boolean;
  }>(
    `SELECT id, assignment_id, enrollment_id, is_late
       FROM submissions
      WHERE id = $1
      LIMIT 1`,
    [submissionId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    assignmentId: row.assignment_id,
    enrollmentId: row.enrollment_id,
    isLate: row.is_late,
  };
}

/** As dissertativas que esperam correção, para a fila do instrutor. */
export async function findPendingReviews(courseId: string): Promise<
  {
    attemptId: string;
    questionId: string;
    quizTitle: string;
    prompt: string;
    learnerName: string;
    response: unknown;
    maxPoints: number;
  }[]
> {
  const rows = await query<{
    attempt_id: string;
    question_id: string;
    quiz_title: string;
    prompt: string;
    learner_name: string;
    response: unknown;
    max_points: string;
  }>(
    `SELECT a.attempt_id, a.question_id, qz.title AS quiz_title, q.prompt,
            u.full_name AS learner_name, a.response,
            COALESCE(qq.points, q.points) AS max_points
       FROM quiz_answers a
       JOIN quiz_attempts t  ON t.id = a.attempt_id
       JOIN quizzes qz       ON qz.id = t.quiz_id
       JOIN questions q      ON q.id = a.question_id
       JOIN quiz_questions qq ON qq.quiz_id = qz.id AND qq.question_id = q.id
       JOIN enrollments e    ON e.id = t.enrollment_id
       JOIN users u          ON u.id = e.learner_id
      WHERE qz.course_id = $1
        AND t.submitted_at IS NOT NULL
        AND a.points_awarded IS NULL
      ORDER BY t.submitted_at`,
    [courseId],
  );

  return rows.map((row) => ({
    attemptId: row.attempt_id,
    questionId: row.question_id,
    quizTitle: row.quiz_title,
    prompt: row.prompt,
    learnerName: row.learner_name,
    response: row.response,
    maxPoints: Number(row.max_points),
  }));
}
