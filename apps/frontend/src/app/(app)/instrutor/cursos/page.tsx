import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { StudioView } from "@/features/instructor/studio-view.tsx";
import { CoursesImport } from "@/features/instructor/courses-import.tsx";
import { getStudioPageData } from "@/features/instructor/data.ts";

export const metadata: Metadata = { title: "Meus cursos · Instrutor" };

export default async function StudioPage() {
  const { instructor, courses } = await getStudioPageData();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Instrutor" }, { label: "Meus cursos" }]} />} fullName={instructor.fullName} role={instructor.role} currentPath="/instrutor/cursos">
      <StudioView courses={courses} />

      {/* A importação fica na LISTA, não dentro de um curso: ela cria cursos
          novos, e cursos novos nascem aqui. */}
      <CoursesImport />
    </AppShell>
  );
}
