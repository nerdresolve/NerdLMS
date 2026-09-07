import type { Metadata } from "next";

import { requireFeature } from "@/lib/feature-guard.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { AgendaView } from "@/features/learner/agenda-view.tsx";
import { getAgendaPageData } from "@/features/learner/data.ts";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  await requireFeature("agenda");
  const { student, month, upcoming, notifications, unread } = await getAgendaPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/agenda">
      <AgendaView month={month} upcoming={upcoming} notifications={notifications} unread={unread} />
    </AppShell>
  );
}