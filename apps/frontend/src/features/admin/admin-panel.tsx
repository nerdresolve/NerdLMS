import { requireUser } from "@/lib/auth/session.ts";
import { lowerUnit } from "@nerdlms/core/tenancy/unit-label.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { AdminView } from "@/features/admin/admin-view.tsx";
import { getAdminPageData } from "@/features/admin/data.ts";

/** O painel de quem administra a organização. */
export async function AdminPanel({ currentPath }: { currentPath: string }) {
  const { tenant } = await requireUser();
  const { admin, stats, byProject, audit, alerts } = await getAdminPageData();

  return (
    <AppShell fullName={admin.fullName} role={admin.role} currentPath={currentPath}>
      <AdminView
        stats={stats}
        byProject={byProject}
        audit={audit}
        alerts={alerts}
        unitLower={lowerUnit(tenant.unitLabel)}
        unitLabel={tenant.unitLabel}
      />
    </AppShell>
  );
}
