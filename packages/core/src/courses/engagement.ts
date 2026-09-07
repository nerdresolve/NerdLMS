/**
 * Métricas de engajamento.
 *
 * Funções puras sobre curso + matrículas. Servem ao instrutor (recorte: cursos
 * de sua autoria) e ao admin (recorte: plataforma inteira). O recorte é
 * responsabilidade de quem chama, com base em `can(...)`; aqui só se calcula.
 *
 * Nenhuma métrica é média de média: agregar percentuais já agregados distorce
 * quando as turmas têm tamanhos diferentes.
 */

import { courseProgress } from "./progress.ts";
import type { Course, Enrollment } from "./types.ts";

export interface CourseEngagement {
  course: Course;
  /** Matriculados neste curso. */
  learners: number;
  /** Média de conclusão, ponderada por aula e não por aluno. */
  averagePercent: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  /** Total de aulas concluídas somando todos os alunos. */
  lessonsCompleted: number;
}

export function courseEngagement(course: Course, enrollments: Enrollment[]): CourseEngagement {
  const relevant = enrollments.filter((enrollment) => enrollment.courseId === course.id);
  const summaries = relevant.map((enrollment) => courseProgress(course, enrollment));

  const lessonsCompleted = summaries.reduce((total, summary) => total + summary.completed, 0);
  const lessonsPossible = summaries.reduce((total, summary) => total + summary.total, 0);

  return {
    course,
    learners: relevant.length,
    // Ponderada: um curso de 20 aulas pesa mais que um de 4, como deve ser.
    averagePercent: lessonsPossible === 0 ? 0 : Math.round((lessonsCompleted / lessonsPossible) * 100),
    completed: summaries.filter((summary) => summary.status === "completed").length,
    inProgress: summaries.filter((summary) => summary.status === "in_progress").length,
    notStarted: summaries.filter((summary) => summary.status === "not_started").length,
    lessonsCompleted,
  };
}

export interface EngagementSummary {
  courses: CourseEngagement[];
  /** Pessoas distintas, não soma de matrículas: quem faz dois cursos conta uma vez. */
  learners: number;
  enrollments: number;
  averagePercent: number;
  completions: number;
}

export function engagementSummary(courses: Course[], enrollments: Enrollment[]): EngagementSummary {
  const perCourse = courses.map((course) => courseEngagement(course, enrollments));

  const courseIds = new Set(courses.map((course) => course.id));
  const relevant = enrollments.filter((enrollment) => courseIds.has(enrollment.courseId));

  const lessonsCompleted = perCourse.reduce((total, item) => total + item.lessonsCompleted, 0);
  const lessonsPossible = courses.reduce((total, course) => {
    const learners = relevant.filter((enrollment) => enrollment.courseId === course.id).length;
    return total + learners * course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  }, 0);

  return {
    courses: perCourse.sort((a, b) => b.learners - a.learners),
    learners: new Set(relevant.map((enrollment) => enrollment.learnerId)).size,
    enrollments: relevant.length,
    averagePercent: lessonsPossible === 0 ? 0 : Math.round((lessonsCompleted / lessonsPossible) * 100),
    completions: perCourse.reduce((total, item) => total + item.completed, 0),
  };
}

export interface LearnerRow {
  learnerId: string;
  courseId: string;
  percent: number;
  status: "not_started" | "in_progress" | "completed";
}

/** Uma linha por matrícula, para a tabela de acompanhamento. */
export function learnerRows(courses: Course[], enrollments: Enrollment[]): LearnerRow[] {
  const byId = new Map(courses.map((course) => [course.id, course]));

  return enrollments.flatMap((enrollment) => {
    const course = byId.get(enrollment.courseId);
    if (!course) return [];
    const summary = courseProgress(course, enrollment);
    return [
      {
        learnerId: enrollment.learnerId,
        courseId: course.id,
        percent: summary.percent,
        status: summary.status,
      },
    ];
  });
}
