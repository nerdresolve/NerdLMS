import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { IntegrationsView } from "@/features/admin/integrations-view.tsx";
import { getIntegrationsPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Integrações · Admin" };

/* Chave e webhook mudam entre uma visita e outra — e a chave recém-criada
   precisa aparecer na lista assim que a pessoa volta. */
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { admin, keys, hooks } = await getIntegrationsPageData();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Administração", href: "/admin" }, { label: "Integrações" }]} />} fullName={admin.fullName} role={admin.role} currentPath="/admin/integracoes">
      <IntegrationsView keys={keys} hooks={hooks} />
    </AppShell>
  );
}
