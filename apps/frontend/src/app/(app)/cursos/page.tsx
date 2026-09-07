import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { CatalogView } from "@/features/catalog/catalog-view.tsx";
import { getLibraryPageData } from "@/features/catalog/data.ts";

export const metadata: Metadata = { title: "Todos os cursos" };

/**
 * Biblioteca — o catálogo inteiro.
 *
 * Diferença para "Meus cursos": aqui aparecem também os cursos em que o aluno
 * ainda não está matriculado. É a tela de descobrir conteúdo novo, então
 * esconder o que a pessoa não cursa esvaziaria justamente o seu propósito.
 */
export default async function LibraryPage() {
  const { student, entries, categories } = await getLibraryPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/cursos">
      <CatalogView
        entries={entries}
        categories={categories}
        title="Todos os cursos"
        subtitle="A biblioteca completa da Exemplo S.A.. Encontre um tema e comece quando quiser."
        showEnroll
        emptyTitle="Nenhum curso encontrado"
        emptyText="Ajuste a busca ou limpe os filtros para ver a biblioteca completa."
      />
    </AppShell>
  );
}
