import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { TeamView } from "@/features/manager/team-view.tsx";
import { getTeamPageData } from "@/features/manager/data.ts";

export const metadata: Metadata = { title: "Minha equipe · Gestor" };

export default async function TeamPage() {
  const { manager, project, team, courses, classesByCourse } = await getTeamPageData();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Gestão", href: "/gestor" }, { label: "Equipe" }]} />} fullName={manager.fullName} role={manager.role} currentPath="/gestor/equipe">
      <TeamView project={project} team={team} courses={courses} classesByCourse={classesByCourse} />
    </AppShell>
  );
}
