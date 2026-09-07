import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { evaluateBadges } from "../badges/badge-use-case.ts";

import {
  applyLatePenalty,
  canSubmit,
  SUBMISSION_REFUSAL_MESSAGE,
} from "@nerdlms/core/assessment/gradebook.ts";

import { authorizeCourse } from "../courses/course-editor-use-case.ts";
import {
  addSubmissionFile,
  createSubmission,
  findAssignment,
  findSubmissions,
  recordGrade,
} from "./assignment-repository.ts";
import { findEnrollmentId, findLearnerOfEnrollment } from "./enrollment-lookup.ts";
import { notify } from "../notifications/notify.ts";
import { saveRubricScores } from "./rubric-repository.ts";
import { findAnswers, findAttempt, findQuiz } from "./quiz-repository.ts";
import {
  finalizeAttemptScore,
  findSubmissionById,
  saveManualGrade,
} from "./manual-grade-repository.ts";

/**
 * Entregar trabalho e corrigir — F3-05 e F3-06.
 */

export interface SubmitAssignmentCommand {
  actor: Actor;
  assignmentId: string;
  text?: string | null;
  files?: { name: string; sizeBytes: number; storageKey: string }[];
}

export type SubmitAssignmentOutcome =
  | { status: 201; submissionId: string; late: boolean }
  | { status: 400 | 403 | 404; error: string };

export async function submitAssignmentUseCase(
  command: SubmitAssignmentCommand,
): Promise<SubmitAssignmentOutcome> {
  const assignment = await findAssignment(command.assignmentId);
  if (!assignment) return { status: 404, error: "Trabalho não encontrado." };

  const enrollmentId = await findEnrollmentId(assignment.courseId, command.actor.id);
  if (!enrollmentId) return { status: 404, error: "Trabalho não encontrado." };

  const arquivos = command.files ?? [];
  const texto = command.text?.trim() ?? "";

  if (texto === "" && arquivos.length === 0) {
    return { status: 400, error: "Envie um texto ou um arquivo." };
  }

  if (!assignment.allowFile && arquivos.length > 0) {
    return { status: 400, error: "Este trabalho não aceita arquivos." };
  }

  if (!assignment.allowText && texto !== "") {
    return { status: 400, error: "Este trabalho não aceita texto." };
  }

  if (arquivos.length > assignment.maxFiles) {
    return {
      status: 400,
      error: `Envie no máximo ${assignment.maxFiles} ${assignment.maxFiles === 1 ? "arquivo" : "arquivos"}.`,
    };
  }

  /* O teto de tamanho é conferido aqui E no storage. Aqui dá mensagem; lá é a
     garantia — quem sobe direto pela URL assinada não passa por este código. */
  const limite = assignment.maxFileMb * 1024 * 1024;
  if (arquivos.some((a) => a.sizeBytes > limite)) {
    return { status: 400, error: `Cada arquivo pode ter no máximo ${assignment.maxFileMb} MB.` };
  }

  const anteriores = await findSubmissions(command.assignmentId, enrollmentId);
  const decision = canSubmit(assignment, anteriores.length, new Date());

  if (!decision.allow) {
    return { status: 403, error: SUBMISSION_REFUSAL_MESSAGE[decision.reason] };
  }

  const submissionId = await createSubmission(
    command.assignmentId,
    enrollmentId,
    texto === "" ? null : texto,
    decision.late,
  );

  for (const arquivo of arquivos) {
    await addSubmissionFile(submissionId, arquivo);
  }

  return { status: 201, submissionId, late: decision.late };
}

export interface GradeSubmissionCommand {
  actor: Actor;
  actorName: string;
  submissionId: string;
  points: number;
  feedback?: string | null;
  /** Presente quando é reavaliação. */
  reason?: string | null;
  /** Arquivos que o corretor devolve (guia §8: feedback por arquivo). */
  feedbackFiles?: { name: string; sizeBytes: number; storageKey: string }[];
  /** Nota por critério, quando o trabalho tem rubrica (F3-07). */
  rubricScores?: { criterionId: string; points: number; comment?: string | null }[];
}

export type GradeOutcome = { status: 200 } | { status: 400 | 403 | 404; error: string };

/**
 * Corrige um trabalho — F3-06.
 *
 * A nota é LANÇADA, não atualizada: reavaliar acrescenta uma entrada e a
 * anterior fica como histórico. O gatilho da 012 garante isso no banco.
 */
