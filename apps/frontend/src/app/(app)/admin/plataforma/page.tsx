import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { BackupView } from "@/features/admin/backup-view.tsx";
import { EmailTemplates } from "@/features/admin/email-templates.tsx";
import { PlatformView } from "@/features/admin/platform-view.tsx";
import { getPlatformPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Plataforma · Admin" };

export default async function PlatformPage() {
  const { admin, tenantName, features, branding, emailTemplates } = await getPlatformPageData();

  return (
    <AppShell fullName={admin.fullName} role={admin.role} currentPath="/admin/plataforma">
      <PlatformView tenantName={tenantName} features={features} branding={branding} />

      {/* Os textos de e-mail vivem aqui, junto do branding: as duas coisas
          respondem "como este cliente se apresenta". */}
      <EmailTemplates saved={emailTemplates} />

      {/* Backup fica na configuração da plataforma, junto de marca e textos:
          as três respondem "como este cliente está montado". */}
      <BackupView />
    </AppShell>
  );
}
