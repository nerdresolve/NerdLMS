import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { ProfileView } from "@/features/profile/profile-view.tsx";
import { NotificationPrefs } from "@/features/profile/notification-prefs.tsx";
import { ProfileBadges } from "@/features/profile/profile-badges.tsx";
import { ProfileCompetencies } from "@/features/profile/profile-competencies.tsx";
import { findPreferences } from "@nerdlms/backend/notifications/preferences-repository.ts";
import { getProfilePageData } from "@/features/profile/data.ts";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const { user, totals, certificates, badges, competencies, plans } = await getProfilePageData();

  return (
    <AppShell fullName={user.fullName} role={user.role} currentPath="/perfil">
      <ProfileView user={user} totals={totals} certificates={certificates} />

      {/* Badges ao lado dos certificados: os dois são credencial verificável, e
          a pergunta é a mesma — "o que eu posso comprovar?". */}
      <ProfileBadges badges={badges} />

      {/* Competências DEPOIS dos badges: badge é reconhecimento pontual,
          competência é o mapa do que a pessoa sabe fazer e do que falta. */}
      <ProfileCompetencies competencies={competencies} plans={plans} />

      {/* As preferências vivem no perfil porque são da PESSOA, não do curso —
          é onde se procura "como paro de receber e-mail". */}
      <NotificationPrefs saved={Object.fromEntries(await findPreferences(user.id))} />
    </AppShell>
  );
}
