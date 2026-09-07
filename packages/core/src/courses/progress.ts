/**
 * Regras de progresso —
 *
 * Funções puras, sem I/O e sem dependência de React: a mesma regra roda no
 * servidor (ao persistir progresso) e no cliente (ao exibir).
 *
 * Três medidas distintas, que já foram uma só (guia §5):
 *
 * - CONSUMO (`watchedSeconds`) — quanto se assistiu. Só cresce.
 * - POSIÇÃO (`lastPositionSeconds`) — onde parou. Pode voltar.
 * - CONCLUSÃO (`completedAt`) — fato registrado, não cálculo.
 */

import type {
  CompletionSource,
  Course,
  Enrollment,
  Lesson,
  LessonProgress,
  LessonStatus,
  Module,
} from "./types.ts";

/** Fração assistida a partir da qual a aula conta como concluída. */
export const COMPLETION_THRESHOLD = 0.9;

/** Tolerância para não punir o aluno por milissegundos finais do vídeo. */
const EPSILON = 1e-9;

export function watchedRatio(watchedSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(watchedSeconds) || !Number.isFinite(durationSeconds)) return 0;
  if (durationSeconds <= 0) return 0;
  const ratio = watchedSeconds / durationSeconds;
  if (ratio <= 0) return 0;
  return Math.min(1, ratio);
}

/**
 * Se o CONSUMO atingiu o limiar.
 *
 * Responde "assistiu o bastante?", que não é a mesma pergunta que "concluiu?"
 * — ver `resolveCompletion`. Continua sendo o gatilho da conclusão automática
 * e a medida usada em relatório de consumo.
 */
export function isLessonCompleted(watchedSeconds: number, durationSeconds: number): boolean {
  return watchedRatio(watchedSeconds, durationSeconds) >= COMPLETION_THRESHOLD - EPSILON;
}

/**
 * O status da aula, a partir do que foi REGISTRADO.
 *
 * Antes o status era derivado de `watchedSeconds`, e as duas coisas que o guia
 * §5 separa eram o mesmo número. Consequências práticas: aula sem vídeo nunca
 * concluía, ninguém conseguia desmarcar, e a data da conclusão era recalculada
 * a cada leitura em vez de ser um fato.
 *
 * Agora `completedAt` manda. O consumo continua distinguindo "não começou" de
 * "em andamento", que é o que ele sabe dizer.
 */
export function lessonStatus(lesson: Lesson, enrollment: Enrollment): LessonStatus {
  const progress = enrollment.progress[lesson.id];
  if (progress?.completedAt) return "completed";

  const watched = progress?.watchedSeconds ?? 0;
  return watched > 0 ? "in_progress" : "not_started";
}

/** O que gravar quando a conclusão automática dispara. */
export interface CompletionDecision {
  completedAt: string;
  completionSource: CompletionSource;
}

/**
 * Se este avanço de vídeo conclui a aula.
 *
 * Devolve `null` quando nada muda — que é o caso comum, e inclui três
 * situações que precisam ser distinguidas de "ainda não deu":
 *
 * - aula `manual`: consumo não conclui, por definição do modo. Se concluísse,
 *   o modo não teria efeito;
 * - aula já concluída: reescrever `completedAt` apagaria a data real, que vai
 *   para relatório de conformidade;
 * - conclusão manual anterior: assistir depois não a desfaz nem a converte
 *   em automática.
 *
 * `agora` é injetado para o teste não depender do relógio.
 */
export function resolveCompletion(
  lesson: Lesson,
  watchedSeconds: number,
  atual: LessonProgress | undefined,
  agora: Date = new Date(),
): CompletionDecision | null {
  if (atual?.completedAt) return null;
  if ((lesson.completionMode ?? "auto") === "manual") return null;
  if (!isLessonCompleted(watchedSeconds, lesson.durationSeconds)) return null;

  return { completedAt: agora.toISOString(), completionSource: "auto" };
}

export function courseLessons(course: Course): Lesson[] {
  return course.modules.flatMap((module) => module.lessons);
}

export interface ProgressSummary {
  total: number;
  completed: number;
  /** Inteiro de 0 a 100. */
  percent: number;
  status: LessonStatus;
}

function summarize(lessons: Lesson[], enrollment: Enrollment): ProgressSummary {
  const total = lessons.length;
  const completed = lessons.filter((lesson) => lessonStatus(lesson, enrollment) === "completed").length;

  // Um curso vazio é 0%, não 100%: não existe conquista sem conteúdo.
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const anyStarted = lessons.some((lesson) => lessonStatus(lesson, enrollment) !== "not_started");
  const status: LessonStatus =
    total > 0 && completed === total ? "completed" : anyStarted ? "in_progress" : "not_started";

  return { total, completed, percent, status };
}

export function moduleProgress(module: Module, enrollment: Enrollment): ProgressSummary {
  return summarize(module.lessons, enrollment);
}

export function courseProgress(course: Course, enrollment: Enrollment): ProgressSummary {
  return summarize(courseLessons(course), enrollment);
}

export interface ResumePoint {
  module: Module;
  lesson: Lesson;
  /** Segundo em que o vídeo deve recomeçar. */
  resumeAtSeconds: number;
}

/**
 * Onde o aluno deve continuar.
 *
 * Prioridade: a última aula aberta, se ainda não concluída; caso contrário, a
 * primeira aula não concluída na ordem do curso. Retorna null quando o curso
 * está inteiro concluído.
 */
export function resumePoint(course: Course, enrollment: Enrollment): ResumePoint | null {
  const candidates = course.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));

  const pending = candidates.filter(({ lesson }) => lessonStatus(lesson, enrollment) !== "completed");
  if (pending.length === 0) return null;

  const last = enrollment.lastLessonId
    ? pending.find(({ lesson }) => lesson.id === enrollment.lastLessonId)
    : undefined;

  const chosen = last ?? pending[0];
  if (!chosen) return null;

  return {
    module: chosen.module,
    lesson: chosen.lesson,
    /* Onde parou, não o quanto assistiu: quem voltou para rever um trecho e
       saiu deve retomar dali, e `watchedSeconds` (que só cresce) jogaria a
       pessoa adiante do ponto em que ela realmente estava. */
    resumeAtSeconds: enrollment.progress[chosen.lesson.id]?.lastPositionSeconds ?? 0,
  };
}

/** Duração total do curso, em segundos. */
export function courseDurationSeconds(course: Course): number {
  return courseLessons(course).reduce((total, lesson) => total + Math.max(0, lesson.durationSeconds), 0);
}

/** Formata duração como "8h 30min" ou "45min". */
export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);

  // 59min59s não deve virar "0h 60min".
  if (minutes === 60) return `${hours + 1}h`;
  if (hours === 0) return `${minutes}min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`;
}

/** Saudação por faixa horária. `hour` em 0–23, hora local do aluno. */
export function greeting(hour: number): "Bom dia" | "Boa tarde" | "Boa noite" {
  const safe = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 12;
  if (safe < 12) return "Bom dia";
  return safe < 18 ? "Boa tarde" : "Boa noite";
}