export async function gradeSubmissionUseCase(
  command: GradeSubmissionCommand,
): Promise<GradeOutcome> {
  const entrega = await findSubmissionById(command.submissionId);
  if (!entrega) return { status: 404, error: "Entrega não encontrada." };

  const assignment = await findAssignment(entrega.assignmentId);
  if (!assignment) return { status: 404, error: "Entrega não encontrada." };

  /* Corrigir é do dono do curso. */
  const ownership = await authorizeCourse(command.actor, assignment.courseId);
  if (!ownership) return { status: 404, error: "Entrega não encontrada." };

  if (!Number.isFinite(command.points) || command.points < 0) {
    return { status: 400, error: "A nota precisa ser um número positivo." };
  }

  if (command.points > assignment.pointsPossible) {
    return {
      status: 400,
      error: `A nota máxima deste trabalho é ${assignment.pointsPossible}.`,
    };
  }

  /* O desconto por atraso entra aqui, não no envio: o professor pode ter
     mudado a política, e o que vale é a do momento da correção. */
  const pontos =
    assignment.latePolicy === "penalty"
      ? applyLatePenalty(command.points, entrega.isLate, assignment.latePenaltyPercent)
      : command.points;

  /* Com rubrica, a nota é a SOMA dos critérios, não o número solto que veio no
     corpo: é o que torna a rubrica uma avaliação e não uma decoração. */
  if (command.rubricScores && command.rubricScores.length > 0) {
    await saveRubricScores(command.submissionId, command.rubricScores);
  }

  const somaRubrica = command.rubricScores?.reduce((total, c) => total + c.points, 0);
  const notaFinal = somaRubrica ?? pontos;

  /* Os arquivos de devolução entram antes do lançamento: se a gravação da nota
     falhar, o instrutor reenvia tudo — melhor que uma nota lançada apontando
     para um arquivo que não chegou. */
  for (const arquivo of command.feedbackFiles ?? []) {
    await addSubmissionFile(command.submissionId, arquivo, true);
  }

  /* Quem entregou precisa saber que a nota saiu — é o evento que o guia §15
     lista como "nota publicada". */
  const aluno = await findLearnerOfEnrollment(entrega.enrollmentId);

  if (aluno) {
    await notify({
      userId: aluno,
      kind: "grade_posted",
      title: `Sua nota em ${assignment.title} saiu`,
      body: `Você recebeu ${notaFinal} de ${assignment.pointsPossible} pontos.`,
      link: `/cursos/${assignment.courseId}`,
      values: {
        curso: assignment.title,
        nota: String(notaFinal),
        total: String(assignment.pointsPossible),
      },
    });
  }

  await recordGrade({
    tenantId: ownership.tenantId,
    enrollmentId: entrega.enrollmentId,
    assignmentId: assignment.id,
    pointsEarned: notaFinal,
    pointsPossible: assignment.pointsPossible,
    feedback: command.feedback ?? null,
    gradedBy: command.actor.id,
    reason: command.reason ?? null,
  });

  /* Nota lançada pode fechar um badge de nota mínima (F6-01). A avaliação é do
     ALUNO, não de quem corrigiu — quem ganha o badge é quem tirou a nota. */
  if (aluno) await evaluateBadges(aluno, ownership.tenantId);

  return { status: 200 };
}

export interface GradeEssayCommand {
  actor: Actor;
  attemptId: string;
  questionId: string;
  points: number;
  feedback?: string | null;
}

/**
 * Corrige uma dissertativa da prova — F3-06.
 *
 * Depois de corrigir a última pendência, a nota da tentativa é RECALCULADA e o
 * `passed` é decidido. Até aqui `needs_review` mantinha a aprovação em suspenso
 * — ver `scoreAttempt`.
 */
export async function gradeEssayUseCase(command: GradeEssayCommand): Promise<GradeOutcome> {
  const attempt = await findAttempt(command.attemptId);
  if (!attempt) return { status: 404, error: "Tentativa não encontrada." };

  const quiz = await findQuiz(attempt.quizId);
  if (!quiz) return { status: 404, error: "Tentativa não encontrada." };

  const ownership = await authorizeCourse(command.actor, quiz.courseId);
  if (!ownership) return { status: 404, error: "Tentativa não encontrada." };

  if (!Number.isFinite(command.points) || command.points < 0) {
    return { status: 400, error: "A nota precisa ser um número positivo." };
  }

  await saveManualGrade(
    command.attemptId,
    command.questionId,
    command.points,
    command.feedback ?? null,
  );

  /* Recalcula a tentativa com o que já foi corrigido. */
  const respostas = await findAnswers(command.attemptId);
  const pendentes = respostas.filter((r) => r.pointsAwarded === null).length;
  const obtidos = respostas.reduce((soma, r) => soma + (r.pointsAwarded ?? 0), 0);

  const percent =
    quiz.totalPoints > 0 ? Math.round((obtidos / quiz.totalPoints) * 10000) / 100 : 0;

  await finalizeAttemptScore(
    command.attemptId,
    obtidos,
    percent,
    pendentes === 0 && percent >= quiz.passingScore,
    pendentes > 0,
  );

  /* A nota da prova entra no livro quando não há mais pendência: lançar antes
     colocaria no gradebook uma nota que ainda vai mudar. */
  if (pendentes === 0) {
    await recordGrade({
      tenantId: ownership.tenantId,
      enrollmentId: attempt.enrollmentId,
      quizId: quiz.id,
      pointsEarned: obtidos,
      pointsPossible: quiz.totalPoints,
      gradedBy: command.actor.id,
      reason: "Correção das questões dissertativas",
    });

    /* Prova fechada é nota nova no livro — pode fechar um badge de nota
       mínima. Só quando NÃO HÁ PENDÊNCIA, pelo mesmo motivo do lançamento: uma
       nota que ainda vai mudar não deve conceder badge que depois ficaria
       errado. */
    const avaliado = await findLearnerOfEnrollment(attempt.enrollmentId);
    if (avaliado) await evaluateBadges(avaliado, ownership.tenantId);
  }

  return { status: 200 };
}

