import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { CourseView } from "@/features/course/course-view.tsx";
import { getCoursePageData } from "@/features/course/data.ts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCoursePageData(slug);
  return { title: data?.course.title ?? "Curso não encontrado" };
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getCoursePageData(slug);

  // Curso inexistente e curso sem matrícula respondem igual: 404.
  if (!data) notFound();

  return (
    <AppShell
      fullName={data.student.fullName}
      role={data.student.role}
      currentPath="/meus-cursos"
      currentKind="location"
      topbar={<Breadcrumb items={[{ label: "Meus cursos", href: "/meus-cursos" }, { label: data.course.title }]} />}
    >
      <CourseView
        course={data.course}
        outline={data.outline}
        enrolled={data.enrolled}
        saved={data.saved}
        quiz={data.quiz}
        estado={data.estado}
        podeEditar={data.podeEditar}
      />
    </AppShell>
  );
}
