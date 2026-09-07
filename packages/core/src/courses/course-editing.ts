/**
 * Regras de edição e publicação de curso.
 *
 * A regra de publicação já existia em `learner-store.js`, para o protótipo.
 * Aqui ela vira contrato do servidor — as duas superfícies precisam recusar as
 * mesmas coisas, senão o protótipo promete o que a plataforma não cumpre.
 */

import type { Module } from "./types.ts";

export const TITLE_MAX_LENGTH = 200;
export const SUMMARY_MAX_LENGTH = 2000;

export type CourseRefusal =
  | "title_required"
  | "title_too_long"
  | "summary_too_long"
  | "no_lessons";

export const COURSE_REFUSAL_MESSAGE: Record<CourseRefusal, string> = {
  title_required: "O curso precisa de um título.",
  title_too_long: `O título pode ter no máximo ${TITLE_MAX_LENGTH} caracteres.`,
  summary_too_long: `O resumo pode ter no máximo ${SUMMARY_MAX_LENGTH} caracteres.`,
  no_lessons: "Adicione ao menos uma aula antes de publicar.",
};

export type CourseEdit = { title: string; summary: string };

export type CourseEditDecision =
  | { ok: true; title: string; summary: string }
  | { ok: false; reason: CourseRefusal };

/**
 * Valida os campos editáveis do curso.
 *
 * O corte de espaços vem antes da medida, pela mesma razão do comentário: um
 * título de espaços é um título ausente.
 */
export function validateCourseEdit(edit: CourseEdit): CourseEditDecision {
  const title = edit.title.trim();
  const summary = edit.summary.trim();

  if (title.length === 0) return { ok: false, reason: "title_required" };
  if (title.length > TITLE_MAX_LENGTH) return { ok: false, reason: "title_too_long" };
  if (summary.length > SUMMARY_MAX_LENGTH) return { ok: false, reason: "summary_too_long" };

  return { ok: true, title, summary };
}

export type PublishDecision = { ok: true } | { ok: false; reason: CourseRefusal };

/**
 * Decide se o curso pode ser publicado.
 *
 * **Curso sem aula não publica.** Publicar um curso vazio matricularia alunos
 * em nada, e o progresso dele seria 0% para sempre — a pessoa veria uma barra
 * que nunca anda, sem entender por quê.
 */
export function canPublish(course: { title: string; lessonCount: number }): PublishDecision {
  if (course.title.trim().length === 0) return { ok: false, reason: "title_required" };
  if (course.lessonCount === 0) return { ok: false, reason: "no_lessons" };

  return { ok: true };
}

/** Conta as aulas de um curso montado. Atalho para quem já tem os módulos. */
export function lessonCountOf(course: { modules: Module[] }): number {
  return course.modules.reduce((total, module) => total + module.lessons.length, 0);
}

/**
 * Minutos digitados viram segundos.
 *
 * `unknown` de propósito: o valor vem de um `<input>`, que entrega string, e a
 * pessoa digita o que quiser. Converter aqui, uma vez, evita que cada chamada
 * repita o tratamento — e duração inválida vira 0 em vez de NaN, porque NaN
 * contamina todo o cálculo de progresso adiante.
 */
export function durationFromMinutes(minutes: unknown): number {
  const value = Number(minutes);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 60) : 0;
}
