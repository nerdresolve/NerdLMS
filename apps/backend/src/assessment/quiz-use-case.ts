import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { gradeAnswer, scoreAttempt } from "@nerdlms/core/assessment/grading.ts";
import {
  ATTEMPT_REFUSAL_MESSAGE,
  canStartAttempt,
  isExpired,
  shuffleWithSeed,
} from "@nerdlms/core/assessment/quiz-rules.ts";

import { findEnrollmentId } from "./enrollment-lookup.ts";
import { findQuizQuestions, type Question } from "./question-repository.ts";
import {
  findAnswers,
  findAttempt,
  findAttempts,
  findQuiz,
  saveAnswer,
  saveGrades,
  startAttempt,
  submitAttempt,
  type Attempt,
  type Quiz,
} from "./quiz-repository.ts";

/**
 * Fazer uma prova — F3-03 e F3-04.
 *
 * Três regras que este caso de uso existe para garantir, e que a tela não pode
 * garantir sozinha:
 *
 *   1. o GABARITO NUNCA SAI para quem está respondendo. A tela poderia
 *      escondê-lo, mas quem abre o inspetor veria — então ele não é enviado;
 *   2. o PRAZO é decidido pelo relógio do SERVIDOR. Um cronômetro no navegador
 *      é sugestão: mudar a hora da máquina não pode render mais tempo de prova;
 *   3. a TENTATIVA ENVIADA é imutável. Responder depois do envio seria
 *      reescrever uma nota já dada.
 */

/** A questão como o ALUNO a recebe: sem `isCorrect`, sem explicação. */
export interface QuestionForLearner {
  id: string;
  kind: Question["kind"];
  prompt: string;
  points: number;
  options: { id: string; text: string; matchText?: string }[];
}

/**
 * Remove tudo que revelaria a resposta.
 *
 * `matchText` fica — na associação ele É o que se escolhe, e a lista embaralhada
 * de pares não diz qual vai com qual.
 */
function paraAluno(q: Question, embaralhar: boolean, seed: string): QuestionForLearner {
  const opcoes = q.options.map((o) => ({
    id: o.id,
    text: o.text,
    ...(o.matchText ? { matchText: o.matchText } : {}),
  }));

  return {
    id: q.id,
    kind: q.kind,
    prompt: q.prompt,
    points: q.points,
    /* Na ordenação, embaralhar é obrigatório: mostrar na ordem cadastrada
       entregaria a resposta. */
    options:
      embaralhar || q.kind === "ordering" ? shuffleWithSeed(opcoes, `${seed}:${q.id}`) : opcoes,
  };
}

export interface StartCommand {
  actor: Actor;
  quizId: string;
}

export type StartOutcome =
  | { status: 200; attempt: Attempt; quiz: Quiz; questions: QuestionForLearner[] }
  | { status: 400 | 403 | 404; error: string };

export async function startQuizUseCase(command: StartCommand): Promise<StartOutcome> {
  const quiz = await findQuiz(command.quizId);
  if (!quiz) return { status: 404, error: "Prova não encontrada." };

  /* Sem matrícula não há prova: a tentativa pertence ao vínculo com o curso. */
  const enrollmentId = await findEnrollmentId(quiz.courseId, command.actor.id);
  if (!enrollmentId) return { status: 404, error: "Prova não encontrada." };

  if (quiz.questionCount === 0) {
    return { status: 400, error: "Esta prova ainda não tem questões." };
  }

  const anteriores = await findAttempts(quiz.id, enrollmentId);

  /* Tentativa em andamento e ainda no prazo: devolve ELA, não uma nova.
     Recarregar a página não pode consumir uma tentativa. */
  const aberta = anteriores.find((a) => !a.submittedAt);
  if (aberta && !isExpired(quiz, new Date(aberta.startedAt), new Date())) {
    return {
      status: 200,
      attempt: aberta,
      quiz,
      questions: await questoesDaTentativa(quiz, aberta),
    };
  }

  const usadas = anteriores.filter((a) => a.submittedAt).length;
  const decision = canStartAttempt(quiz, usadas, new Date());

  if (!decision.allow) {
    return { status: 403, error: ATTEMPT_REFUSAL_MESSAGE[decision.reason] };
  }

  const attempt = await startAttempt(quiz.id, enrollmentId);

  return { status: 200, attempt, quiz, questions: await questoesDaTentativa(quiz, attempt) };
}

