import type { Metadata } from "next";

import { requireFeature } from "@/lib/feature-guard.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { CatalogView } from "@/features/catalog/catalog-view.tsx";
import { getCatalogPageData } from "@/features/catalog/data.ts";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  await requireFeature("favoritos");
  const { student, entries } = await getCatalogPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/favoritos">
      <CatalogView
        entries={entries}
        initialFilter="saved"
        showTabs={false}
        title="Favoritos"
        subtitle="Os cursos que você salvou para assistir depois."
        emptyTitle="Nenhum curso salvo ainda"
        emptyText="Use o marcador na página do curso para guardar o que quiser ver mais tarde."
      />
    </AppShell>
  );
}
