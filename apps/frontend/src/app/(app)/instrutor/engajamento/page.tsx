import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { EngagementView } from "@/features/instructor/engagement-view.tsx";
import { getEngagementPageData } from "@/features/instructor/data.ts";

export const metadata: Metadata = { title: "Engajamento · Instrutor" };

export default async function EngagementPage() {
  const { instructor, summary, learners, courses } = await getEngagementPageData();

  return (
    <AppShell fullName={instructor.fullName} role={instructor.role} currentPath="/instrutor/engajamento">
      <EngagementView summary={summary} learners={learners} courses={courses} />
    </AppShell>
  );
}
