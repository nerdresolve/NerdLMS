import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findPendingReviews } from "@nerdlms/backend/assessment/manual-grade-repository.ts";
import { findUngradedSubmissions } from "@nerdlms/backend/assessment/assignment-repository.ts";
import { findAllCourses } from "@nerdlms/backend/courses/courses-repository.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { GradingView } from "@/features/instructor/grading-view.tsx";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";

export const metadata: Metadata = { title: "Correção · Instrutor" };

/**
 * Fila de correção do instrutor.
 *
 * Percorre os cursos dele: dissertativas sem nota e trabalhos entregues ainda
 * não avaliados. A lista é do INSTRUTOR, não de um curso — quem corrige quer
 * ver tudo o que espera, não navegar curso a curso para descobrir.
 */
export default async function GradingPage() {
  const user = await requireUser();

  if (user.role !== "instructor" && user.role !== "admin") notFound();

  const cursos = (await findAllCourses(user.tenant.id)).filter(
    (curso) => user.role === "admin" || curso.authorId === user.id,
  );

  const essays = (await Promise.all(cursos.map((curso) => findPendingReviews(curso.id)))).flat();

  /* Uma consulta por curso, não um laço aninhado: a primeira versão percorria
     trabalho por trabalho e entrega por entrega pedindo as notas de cada
     matrícula — N+1 consultas que ficariam lentas com uma turma de trinta
     pessoas e cinco trabalhos. */
  const pendentes = (
    await Promise.all(cursos.map((curso) => findUngradedSubmissions(curso.id)))
  ).flat();

  return (
    <AppShell
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/instrutor/correcao"
    >
      <GradingView essays={essays} submissions={pendentes} />
    </AppShell>
  );
}
