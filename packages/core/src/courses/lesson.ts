/**
 * Dados da página de aula — TASK-011A.
 *
 * Resolve a aula pedida dentro do curso e devolve tudo o que a tela precisa:
 * o módulo a que pertence, a posição, as aulas vizinhas e a trilha lateral.
 * Puro e testável, como o resto de `lib/courses`.
 */

import { courseOutline, type CourseOutline, type OutlineLesson } from "./outline.ts";
import { formatDuration, lessonStatus } from "./progress.ts";
import type { Course, Enrollment, Lesson, Module } from "./types.ts";

export interface LessonNeighbour {
  id: string;
  title: string;
}

export interface LessonView {
  lesson: Lesson;
  module: Module;
  /** Posição da aula no curso inteiro, começando em 1. */
  index: number;
  duration: string;
  durationSeconds: number;
  /** Segundo em que o vídeo deve começar. */
  resumeAtSeconds: number;
  /** Páginas do documento por onde a pessoa já passou (aula de conteúdo). */
  pagesSeen: number[];
  completed: boolean;
  previous: LessonNeighbour | null;
  next: LessonNeighbour | null;
  outline: CourseOutline;
}

/** Marca a aula aberta como "current" na trilha, mesmo que outra fosse a retomada. */
function withCurrent(outline: CourseOutline, lessonId: string): CourseOutline {
  return {
    ...outline,
    currentLessonId: lessonId,
    modules: outline.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson): OutlineLesson => {
        if (lesson.id === lessonId) return { ...lesson, state: "current" };
        // a antiga "current" volta a ser pendente; concluída continua concluída
        return lesson.state === "current" ? { ...lesson, state: "todo" } : lesson;
      }),
    })),
    defaultOpenModuleId:
      outline.modules.find((module) => module.lessons.some((lesson) => lesson.id === lessonId))?.id ??
      outline.defaultOpenModuleId,
  };
}

export function lessonView(course: Course, enrollment: Enrollment, lessonId: string): LessonView | null {
  const flat = course.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
  const position = flat.findIndex((item) => item.lesson.id === lessonId);
  if (position === -1) return null;

  const entry = flat[position];
  if (!entry) return null;

  const { lesson, module } = entry;
  const progress = enrollment.progress[lesson.id];
  /* Retomar usa a POSIÇÃO; o consumo mede outra coisa e só cresce. */
  const retomada = progress?.lastPositionSeconds ?? 0;
  const completed = lessonStatus(lesson, enrollment) === "completed";

  const previous = flat[position - 1];
  const next = flat[position + 1];

  return {
    lesson,
    module,
    index: position + 1,
    duration: formatDuration(lesson.durationSeconds),
    durationSeconds: lesson.durationSeconds,
    // Aula concluída recomeça do zero: retomar aos 95% não ajuda ninguém.
    resumeAtSeconds: completed ? 0 : Math.max(0, Math.min(retomada, lesson.durationSeconds)),
    pagesSeen: progress?.pagesSeen ?? [],
    completed,
    previous: previous ? { id: previous.lesson.id, title: previous.lesson.title } : null,
    next: next ? { id: next.lesson.id, title: next.lesson.title } : null,
    outline: withCurrent(courseOutline(course, enrollment), lesson.id),
  };
}

/** Formata segundos como mm:ss ou h:mm:ss, para o cronômetro do player. */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}
