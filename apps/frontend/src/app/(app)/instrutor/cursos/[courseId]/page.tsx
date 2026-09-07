import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { EditorView } from "@/features/instructor/editor-view.tsx";
import { QuestionsImport } from "@/features/instructor/questions-import.tsx";
import { getEditorPageData } from "@/features/instructor/data.ts";

export const metadata: Metadata = { title: "Editar curso · Instrutor" };

export default async function EditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const data = await getEditorPageData(courseId);

  /* 404 também quando o curso é de outro instrutor: um curso alheio não pode
     ser distinguido de um inexistente. */
  if (!data) notFound();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Meus cursos", href: "/instrutor/cursos" }, { label: data.course.title }]} />}
      fullName={data.instructor.fullName}
      role={data.instructor.role}
      currentPath="/instrutor/cursos"
      currentKind="location"
    >
      <EditorView
        course={data.course}
        lessons={data.lessons}
        durationSeconds={data.durationSeconds}
        categories={data.categories}
        classes={data.classes}
        instructors={data.instructors}
        materials={data.materials}
      />

      {/* As questões pertencem ao curso: importá-las é continuação de montar o
          curso, não uma tela de administração à parte. */}
      <QuestionsImport courseId={data.course.id} />
    </AppShell>
  );
}
