import type { GradeEntry, SubmissionRules } from "@nerdlms/core/assessment/gradebook.ts";

import { query } from "../db/pool.ts";

/**
 * Trabalhos, entregas e livro de notas — F3-05, F3-06, F3-08.
 */

export interface Assignment extends SubmissionRules {
  id: string;
  courseId: string;
  lessonId?: string;
  title: string;
  instructions?: string;
  allowFile: boolean;
  allowText: boolean;
  maxFiles: number;
  maxFileMb: number;
  pointsPossible: number;
}

interface AssignmentRow {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  allow_file: boolean;
  allow_text: boolean;
  max_files: number;
  max_file_mb: number;
  points_possible: string;
  due_at: Date | null;
  late_policy: SubmissionRules["latePolicy"];
  late_penalty_percent: string;
  max_attempts: number | null;
}

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    allowFile: row.allow_file,
    allowText: row.allow_text,
    maxFiles: row.max_files,
    maxFileMb: row.max_file_mb,
    pointsPossible: Number(row.points_possible),
    latePolicy: row.late_policy,
    latePenaltyPercent: Number(row.late_penalty_percent),
    ...(row.lesson_id ? { lessonId: row.lesson_id } : {}),
    ...(row.instructions ? { instructions: row.instructions } : {}),
    ...(row.due_at ? { dueAt: row.due_at.toISOString() } : {}),
    ...(row.max_attempts !== null ? { maxAttempts: row.max_attempts } : {}),
  };
}

/* As duas consultas abaixo repetem a lista de colunas: extrair uma constante
   esconderia o WHERE da verificação de isolamento (ver `class-repository`). */

/** Os trabalhos de um curso. */
export async function findAssignments(courseId: string): Promise<Assignment[]> {
  const rows = await query<AssignmentRow>(
    `SELECT id, course_id, lesson_id, title, instructions, allow_file, allow_text,
            max_files, max_file_mb, points_possible, due_at, late_policy,
            late_penalty_percent, max_attempts
       FROM assignments
      WHERE course_id = $1
      ORDER BY due_at NULLS LAST, created_at`,
    [courseId],
  );

  return rows.map(toAssignment);
}

/** Um trabalho. */
export async function findAssignment(assignmentId: string): Promise<Assignment | null> {
  const rows = await query<AssignmentRow>(
    `SELECT id, course_id, lesson_id, title, instructions, allow_file, allow_text,
            max_files, max_file_mb, points_possible, due_at, late_policy,
            late_penalty_percent, max_attempts
       FROM assignments
      WHERE id = $1
      LIMIT 1`,
    [assignmentId],
  );

  const row = rows[0];
  return row ? toAssignment(row) : null;
}

export interface Submission {
  id: string;
  assignmentId: string;
  enrollmentId: string;
  attemptNumber: number;
  textContent?: string;
  submittedAt: string;
  isLate: boolean;
  files: { id: string; name: string; sizeBytes: number; storageKey: string }[];
  /** O que o corretor devolveu — separado do que o aluno entregou. */
  graderFiles: { id: string; name: string; sizeBytes: number; storageKey: string }[];
  /** Nome de quem entregou — a tela de correção lista várias pessoas. */
  learnerName?: string;
}

