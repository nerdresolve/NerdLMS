/**
 * Trilhas de aprendizagem — TASK-053.
 *
 * Uma trilha é uma sequência ordenada de cursos. A proposta a chama de
 * "Jornada / Mapa de Metrô" e o levantamento pede "trilha personalizável".
 *
 * Duas decisões de regra ficam aqui, não na tela:
 *
 * 1. **O progresso da trilha é derivado**, nunca armazenado. Guardar um
 *    percentual de trilha criaria uma segunda verdade que sai de sincronia
 *    assim que um curso ganha ou perde uma aula.
 * 2. **O bloqueio é opcional e por trilha.** Trilha sequencial libera o próximo
 *    curso ao concluir o anterior; trilha livre deixa tudo aberto. Bloquear
 *    sempre impediria alguém de rever um curso já feito ou de começar por onde
 *    faz sentido para a função dele.
 */

import { trilhaAlcanca, type PessoaAlcancada } from "./alvo-da-trilha.ts";
import { courseProgress } from "./progress.ts";
import type { Course, Enrollment } from "./types.ts";

export interface Track {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Ids de curso, na ordem da jornada. */
  courseIds: string[];
  /**
   * `sequential`: o próximo curso só abre quando o anterior é concluído.
   * `free`: todos abertos desde o início.
   */
  mode: "sequential" | "free";
  /** A unidade a que a trilha se destina. Ausente: qualquer uma. */
  project?: string;
  /** A função a que a trilha se destina. Ausente: qualquer uma. */
  jobTitle?: string;
}

export type TrackStepState = "completed" | "current" | "available" | "locked";

export interface TrackStep {
  course: Course;
  position: number;
  percent: number;
  state: TrackStepState;
}

export interface TrackView {
  track: Track;
  steps: TrackStep[];
  /** Percentual da trilha, por aulas concluídas — não média de cursos. */
  percent: number;
  completedCourses: number;
  totalCourses: number;
  /** Próximo curso a fazer, ou null quando a trilha acabou. */
  nextCourseId: string | null;
}

export function trackView(track: Track, courses: Course[], enrollments: Enrollment[]): TrackView {
  const byId = new Map(courses.map((course) => [course.id, course]));

  let lessonsDone = 0;
  let lessonsTotal = 0;
  let previousCompleted = true;
  let currentAssigned = false;

  const steps: TrackStep[] = track.courseIds.flatMap((courseId, index) => {
    const course = byId.get(courseId);
    // Curso removido do catálogo some da trilha em vez de quebrar a tela.
    if (!course) return [];

    const enrollment = enrollments.find((item) => item.courseId === courseId);
    const summary = enrollment
      ? courseProgress(course, enrollment)
      : { total: course.modules.reduce((sum, module) => sum + module.lessons.length, 0), completed: 0, percent: 0, status: "not_started" as const };

    lessonsDone += summary.completed;
    lessonsTotal += summary.total;

    const done = summary.status === "completed";

    let state: TrackStepState;
    if (done) {
      state = "completed";
    } else if (track.mode === "sequential" && !previousCompleted) {
      state = "locked";
    } else if (!currentAssigned) {
      // O primeiro curso não concluído e alcançável é "o de agora".
      state = "current";
      currentAssigned = true;
    } else {
      state = "available";
    }

    previousCompleted = done;

    return [{ course, position: index + 1, percent: summary.percent, state }];
  });

  return {
    track,
    steps,
    percent: lessonsTotal === 0 ? 0 : Math.round((lessonsDone / lessonsTotal) * 100),
    completedCourses: steps.filter((step) => step.state === "completed").length,
    totalCourses: steps.length,
    nextCourseId: steps.find((step) => step.state === "current")?.course.id ?? null,
  };
}

/**
 * Trilhas visíveis para alguém, cruzando local e função.
 *
 * A comparação delega a `trilhaAlcanca`: era uma igualdade exata escrita aqui,
 * que sumia com a trilha por causa de um espaço ou de uma maiúscula — e agora
 * são duas dimensões, então duas cópias da regra virariam duas oportunidades de
 * divergir da consulta.
 */
export function visibleTracks(tracks: Track[], quem: PessoaAlcancada = {}): Track[] {
  return tracks.filter((track) =>
    trilhaAlcanca({ project: track.project ?? null, jobTitle: track.jobTitle ?? null }, quem),
  );
}
