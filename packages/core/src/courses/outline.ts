/**
 * Estrutura do curso pronta para a interface.
 *
 * A página de curso não deve recalcular estado dentro de JSX: esta função
 * transforma curso + matrícula na árvore exata que a tela renderiza, incluindo
 * qual aula é a "atual". Pura e testável, como as regras de `progress.ts`.
 */

import {
  courseDurationSeconds,
  courseProgress,
  formatDuration,
  lessonStatus,
  moduleProgress,
  resumePoint,
  type ProgressSummary,
} from "./progress.ts";
import type { Course, Enrollment } from "./types.ts";

/**
 * `current` é a aula em que o aluno deve retomar. É um papel de interface, não
 * um estado persistido: existe no máximo uma por curso e nunca coexiste com
 * `done` na mesma aula.
 */
export type LessonUiState = "done" | "current" | "todo";

export interface OutlineLesson {
  id: string;
  title: string;
  /** Posição da aula no curso inteiro, começando em 1. */
  index: number;
  /** Já formatada para exibição. */
  duration: string;
  /** Bruta, para quem precisa calcular — a store do cliente, por exemplo. */
  durationSeconds: number;
  state: LessonUiState;
}

export interface OutlineModule {
  id: string;
  title: string;
  lessonCount: number;
  duration: string;
  progress: ProgressSummary;
  lessons: OutlineLesson[];
}

export interface CourseOutline {
  modules: OutlineModule[];
  progress: ProgressSummary;
  duration: string;
  lessonCount: number;
  /** Módulo que deve abrir por padrão: o que contém a aula atual. */
  defaultOpenModuleId: string | null;
  /** Aula de retomada, ou null quando o curso está concluído. */
  currentLessonId: string | null;
}

export function courseOutline(course: Course, enrollment: Enrollment): CourseOutline {
  const resume = resumePoint(course, enrollment);
  const currentLessonId = resume?.lesson.id ?? null;

  let index = 0;
  const modules: OutlineModule[] = course.modules.map((module) => {
    const lessons: OutlineLesson[] = module.lessons.map((lesson) => {
      index += 1;
      const status = lessonStatus(lesson, enrollment);
      const state: LessonUiState =
        status === "completed" ? "done" : lesson.id === currentLessonId ? "current" : "todo";

      return {
        id: lesson.id,
        title: lesson.title,
        index,
        duration: formatDuration(lesson.durationSeconds),
        durationSeconds: lesson.durationSeconds,
        state,
      };
    });

    return {
      id: module.id,
      title: module.title,
      lessonCount: module.lessons.length,
      duration: formatDuration(module.lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0)),
      progress: moduleProgress(module, enrollment),
      lessons,
    };
  });

  return {
    modules,
    progress: courseProgress(course, enrollment),
    duration: formatDuration(courseDurationSeconds(course)),
    lessonCount: index,
    defaultOpenModuleId: resume?.module.id ?? modules[0]?.id ?? null,
    currentLessonId,
  };
}
