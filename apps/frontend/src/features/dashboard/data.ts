import "server-only";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
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
  const [courses, mine] = await Promise.all([findAllCourses(user.tenant.id), findEnrollments(user.id)]);

  const enrolledIds = new Set(mine.map((enrollment) => enrollment.courseId));

  return {
    student: toDisplayUser(user),
    entries: courses
      .filter((course) => enrolledIds.has(course.id))
      .flatMap((course) => {
        const enrollment = mine.find((item) => item.courseId === course.id);
        /* Sem `!`: se a matrícula sumir entre as duas consultas, a linha some
           da lista em vez de derrubar a página inteira. */
        return enrollment ? [{ course, enrollment }] : [];
      }),
    hour: new Date().getHours(),
  };
}
