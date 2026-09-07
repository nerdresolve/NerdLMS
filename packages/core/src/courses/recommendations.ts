/**
 * Recomendação de cursos.
 *
 * A proposta promete um "motor de recomendação" que sugere o próximo passo com
 * base no perfil e no histórico. Isto é a versão baseada em regras, e ela é
 * suficiente para o volume típico de um cliente: ~76 cursos e quatro unidades.
 *
 * Duas decisões que valem mais que o algoritmo em si:
 *
 * 1. **Toda recomendação carrega o motivo.** Sugestão sem explicação parece
 *    aleatória, e o aluno aprende a ignorar. "Próximo passo da trilha Operação
 *    de Água" é acionável; "recomendado para você" não é.
 * 2. **Sinais somam e são auditáveis.** Nada de caixa-preta: cada regra tem
 *    peso declarado e pode ser desligada. Quando houver histórico real, a
 *    calibragem é ajustar números aqui, não trocar de arquitetura.
 *
 * O que esta versão NÃO faz: aprender com o comportamento coletivo. Isso exige
 * base real e é decisão de escopo à parte.
 */

import type { Course, Enrollment, User } from "./types.ts";
import type { Track } from "./tracks.ts";

/** Pesos de cada sinal. Ajustar aqui é a calibragem inteira. */
export const WEIGHTS = {
  /** Curso obrigatório ainda não feito. Vence tudo: é exigência, não sugestão. */
  mandatory: 100,
  /** Próximo curso de uma trilha que a pessoa já começou. */
  trackNext: 60,
  /** Curso de trilha que a pessoa ainda não começou. */
  trackMember: 20,
  /** Mesmo projeto da pessoa. */
  sameProject: 25,
  /** Mesmo autor de um curso que a pessoa concluiu. */
  sameAuthor: 15,
  /** Popular entre colegas do mesmo projeto. */
  popular: 10,
} as const;

export interface Recommendation {
  course: Course;
  score: number;
  /** Motivo principal, em linguagem de gente. */
  reason: string;
}

interface Context {
  user: User;
  courses: Course[];
  /** Matrículas da própria pessoa. */
  enrollments: Enrollment[];
  /** Matrículas de todo mundo, para o sinal de popularidade. */
  allEnrollments: Enrollment[];
  tracks: Track[];
  /** Cursos já concluídos, por id. */
  completedCourseIds: Set<string>;
}

function trackSignal(course: Course, context: Context): { points: number; reason: string } | null {
  for (const track of context.tracks) {
    const index = track.courseIds.indexOf(course.id);
    if (index === -1) continue;

    const anteriores = track.courseIds.slice(0, index);
    const comecou = track.courseIds.some((id) => context.enrollments.some((item) => item.courseId === id));
    const anterioresFeitos = anteriores.every((id) => context.completedCourseIds.has(id));

    if (comecou && anterioresFeitos) {
      return { points: WEIGHTS.trackNext, reason: `Próximo passo da trilha ${track.title}` };
    }
    if (comecou) {
      return { points: WEIGHTS.trackMember, reason: `Faz parte da trilha ${track.title}` };
    }
    return { points: WEIGHTS.trackMember / 2, reason: `Compõe a trilha ${track.title}` };
  }
  return null;
}

function popularityOf(courseId: string, context: Context): number {
  const colegas = new Set(
    context.allEnrollments
      .filter((item) => item.learnerId !== context.user.id)
      .map((item) => item.learnerId),
  );
  if (colegas.size === 0) return 0;

  const inscritos = context.allEnrollments.filter(
    (item) => item.courseId === courseId && item.learnerId !== context.user.id,
  ).length;

  return inscritos / colegas.size;
}

/**
 * Recomenda cursos em que a pessoa ainda não está matriculada.
 * Retorna no máximo `limit`, do mais relevante ao menos.
 */
export function recommend(
  {
    user,
    courses,
    enrollments,
    allEnrollments,
    tracks,
  }: Omit<Context, "completedCourseIds">,
  limit = 4,
): Recommendation[] {
  const matriculado = new Set(enrollments.map((item) => item.courseId));

  const completedCourseIds = new Set(
    enrollments
      .filter((enrollment) => {
        const course = courses.find((item) => item.id === enrollment.courseId);
        if (!course) return false;
        const total = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
        const feitas = Object.keys(enrollment.progress).length;
        return total > 0 && feitas >= total;
      })
      .map((enrollment) => enrollment.courseId),
  );

  const context: Context = { user, courses, enrollments, allEnrollments, tracks, completedCourseIds };

  const autoresConcluidos = new Set(
    courses.filter((course) => completedCourseIds.has(course.id)).map((course) => course.authorId),
  );

  return courses
    .filter((course) => course.status === "published")
    // Nunca recomendar o que a pessoa já faz: sugestão redundante corrói a confiança.
    .filter((course) => !matriculado.has(course.id))
    .map((course) => {
      let score = 0;
      let reason = "Novo no catálogo";

      if (course.enrollmentMode === "assigned") {
        score += WEIGHTS.mandatory;
        reason = "Treinamento obrigatório pendente";
      }

      const trilha = trackSignal(course, context);
      if (trilha) {
        score += trilha.points;
        if (trilha.points >= WEIGHTS.trackNext || score === trilha.points) reason = trilha.reason;
      }

      if (course.project && course.project === user.project) {
        score += WEIGHTS.sameProject;
        if (score === WEIGHTS.sameProject) reason = `Do seu projeto: ${course.project}`;
      }

      if (autoresConcluidos.has(course.authorId)) {
        score += WEIGHTS.sameAuthor;
        if (score === WEIGHTS.sameAuthor) reason = "De quem escreveu um curso que você concluiu";
      }

      const popularidade = popularityOf(course.id, context);
      if (popularidade > 0) {
        score += Math.round(popularidade * WEIGHTS.popular);
        if (score === Math.round(popularidade * WEIGHTS.popular)) {
          reason = `Popular entre colegas (${Math.round(popularidade * 100)}%)`;
        }
      }

      return { course, score, reason };
    })
    .sort((a, b) => (b.score === a.score ? a.course.title.localeCompare(b.course.title, "pt-BR") : b.score - a.score))
    .slice(0, limit);
}
