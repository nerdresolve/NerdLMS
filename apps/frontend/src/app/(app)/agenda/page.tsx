import type { Metadata } from "next";

import { requireFeature } from "@/lib/feature-guard.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { AgendaView } from "@/features/learner/agenda-view.tsx";
import { getAgendaPageData } from "@/features/learner/data.ts";

/* O calendário é montado a partir de `new Date()`: cacheá-lo congelaria o mês
   e o "hoje" no instante do build. Hoje a página já é dinâmica por ler o
   cookie de sessão, mas isso é consequência de um detalhe de implementação —
   basta alguém mover a leitura da sessão para outro lugar e o calendário
   silenciosamente para no tempo. Declarado, não deduzido. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  await requireFeature("agenda");
  const { student, month, upcoming, notifications, unread } = await getAgendaPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/agenda">
      <AgendaView month={month} upcoming={upcoming} notifications={notifications} unread={unread} />
    </AppShell>
  );
}