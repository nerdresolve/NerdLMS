import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { BadgesView } from "@/features/admin/badges-view.tsx";
import { getBadgesPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Badges · Admin" };

/* Um badge criado agora precisa aparecer ao voltar para a tela. */
export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const { admin, badges, courses, tracks } = await getBadgesPageData();

  return (
    <AppShell fullName={admin.fullName} role={admin.role} currentPath="/admin/badges">
      <BadgesView badges={badges} courses={courses} tracks={tracks} />
    </AppShell>
  );
}
