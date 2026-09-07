import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findCourseOwnership } from "@nerdlms/backend/courses/course-editor-repository.ts";
import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { findPosts, findTopic } from "@nerdlms/backend/forum/forum-repository.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { TopicView } from "@/features/forum/topic-view.tsx";
import { requireFeature } from "@/lib/feature-guard.ts";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";

export const metadata: Metadata = { title: "Tópico · Fórum" };

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  await requireFeature("forum");

  const { topicId } = await params;
  const user = await requireUser();

  const topic = await findTopic(topicId, user.id);
  if (!topic) notFound();

  /* Quem modera é o autor do curso ou um admin; quem participa está
     matriculado. Um estranho recebe 404 — a mesma resposta de tópico
     inexistente, para não revelar que o curso tem fórum. */
  const ownership = await findCourseOwnership(topic.courseId);
  const canModerate = user.role === "admin" || ownership?.authorId === user.id;

  if (!canModerate && !(await findEnrollmentId(topic.courseId, user.id))) notFound();

  return (
    <AppShell
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/meus-cursos"
      currentKind="location"
    >
      <TopicView
        topic={topic}
        posts={await findPosts(topicId, canModerate)}
        canModerate={canModerate}
        viewerId={user.id}
      />
    </AppShell>
  );
}