/** As entregas de um trabalho, ou só as de uma matrícula. */
export async function findSubmissions(
  assignmentId: string,
  enrollmentId?: string,
): Promise<Submission[]> {
  const rows = await query<{
    id: string;
    assignment_id: string;
    enrollment_id: string;
    attempt_number: number;
    text_content: string | null;
    submitted_at: Date;
    is_late: boolean;
    learner_name: string;
  }>(
    `SELECT s.id, s.assignment_id, s.enrollment_id, s.attempt_number, s.text_content,
            s.submitted_at, s.is_late, u.full_name AS learner_name
       FROM submissions s
       JOIN enrollments e ON e.id = s.enrollment_id
       JOIN users u       ON u.id = e.learner_id
      WHERE s.assignment_id = $1
        AND ($2::uuid IS NULL OR s.enrollment_id = $2)
      ORDER BY s.submitted_at DESC`,
    [assignmentId, enrollmentId ?? null],
  );

  if (rows.length === 0) return [];

  const arquivos = await query<{
    id: string;
    submission_id: string;
    name: string;
    size_bytes: string;
    storage_key: string;
    from_grader: boolean;
  }>(
    `SELECT id, submission_id, name, size_bytes, storage_key, from_grader
       FROM submission_files
      WHERE submission_id = ANY($1::uuid[])
      ORDER BY created_at`,
    [rows.map((r) => r.id)],
  );

  /* Dois mapas: o que o aluno entregou e o que o corretor devolveu. Misturá-los
     faria a tela mostrar o PDF comentado do professor como se fosse entrega. */
  const porEntrega = new Map<string, Submission["files"]>();
  const doCorretor = new Map<string, Submission["files"]>();

  for (const a of arquivos) {
    const destino = a.from_grader ? doCorretor : porEntrega;
    const lista = destino.get(a.submission_id) ?? [];
    lista.push({ id: a.id, name: a.name, sizeBytes: Number(a.size_bytes), storageKey: a.storage_key });
    destino.set(a.submission_id, lista);
  }

  return rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    enrollmentId: row.enrollment_id,
    attemptNumber: row.attempt_number,
    submittedAt: row.submitted_at.toISOString(),
    isLate: row.is_late,
    files: porEntrega.get(row.id) ?? [],
    graderFiles: doCorretor.get(row.id) ?? [],
    learnerName: row.learner_name,
    ...(row.text_content ? { textContent: row.text_content } : {}),
  }));
}

/**
 * Grava a entrega.
 *
 * O número da tentativa sai de subconsulta na mesma instrução, pela mesma razão
 * de `startAttempt`: dois envios simultâneos calculariam o mesmo número e o
 * UNIQUE recusaria o segundo.
 */
