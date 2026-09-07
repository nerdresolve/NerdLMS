import type { GradingMethod, QuizSettings } from "@nerdlms/core/assessment/quiz-rules.ts";

import { query } from "../db/pool.ts";

/**
 * Provas e tentativas — F3-03.
 */

export interface Quiz extends QuizSettings {
  id: string;
  courseId: string;
  lessonId?: string;
  title: string;
  description?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionsPerPage?: number;
  sequentialNavigation: boolean;
  feedbackMode: "immediate" | "on_submit" | "after_close" | "never";
  /** Soma dos pesos das questões desta prova. */
  totalPoints: number;
  questionCount: number;
}

interface QuizRow {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  passing_score: string;
  grading_method: GradingMethod;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  questions_per_page: number | null;
  sequential_navigation: boolean;
  feedback_mode: Quiz["feedbackMode"];
  opens_at: Date | null;
  closes_at: Date | null;
  grace_minutes: number;
  total_points: string | null;
  question_count: string;
}

function toQuiz(row: QuizRow): Quiz {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    passingScore: Number(row.passing_score),
    gradingMethod: row.grading_method,
    graceMinutes: row.grace_minutes,
    shuffleQuestions: row.shuffle_questions,
    shuffleOptions: row.shuffle_options,
    sequentialNavigation: row.sequential_navigation,
    feedbackMode: row.feedback_mode,
    /* A soma vem do banco: calcular na aplicação exigiria carregar todas as
       questões só para saber quanto a prova vale. */
    totalPoints: Number(row.total_points ?? 0),
    questionCount: Number(row.question_count),
    ...(row.lesson_id ? { lessonId: row.lesson_id } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.time_limit_minutes !== null ? { timeLimitMinutes: row.time_limit_minutes } : {}),
    ...(row.max_attempts !== null ? { maxAttempts: row.max_attempts } : {}),
    ...(row.questions_per_page !== null ? { questionsPerPage: row.questions_per_page } : {}),
    ...(row.opens_at ? { opensAt: row.opens_at.toISOString() } : {}),
    ...(row.closes_at ? { closesAt: row.closes_at.toISOString() } : {}),
  };
}

/* As consultas abaixo repetem as subconsultas de soma de propósito: extrair
   uma constante compartilhada esconderia o WHERE da verificação de isolamento,
   que lê cada template literal isoladamente (ver `class-repository`).

   A soma usa `COALESCE(qq.points, q.points)` — o peso da prova ganha do peso
   próprio da questão — e precisa concordar com o que `findQuizQuestions`
   devolve, senão a nota percentual sai errada. */

/** As provas de um curso. */
export async function findQuizzes(courseId: string): Promise<Quiz[]> {
  const rows = await query<QuizRow>(
    `SELECT qz.id, qz.course_id, qz.lesson_id, qz.title, qz.description,
            qz.time_limit_minutes, qz.max_attempts, qz.passing_score, qz.grading_method,
            qz.shuffle_questions, qz.shuffle_options, qz.questions_per_page,
            qz.sequential_navigation, qz.feedback_mode, qz.opens_at, qz.closes_at,
            qz.grace_minutes,
            (SELECT sum(COALESCE(qq.points, q.points))
               FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id
              WHERE qq.quiz_id = qz.id) AS total_points,
            (SELECT count(*) FROM quiz_questions qq WHERE qq.quiz_id = qz.id) AS question_count
       FROM quizzes qz
      WHERE qz.course_id = $1
      ORDER BY qz.created_at`,
    [courseId],
  );

  return rows.map(toQuiz);
}

/** Uma prova. */
export async function findQuiz(quizId: string): Promise<Quiz | null> {
  const rows = await query<QuizRow>(
    `SELECT qz.id, qz.course_id, qz.lesson_id, qz.title, qz.description,
            qz.time_limit_minutes, qz.max_attempts, qz.passing_score, qz.grading_method,
            qz.shuffle_questions, qz.shuffle_options, qz.questions_per_page,
            qz.sequential_navigation, qz.feedback_mode, qz.opens_at, qz.closes_at,
            qz.grace_minutes,
            (SELECT sum(COALESCE(qq.points, q.points))
               FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id
              WHERE qq.quiz_id = qz.id) AS total_points,
            (SELECT count(*) FROM quiz_questions qq WHERE qq.quiz_id = qz.id) AS question_count
       FROM quizzes qz
      WHERE qz.id = $1
      LIMIT 1`,
    [quizId],
  );

  const row = rows[0];
  return row ? toQuiz(row) : null;
}

export interface Attempt {
  id: string;
  quizId: string;
  enrollmentId: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt?: string;
  scorePoints?: number;
  scorePercent?: number;
  passed?: boolean;
  needsReview: boolean;
}

interface AttemptRow {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  attempt_number: number;
  started_at: Date;
  submitted_at: Date | null;
  score_points: string | null;
  score_percent: string | null;
  passed: boolean | null;
  needs_review: boolean;
}

