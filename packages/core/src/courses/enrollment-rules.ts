/**
 * Regras de matrícula.
 *
 * Separadas de `permissions.ts` porque respondem perguntas diferentes: lá é
 * "este papel pode matricular?", aqui é "este curso aceita matrícula?". As
 * duas precisam ser verdadeiras, e confundi-las levaria um aluno a se inscrever
 * num treinamento obrigatório que só o gestor atribui.
 */

import type { Course } from "./types.ts";

/**
 * O recorte do curso que a decisão de matrícula usa.
 *
 * `Course` inteiro não é exigido de propósito: quem chama do servidor tem
 * situação e modo vindos de uma consulta enxuta, e obrigá-lo a montar um curso
 * completo — com título vazio e módulos falsos — só para satisfazer o tipo
 * seria pior que pedir os dois campos.
 */
export type EnrollableCourse = Pick<Course, "status" | "enrollmentMode">;

export type EnrollmentRefusal =
  | "already_enrolled"
  | "course_not_published"
  | "assigned_only"
  /** Matricular alguém que não é da equipe de quem está matriculando. */
  | "outside_team";

export type EnrollmentDecision =
  | { allow: true }
  | { allow: false; reason: EnrollmentRefusal };

export const ENROLLMENT_REFUSAL_MESSAGE: Record<EnrollmentRefusal, string> = {
  already_enrolled: "Você já está matriculado neste curso.",
  course_not_published: "Este curso ainda não está disponível.",
  assigned_only: "A matrícula neste curso é feita pelo seu gestor.",
  outside_team: "Esta pessoa não faz parte da sua equipe.",
};

/**
 * Decide se um aluno pode se auto-matricular.
 *
 * Rascunho e arquivado ficam de fora: um curso não publicado pode estar
 * incompleto, e matricular alguém nele encheria o painel da pessoa com um
 * curso que some depois.
 *
 * `assigned` é o treinamento obrigatório, atribuído pelo gestor (DEC-039).
 * Deixar o aluno entrar sozinho esvaziaria a distinção entre os dois modos.
 */
export function canSelfEnroll(course: EnrollableCourse, alreadyEnrolled: boolean): EnrollmentDecision {
  if (alreadyEnrolled) return { allow: false, reason: "already_enrolled" };
  if (course.status !== "published") return { allow: false, reason: "course_not_published" };
  if (course.enrollmentMode !== "open") return { allow: false, reason: "assigned_only" };

  return { allow: true };
}

/**
 * Decide se um gestor pode matricular alguém da equipe.
 *
 * É o espelho de `canSelfEnroll`, e as diferenças dizem tudo sobre por que as
 * duas existem:
 *
 * - `assigned` aqui é o caso NORMAL, não a recusa. O treinamento obrigatório é
 *   justamente o que o gestor atribui (DEC-039); curso `open` também pode ser
 *   atribuído, porque nada impede o gestor de inscrever a equipe num curso que
 *   a pessoa também poderia pegar sozinha;
 *
 * - o recorte de equipe entra. Sem ele, um gestor matricularia gente de outra
 *   concessionária, e o relatório dele passaria a contar pessoas que não são
 *   dele. A permissão (`can`) responde "este papel matricula?"; esta função
 *   responde "matricula ESTA pessoa?".
 *
 * Curso não publicado continua fora: rascunho pode estar incompleto, e
 * arquivado sumiria do painel de quem foi inscrito.
 */
export function canAssignEnrollment(
  course: EnrollableCourse,
  alreadyEnrolled: boolean,
  sameTeam: boolean,
): EnrollmentDecision {
  if (!sameTeam) return { allow: false, reason: "outside_team" };
  if (alreadyEnrolled) return { allow: false, reason: "already_enrolled" };
  if (course.status !== "published") return { allow: false, reason: "course_not_published" };

  return { allow: true };
}
