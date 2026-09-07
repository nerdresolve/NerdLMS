import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findPendingReviews } from "@nerdlms/backend/assessment/manual-grade-repository.ts";
import { findUngradedSubmissions } from "@nerdlms/backend/assessment/assignment-repository.ts";
import { findAllCourses } from "@nerdlms/backend/courses/courses-repository.ts";
import { pedidosPendentes } from "@nerdlms/backend/assessment/retake-repository.ts";
import { filaDeEficaciaUseCase } from "@nerdlms/backend/assessment/effectiveness-use-case.ts";
import { prazoEmPalavras } from "@nerdlms/core/assessment/eficacia.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { GradingView } from "@/features/instructor/grading-view.tsx";
import { RetakeQueue } from "@/features/instructor/retake-queue.tsx";
import { EffectivenessQueue } from "@/features/instructor/effectiveness-queue.tsx";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";

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

  /* Administrador vê a fila inteira do cliente; instrutor, só a dos cursos que
     são dele. É o mesmo recorte por autoria que decide quem edita o curso — e
     `null` é o que a consulta entende como "sem recorte". */
  const retestes = await pedidosPendentes(
    user.tenant.id,
    user.role === "admin" ? null : user.id,
  );

  /* A avaliação de eficácia é a terceira pendência do instrutor, e a única com
     prazo legal correndo. Vem da mesma tela pelo mesmo motivo das outras duas:
     o que não se olha não se faz. */
  const eficacia = await filaDeEficaciaUseCase(actorOf(user));

  const formatarData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Instrutor", href: "/instrutor/cursos" }, { label: "Correção" }]} />}
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/instrutor/correcao"
    >
      <GradingView essays={essays} submissions={pendentes} />

      {/* O prazo é calculado e escrito no SERVIDOR.

          "Faltam 12 dias" depende de que horas são, e o relógio do navegador
          não é o mesmo do servidor — em particular numa máquina com o fuso
          errado, que é comum em campo. Mandar o texto pronto tira a data do
          alcance do cliente. */}
      <EffectivenessQueue
        itens={eficacia.map((item) => ({
          enrollmentId: item.enrollmentId,
          courseTitle: item.courseTitle,
          learnerName: item.learnerName,
          learnerProject: item.learnerProject,
          concluidoEm: formatarData.format(item.concluidoEm),
          prazo: prazoEmPalavras({ concluidoEm: item.concluidoEm, hoje: new Date() }),
          situacao: item.situacao,
        }))}
      />

      <RetakeQueue
        pedidos={retestes.map((pedido) => ({
          id: pedido.id,
          learnerName: pedido.learnerName,
          courseTitle: pedido.courseTitle,
          quizTitle: pedido.quizTitle,
          learnerNote: pedido.learnerNote,
          melhorPercentual: pedido.melhorPercentual,
          tentativasUsadas: pedido.tentativasUsadas,
          pedidoEm: formatarData.format(pedido.createdAt),
        }))}
      />
    </AppShell>
  );
}