function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    enrollmentId: row.enrollment_id,
    attemptNumber: row.attempt_number,
    startedAt: row.started_at.toISOString(),
    needsReview: row.needs_review,
    ...(row.submitted_at ? { submittedAt: row.submitted_at.toISOString() } : {}),
    ...(row.score_points !== null ? { scorePoints: Number(row.score_points) } : {}),
    ...(row.score_percent !== null ? { scorePercent: Number(row.score_percent) } : {}),
    ...(row.passed !== null ? { passed: row.passed } : {}),
  };
}

/** As tentativas desta pessoa nesta prova, da primeira à última. */
export async function findAttempts(quizId: string, enrollmentId: string): Promise<Attempt[]> {
  const rows = await query<AttemptRow>(
    `SELECT id, quiz_id, enrollment_id, attempt_number, started_at, submitted_at,
            score_points, score_percent, passed, needs_review
       FROM quiz_attempts
      WHERE quiz_id = $1 AND enrollment_id = $2
      ORDER BY attempt_number`,
    [quizId, enrollmentId],
  );

  return rows.map(toAttempt);
}

/** Uma tentativa. */
export async function findAttempt(attemptId: string): Promise<Attempt | null> {
  const rows = await query<AttemptRow>(
    `SELECT id, quiz_id, enrollment_id, attempt_number, started_at, submitted_at,
            score_points, score_percent, passed, needs_review
       FROM quiz_attempts
      WHERE id = $1
      LIMIT 1`,
    [attemptId],
  );

  const row = rows[0];
  return row ? toAttempt(row) : null;
}

/**
 * Começa uma tentativa.
 *
 * O número sai de uma subconsulta na mesma instrução, não de um `count` lido
 * antes: duas abas abrindo a prova ao mesmo tempo calculariam o mesmo número, e
 * o UNIQUE `(quiz, matrícula, número)` recusaria a segunda. Assim a segunda
 * recebe o número seguinte.
 */
export async function startAttempt(quizId: string, enrollmentId: string): Promise<Attempt> {
  const rows = await query<AttemptRow>(
    `INSERT INTO quiz_attempts (quiz_id, enrollment_id, attempt_number)
     VALUES ($1, $2,
             COALESCE((SELECT max(attempt_number) FROM quiz_attempts
                        WHERE quiz_id = $1 AND enrollment_id = $2), 0) + 1)
     RETURNING id, quiz_id, enrollment_id, attempt_number, started_at, submitted_at,
               score_points, score_percent, passed, needs_review`,
    [quizId, enrollmentId],
  );

  return toAttempt(rows[0]!);
}

/**
 * Grava uma resposta.
 *
 * Sobrescreve a anterior: mudar de ideia antes de enviar é normal, e guardar o
 * histórico de rascunho não serve a ninguém. Depois do envio, o caso de uso
 * recusa — a tentativa enviada é imutável.
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  response: unknown,
): Promise<void> {
  await query(
    `INSERT INTO quiz_answers (attempt_id, question_id, response)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (attempt_id, question_id) DO UPDATE SET response = EXCLUDED.response`,
    [attemptId, questionId, JSON.stringify(response ?? null)],
  );
}

export interface StoredAnswer {
  questionId: string;
  response: unknown;
  pointsAwarded: number | null;
  autoGraded: boolean;
  feedback?: string;
}

export async function findAnswers(attemptId: string): Promise<StoredAnswer[]> {
  const rows = await query<{
    question_id: string;
    response: unknown;
    points_awarded: string | null;
    auto_graded: boolean;
    feedback: string | null;
  }>(
    `SELECT question_id, response, points_awarded, auto_graded, feedback
       FROM quiz_answers
      WHERE attempt_id = $1`,
    [attemptId],
  );

  return rows.map((row) => ({
    questionId: row.question_id,
    response: row.response,
    pointsAwarded: row.points_awarded === null ? null : Number(row.points_awarded),
    autoGraded: row.auto_graded,
    ...(row.feedback ? { feedback: row.feedback } : {}),
  }));
}

/** Grava a correção automática de cada resposta. */
export async function saveGrades(
  attemptId: string,
  notas: { questionId: string; points: number | null }[],
): Promise<void> {
  if (notas.length === 0) return;

  await query(
    `UPDATE quiz_answers a
        SET points_awarded = v.points, auto_graded = true
       FROM unnest($2::uuid[], $3::numeric[]) AS v(question_id, points)
      WHERE a.attempt_id = $1 AND a.question_id = v.question_id`,
    [attemptId, notas.map((n) => n.questionId), notas.map((n) => n.points)],
  );
}

/**
 * Fecha a tentativa com a nota.
 *
 * `WHERE submitted_at IS NULL` torna o envio idempotente: dois cliques no botão
 * não geram duas notas, e a segunda chamada simplesmente não afeta linha
 * nenhuma. É a mesma proteção que `ON CONFLICT DO NOTHING` dá na matrícula.
 */
export async function submitAttempt(
  attemptId: string,
  score: { points: number; percent: number; passed: boolean; needsReview: boolean },
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE quiz_attempts
        SET submitted_at = now(), score_points = $2, score_percent = $3,
            passed = $4, needs_review = $5
      WHERE id = $1 AND submitted_at IS NULL
      RETURNING id`,
    [attemptId, score.points, score.percent, score.passed, score.needsReview],
  );

  return rows.length > 0;
}
