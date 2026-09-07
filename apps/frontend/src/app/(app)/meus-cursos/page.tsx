import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { CatalogView } from "@/features/catalog/catalog-view.tsx";
import { getCatalogPageData } from "@/features/catalog/data.ts";

export const metadata: Metadata = { title: "Meus cursos" };

export default async function CatalogPage() {
  const { student, entries } = await getCatalogPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/meus-cursos">
      <CatalogView
        entries={entries}
        title="Meus cursos"
        subtitle="Continue de onde parou ou explore novas trilhas da biblioteca."
        emptyTitle="Nenhum curso encontrado"
        emptyText="Ajuste a busca ou volte para a aba Todos para ver a lista completa."
      />
    </AppShell>
  );
}
