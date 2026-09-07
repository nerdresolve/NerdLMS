import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { matrizUseCase } from "@nerdlms/backend/courses/tracks-use-case.ts";
import { findAllCourses } from "@nerdlms/backend/courses/courses-repository.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { TracksView } from "@/features/admin/tracks-view.tsx";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";

export const metadata: Metadata = { title: "Trilhas · Admin" };

/* Uma trilha criada agora precisa aparecer ao voltar para a tela. */
export const dynamic = "force-dynamic";

/**
 * Trilhas e matriz de treinamento.
 *
 * Só administrador: trilha define o que uma unidade ou uma função inteira
 * precisa fazer, e isso é decisão de programa de treinamento — não de quem
 * escreve um curso. O caso de uso confere de novo; esconder a tela não é
 * autorização, é só não oferecer o caminho.
 */
export default async function TracksPage() {
  const user = await requireUser();
  if (user.role !== "admin") notFound();

  const [matriz, cursos] = await Promise.all([
    matrizUseCase(actorOf(user)),
    findAllCourses(user.tenant.id),
  ]);

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Administração", href: "/admin" }, { label: "Trilhas" }]} />}
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/admin/trilhas"
    >
      <TracksView
        trilhas={matriz.trilhas.map((trilha) => ({
          id: trilha.id,
          title: trilha.title,
          summary: trilha.summary,
          mode: trilha.mode,
          project: trilha.project ?? null,
          jobTitle: trilha.jobTitle ?? null,
          courseIds: trilha.courseIds,
        }))}
        cursos={cursos.map((curso) => ({ id: curso.id, title: curso.title }))}
        linhas={matriz.linhas}
        semFuncao={matriz.semFuncao}
        unitLabel={user.tenant.unitLabel}
      />
    </AppShell>
  );
}