/** As questões na ordem desta tentativa, sem gabarito. */
async function questoesDaTentativa(quiz: Quiz, attempt: Attempt): Promise<QuestionForLearner[]> {
  const todas = await findQuizQuestions(quiz.id);

  /* A semente é o id da tentativa: a ordem sobrevive a recarregar a página e
     difere entre pessoas. */
  const ordenadas = quiz.shuffleQuestions ? shuffleWithSeed(todas, attempt.id) : todas;

  return ordenadas.map((q) => paraAluno(q, quiz.shuffleOptions, attempt.id));
}

export interface AnswerCommand {
  actor: Actor;
  attemptId: string;
  questionId: string;
  response: unknown;
}

export type AnswerOutcome = { status: 200 } | { status: 400 | 403 | 404; error: string };

export async function answerQuizUseCase(command: AnswerCommand): Promise<AnswerOutcome> {
  const guard = await autorizarTentativa(command.actor, command.attemptId);
  if ("error" in guard) return guard;

  const { attempt, quiz } = guard;

  if (attempt.submittedAt) {
    return { status: 403, error: "Esta tentativa já foi enviada." };
  }

  /* O relógio do SERVIDOR decide. Um cronômetro no navegador é sugestão:
     mudar a hora da máquina não pode render mais tempo de prova. */
  if (isExpired(quiz, new Date(attempt.startedAt), new Date())) {
    return { status: 403, error: "O tempo desta tentativa acabou." };
  }

  await saveAnswer(command.attemptId, command.questionId, command.response);
  return { status: 200 };
}

export interface SubmitCommand {
  actor: Actor;
  attemptId: string;
}

export type SubmitOutcome =
  | { status: 200; percent: number; passed: boolean; needsReview: boolean }
  | { status: 400 | 403 | 404; error: string };

/**
 * Envia a tentativa e corrige o que é automático.
 *
 * A correção acontece AQUI, uma vez, e o resultado é gravado. Corrigir na
 * leitura faria a nota mudar quando o instrutor ajustasse um gabarito — e uma
 * nota que muda sozinha não é nota.
 */
export async function submitQuizUseCase(command: SubmitCommand): Promise<SubmitOutcome> {
  const guard = await autorizarTentativa(command.actor, command.attemptId);
  if ("error" in guard) return guard;

  const { attempt, quiz } = guard;

  if (attempt.submittedAt) {
    return { status: 403, error: "Esta tentativa já foi enviada." };
  }

  const questoes = await findQuizQuestions(quiz.id);
  const respostas = await findAnswers(command.attemptId);
  const porQuestao = new Map(respostas.map((r) => [r.questionId, r.response]));

  /* Toda questão da prova entra na conta, respondida ou não: pular uma questão
     tira o ponto dela, e ignorá-la inflaria o percentual de quem deixou em
     branco. */
  const notas = questoes.map((q) => {
    const resultado = gradeAnswer(q, porQuestao.get(q.id) ?? null);
    return { questionId: q.id, points: resultado.points, needsReview: resultado.needsReview };
  });

  await saveGrades(
    command.attemptId,
    notas.map((n) => ({ questionId: n.questionId, points: n.points })),
  );

  const score = scoreAttempt(notas, quiz.totalPoints, quiz.passingScore);

  const gravou = await submitAttempt(command.attemptId, score);
  if (!gravou) {
    /* Outra requisição enviou primeiro — dois cliques no botão. Não é erro: o
       resultado é o mesmo, e responder falha confundiria quem clicou. */
    const atual = await findAttempt(command.attemptId);
    return {
      status: 200,
      percent: atual?.scorePercent ?? score.percent,
      passed: atual?.passed ?? score.passed,
      needsReview: atual?.needsReview ?? score.needsReview,
    };
  }

  return {
    status: 200,
    percent: score.percent,
    passed: score.passed,
    needsReview: score.needsReview,
  };
}

/** A tentativa é desta pessoa? Devolve o par tentativa+prova, ou o erro. */
async function autorizarTentativa(
  actor: Actor,
  attemptId: string,
): Promise<{ attempt: Attempt; quiz: Quiz } | { status: 404; error: string }> {
  const attempt = await findAttempt(attemptId);
  if (!attempt) return { status: 404, error: "Tentativa não encontrada." };

  const quiz = await findQuiz(attempt.quizId);
  if (!quiz) return { status: 404, error: "Tentativa não encontrada." };

  /* A tentativa pertence à matrícula, e a matrícula à pessoa. Sem esta
     conferência, um id de tentativa alheia seria respondido por outra pessoa. */
  const enrollmentId = await findEnrollmentId(quiz.courseId, actor.id);
  if (!enrollmentId || enrollmentId !== attempt.enrollmentId) {
    return { status: 404, error: "Tentativa não encontrada." };
  }

  return { attempt, quiz };
}
