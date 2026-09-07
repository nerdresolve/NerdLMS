import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { CatalogView } from "@/features/catalog/catalog-view.tsx";
import { getCatalogPageData } from "@/features/catalog/data.ts";

export const metadata: Metadata = { title: "Concluídos" };

export default async function CompletedPage() {
  const { student, entries } = await getCatalogPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/concluidos">
      <CatalogView
        entries={entries}
        initialFilter="completed"
        showTabs={false}
        title="Concluídos"
        subtitle="Os cursos que você terminou. Quando o curso tem prova, o certificado depende também da nota."
        emptyTitle="Você ainda não concluiu nenhum curso"
        emptyText="Assim que terminar a última aula de um curso, ele aparece aqui com o certificado."
      />
    </AppShell>
  );
}
