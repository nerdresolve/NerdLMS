import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { SsoView } from "@/features/admin/sso-view.tsx";
import { getSsoPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Acesso · Admin" };

/* A URL de retorno depende do domínio da requisição, e o white-label serve
   vários no mesmo build: cachear entregaria o endereço de um cliente a outro. */
export const dynamic = "force-dynamic";

export default async function AcessoPage() {
  const { admin, providers, directories, saml, redirectUri, samlAcsUrl, samlEntityId } =
    await getSsoPageData();

  return (
    <AppShell fullName={admin.fullName} role={admin.role} currentPath="/admin/acesso">
      <SsoView
        providers={providers}
        directories={directories}
        saml={saml}
        redirectUri={redirectUri}
        samlAcsUrl={samlAcsUrl}
        samlEntityId={samlEntityId}
      />
    </AppShell>
  );
}
