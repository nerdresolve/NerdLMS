import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { AuditView } from "@/features/admin/audit-view.tsx";
import { getAuditPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Auditoria · Admin" };

export default async function AuditPage() {
  const { admin, summary, events, alerts } = await getAuditPageData();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Administração", href: "/admin" }, { label: "Auditoria" }]} />} fullName={admin.fullName} role={admin.role} currentPath="/admin/auditoria">
      <AuditView summary={summary} events={events} alerts={alerts} />
    </AppShell>
  );
}
