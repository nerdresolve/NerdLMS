import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { LessonView } from "@/features/lesson/lesson-view.tsx";
import { getLessonPageData } from "@/features/lesson/data.ts";

/* A tela de aula bloqueada reaproveita o estilo das páginas de estado. */
import "@/styles/status-page.css";

interface PageProps {
  params: Promise<{ lessonId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lessonId } = await params;
  const data = await getLessonPageData(lessonId);
  if (!data || "blocked" in data) return { title: "Aula bloqueada" };
  return { title: data.view.lesson.title };
}

export default async function LessonPage({ params }: PageProps) {
  const { lessonId } = await params;
  const data = await getLessonPageData(lessonId);

  if (!data) notFound();

  /* Aula existente e ainda fechada (F2-05).
     
     Não é 404: a aula existe e a pessoa está matriculada no curso — dizer que
     não existe seria mentira e deixaria quem chegou pelo link sem entender por
     quê. A tela explica o que falta e oferece a volta ao curso. */
  if ("blocked" in data) {
    return (
      <main className="status-page">
        <div className="status-page__card">
          <p className="status-page__code">Bloqueada</p>
          <h1 className="status-page__title">Esta aula ainda não abriu</h1>
          <p className="status-page__text">{data.reason}</p>
          <div className="status-page__actions">
            <a className="btn btn--primary" href="/meus-cursos">
              Voltar aos meus cursos
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <AppShell
      fullName={data.student.fullName}
      role={data.student.role}
      currentPath="/meus-cursos"
      currentKind="location"
      topbar={
        <Breadcrumb
          items={[
            { label: "Meus cursos", href: "/meus-cursos" },
            { label: data.course.title, href: `/cursos/${data.course.slug}` },
            { label: data.view.module.title },
          ]}
        />
      }
    >
      <LessonView
        course={data.course}
        view={data.view}
        mediaSrc={data.mediaSrc}
        materials={data.materials}
        comments={data.comments}
        viewerId={data.student.id}
        courseAuthorId={data.course.authorId}
        {...(data.scorm ? { scorm: data.scorm } : {})}
        authorInitials={data.student.fullName
          .split(" ")
          .map((part) => part[0] ?? "")
          .slice(0, 2)
          .join("")}
      />
    </AppShell>
  );
}
