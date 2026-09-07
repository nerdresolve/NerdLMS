import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { CompetenciesView } from "@/features/admin/competencies-view.tsx";
import { getCompetenciesPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Competências · Admin" };

/* O que se cria aqui precisa aparecer ao voltar. */
export const dynamic = "force-dynamic";

export default async function CompetenciasPage() {
  const { admin, frameworks, competencies, plans, courses } = await getCompetenciesPageData();

  return (
    <AppShell fullName={admin.fullName} role={admin.role} currentPath="/admin/competencias">
      <CompetenciesView
        frameworks={frameworks}
        competencies={competencies}
        plans={plans}
        courses={courses}
      />
    </AppShell>
  );
}