export async function createSubmission(
  assignmentId: string,
  enrollmentId: string,
  textContent: string | null,
  isLate: boolean,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO submissions (assignment_id, enrollment_id, attempt_number, text_content, is_late)
     VALUES ($1, $2,
             COALESCE((SELECT max(attempt_number) FROM submissions
                        WHERE assignment_id = $1 AND enrollment_id = $2), 0) + 1,
             $3, $4)
     RETURNING id`,
    [assignmentId, enrollmentId, textContent, isLate],
  );

  return rows[0]!.id;
}

export async function addSubmissionFile(
  submissionId: string,
  file: { name: string; sizeBytes: number; storageKey: string },
  /** `true` quando é o corretor devolvendo (guia §8: feedback por arquivo). */
  fromGrader = false,
): Promise<void> {
  await query(
    `INSERT INTO submission_files (submission_id, name, size_bytes, storage_key, from_grader)
     VALUES ($1, $2, $3, $4, $5)`,
    [submissionId, file.name, file.sizeBytes, file.storageKey, fromGrader],
  );
}

/* ------------------------------------------------------- livro de notas */

interface GradeRow {
  id: string;
  quiz_id: string | null;
  assignment_id: string | null;
  points_earned: string;
  points_possible: string;
  weight: string;
  feedback: string | null;
  reason: string | null;
  created_at: Date;
}

function toGrade(row: GradeRow): GradeEntry {
  return {
    id: row.id,
    activityId: (row.quiz_id ?? row.assignment_id)!,
    activityKind: row.quiz_id ? "quiz" : "assignment",
    pointsEarned: Number(row.points_earned),
    pointsPossible: Number(row.points_possible),
    weight: Number(row.weight),
    createdAt: row.created_at.toISOString(),
    ...(row.feedback ? { feedback: row.feedback } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
  };
}

/**
 * Todos os lançamentos de uma matrícula — incluindo o histórico.
 *
 * Devolve tudo, não só a nota vigente: `currentGrades` decide qual vale, e a
 * tela de histórico precisa das anteriores. Filtrar aqui perderia o que o guia
 * §9 pede guardar.
 */
export async function findGrades(enrollmentId: string): Promise<GradeEntry[]> {
  const rows = await query<GradeRow>(
    `SELECT id, quiz_id, assignment_id, points_earned, points_possible,
            weight, feedback, reason, created_at
       FROM grade_entries
      WHERE enrollment_id = $1
      ORDER BY created_at`,
    [enrollmentId],
  );

  return rows.map(toGrade);
}

export interface NewGrade {
  tenantId: string;
  enrollmentId: string;
  quizId?: string | null;
  assignmentId?: string | null;
  /** Link LTI, quando a nota veio de ferramenta externa (F6-04). */
  ltiLinkId?: string | null;
  pointsEarned: number;
  pointsPossible: number;
  weight?: number;
  feedback?: string | null;
  gradedBy?: string | null;
  reason?: string | null;
}

/**
 * Lança uma nota.
 *
 * Nunca atualiza: o gatilho da 012 recusa UPDATE. Reavaliar é lançar outra
 * entrada, e a anterior fica como histórico.
 */
export async function recordGrade(input: NewGrade): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO grade_entries
            (tenant_id, enrollment_id, quiz_id, assignment_id, lti_link_id,
             points_earned, points_possible, weight, feedback, graded_by, reason)
     VALUES ($1, $2, $3, $4, $11, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      input.tenantId,
      input.enrollmentId,
      input.quizId ?? null,
      input.assignmentId ?? null,
      input.pointsEarned,
      input.pointsPossible,
      input.weight ?? 1,
      input.feedback ?? null,
      input.gradedBy ?? null,
      input.reason ?? null,
      input.ltiLinkId ?? null,
    ],
  );

  return rows[0]!.id;
}

/**
 * As entregas de um curso que ainda não têm nota lançada.
 *
 * Uma consulta só. A versão anterior desta tela percorria trabalho por trabalho
 * e entrega por entrega, pedindo as notas de cada matrícula — N+1 consultas que
 * ficariam lentas com uma turma de trinta pessoas e cinco trabalhos.
 *
 * "Sem nota" é a ausência de lançamento em `grade_entries` para aquele
 * trabalho e aquela matrícula: `NOT EXISTS` responde isso sem carregar o
 * histórico inteiro.
 */
export async function findUngradedSubmissions(courseId: string): Promise<
  {
    id: string;
    assignmentTitle: string;
    learnerName: string;
    submittedAt: string;
    isLate: boolean;
    textContent?: string;
    pointsPossible: number;
    files: { id: string; name: string }[];
  }[]
> {
  const rows = await query<{
    id: string;
    assignment_title: string;
    learner_name: string;
    submitted_at: Date;
    is_late: boolean;
    text_content: string | null;
    points_possible: string;
  }>(
    `SELECT s.id, a.title AS assignment_title, u.full_name AS learner_name,
            s.submitted_at, s.is_late, s.text_content, a.points_possible
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN enrollments e ON e.id = s.enrollment_id
       JOIN users u       ON u.id = e.learner_id
      WHERE a.course_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM grade_entries g
           WHERE g.assignment_id = a.id AND g.enrollment_id = s.enrollment_id
        )
      ORDER BY s.submitted_at`,
    [courseId],
  );

  if (rows.length === 0) return [];

  const arquivos = await query<{ id: string; submission_id: string; name: string }>(
    `SELECT id, submission_id, name
       FROM submission_files
      WHERE submission_id = ANY($1::uuid[])
      ORDER BY created_at`,
    [rows.map((r) => r.id)],
  );

  const porEntrega = new Map<string, { id: string; name: string }[]>();
  for (const a of arquivos) {
    const lista = porEntrega.get(a.submission_id) ?? [];
    lista.push({ id: a.id, name: a.name });
    porEntrega.set(a.submission_id, lista);
  }

  return rows.map((row) => ({
    id: row.id,
    assignmentTitle: row.assignment_title,
    learnerName: row.learner_name,
    submittedAt: row.submitted_at.toISOString(),
    isLate: row.is_late,
    pointsPossible: Number(row.points_possible),
    files: porEntrega.get(row.id) ?? [],
    ...(row.text_content ? { textContent: row.text_content } : {}),
  }));
}
