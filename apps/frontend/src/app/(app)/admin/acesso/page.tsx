import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { LdapView } from "@/features/admin/ldap-view.tsx";
import { SsoView } from "@/features/admin/sso-view.tsx";
import { getSsoPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Acesso · Admin" };

/* A URL de retorno depende do domínio da requisição, e o white-label serve
   vários no mesmo build: cachear entregaria o endereço de um cliente a outro. */
export const dynamic = "force-dynamic";

export default async function AcessoPage() {
  const { admin, providers, redirectUri, diretorios } = await getSsoPageData();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Administração", href: "/admin" }, { label: "Acesso" }]} />} fullName={admin.fullName} role={admin.role} currentPath="/admin/acesso">
      <SsoView providers={providers} redirectUri={redirectUri} />
      <LdapView diretorios={diretorios} />
    </AppShell>
  );
}
