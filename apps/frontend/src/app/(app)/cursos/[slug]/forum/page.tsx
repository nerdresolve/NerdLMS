import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findAllCourses } from "@nerdlms/backend/courses/courses-repository.ts";
import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { findTopics } from "@nerdlms/backend/forum/forum-repository.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { ForumView } from "@/features/forum/forum-view.tsx";
import { requireFeature } from "@/lib/feature-guard.ts";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";

export const metadata: Metadata = { title: "Fórum do curso" };

export default async function CourseForumPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireFeature("forum");

  const { slug } = await params;
  const user = await requireUser();

  const curso = (await findAllCourses(user.tenant.id)).find((item) => item.slug === slug);
  if (!curso) notFound();

  const canModerate = user.role === "admin" || curso.authorId === user.id;
  if (!canModerate && !(await findEnrollmentId(curso.id, user.id))) notFound();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Meus cursos", href: "/meus-cursos" }, { label: "Fórum do curso" }]} />}
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/meus-cursos"
      currentKind="location"
    >
      <ForumView
        courseId={curso.id}
        courseTitle={curso.title}
        topics={await findTopics(curso.id, user.id)}
        canModerate={canModerate}
      />
    </AppShell>
  );
}
