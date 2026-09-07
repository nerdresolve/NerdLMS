import "server-only";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { estadoDasProvas } from "@nerdlms/backend/assessment/retake-repository.ts";
import { estadoDoCurso } from "@nerdlms/core/courses/completion.ts";
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import type { DashboardData } from "./dashboard-view.tsx";

/**
 * Camada de dados do dashboard.
 *
 * Lê do PostgreSQL. O id da sessão **é** o id do banco, então não há tradução
 * no caminho.
 *
 * `DashboardView` não mudou nem vai mudar: ela recebe `Course` e `Enrollment`,
 * e é o repositório que devolve exatamente essa forma. Era essa a razão de a
 * indireção existir.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const user = await requireUser();

  /* As duas consultas são independentes: buscar em paralelo economiza uma
     viagem inteira ao banco no caminho mais visitado da aplicação. */
  const [courses, mine, provas] = await Promise.all([
    findAllCourses(user.tenant.id),
    findEnrollments(user.id),
    /* O estado das provas entra aqui porque "concluído" deixou de ser só das
       aulas: sem isto o painel contava como finalizado quem ainda deve a prova,
       e o cartão trazia selo de concluído enquanto o certificado era recusado. */
    estadoDasProvas(user.id),
  ]);

  const enrolledIds = new Set(mine.map((enrollment) => enrollment.courseId));

  return {
    student: toDisplayUser(user),
    entries: courses
      /* Curso arquivado sai do painel pelo mesmo motivo que sai do catálogo:
         foi retirado de circulação. */
      .filter((course) => enrolledIds.has(course.id) && course.status !== "archived")
      .flatMap((course) => {
        const enrollment = mine.find((item) => item.courseId === course.id);
        /* Sem `!`: se a matrícula sumir entre as duas consultas, a linha some
           da lista em vez de derrubar a página inteira. */
        if (!enrollment) return [];

        return [
          {
            course,
            enrollment,
            estado: estadoDoCurso(courseProgress(course, enrollment), {
              notaMinima: course.minGradePercent ?? null,
              melhorPercentual: provas.get(course.id)?.melhorPercentual ?? null,
            }),
          },
        ];
      }),
    hour: new Date().getHours(),
  };
}
