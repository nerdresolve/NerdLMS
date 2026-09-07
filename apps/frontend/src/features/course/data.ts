import "server-only";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { courseOutline, type CourseOutline } from "@nerdlms/core/courses/outline.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import type { Course, Enrollment, User } from "@nerdlms/core/courses/types.ts";

export interface CoursePageData {
  student: User;
  course: Course;
  outline: CourseOutline;
  /** `false` quando a pessoa está só visitando: a tela troca o call to action. */
  enrolled: boolean;
  /** Estado do marcador. Sem matrícula não há onde guardar, então é `false`. */
  saved: boolean;
}

/**
 * Camada de dados da página de curso.
 *
 * Retorna null quando o curso não existe, quando o papel não pode lê-lo ou
 * quando não há matrícula — a resposta é a mesma nos três casos, para que um
 * curso inacessível não possa ser distinguido de um inexistente
 * (/§18).
 */
export async function getCoursePageData(slug: string): Promise<CoursePageData | null> {
  const user = await requireUser();
  const [courses, mine] = await Promise.all([findAllCourses(user.tenant.id), findEnrollments(user.id)]);
  const actor = actorOf(user);

  const course = courses.find((item) => item.slug === slug);
  if (!course) return null;

  /* `findEnrollments(user.id)` já recortou por pessoa, então basta achar o
     curso — filtrar por aluno de novo seria redundante e daria a impressão de
     que a consulta traz gente demais.

     Vem ANTES da checagem porque a permissão depende dela: curso arquivado
     continua legível para quem já o cursava. */
  const enrollment = mine.find((item) => item.courseId === course.id);

  // Rascunho só aparece para quem pode lê-lo; para os demais é como se não
  // existisse — nunca um 403 que confirme a existência do curso.
  if (
    !can(actor, "read", {
      kind: "course",
      authorId: course.authorId,
      status: course.status,
      enrolled: enrollment !== undefined,
    })
  ) {
    return null;
  }

  /* Sem matrícula a página ABRE, com o conteúdo do curso e progresso zerado.
     Antes devolvia `null` aqui, e isso virava 404: o catálogo lista todo curso
     publicado, mas clicar num que a pessoa ainda não cursava levava a "página
     não encontrada". Valia para o aluno em curso que não fazia e para
     instrutor, gestor e admin em TODOS os cursos, já que ninguém desses tem
     matrícula. A permissão de leitura foi checada logo acima; matrícula diz
     respeito a progresso, não a acesso. */
  const visitante: Enrollment = {
    courseId: course.id,
    learnerId: user.id,
    enrolledBy: "self",
    progress: {},
  };

  return {
    student: toDisplayUser(user),
    course,
    outline: courseOutline(course, enrollment ?? visitante),
    enrolled: enrollment !== undefined,
    saved: enrollment?.saved === true,
  };
}
