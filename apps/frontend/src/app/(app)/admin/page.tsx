import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session.ts";
import { lowerUnit, pluralOfUnit } from "@nerdlms/core/tenancy/unit-label.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { AdminView } from "@/features/admin/admin-view.tsx";
import { getAdminPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Painel da plataforma · Admin" };

export default async function AdminPage() {
  const { tenant } = await requireUser();
  const { admin, stats, byProject, audit, alerts } = await getAdminPageData();

  return (
    <AppShell fullName={admin.fullName} role={admin.role} currentPath="/admin">
      <AdminView
        stats={stats}
        byProject={byProject}
        audit={audit}
        alerts={alerts}
        unitLower={lowerUnit(tenant.unitLabel)}
        unitPlural={pluralOfUnit(tenant.unitLabel)}
      />
    </AppShell>
  );
}
