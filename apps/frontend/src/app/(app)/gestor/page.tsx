import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session.ts";
import { lowerUnit } from "@nerdlms/core/tenancy/unit-label.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { ManagerView } from "@/features/manager/manager-view.tsx";
import { getManagerPageData } from "@/features/manager/data.ts";

export const metadata: Metadata = { title: "Painel do projeto · Gestor" };

export default async function ManagerPage() {
  const { tenant } = await requireUser();
  const { manager, project, stats, courses } = await getManagerPageData();

  return (
    <AppShell fullName={manager.fullName} role={manager.role} currentPath="/gestor">
      <ManagerView
        project={project}
        stats={stats}
        courses={courses}
        unitLower={lowerUnit(tenant.unitLabel)}
      />
    </AppShell>
  );
}
