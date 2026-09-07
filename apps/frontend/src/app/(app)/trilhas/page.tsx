import type { Metadata } from "next";

import { requireFeature } from "@/lib/feature-guard.ts";

import { requireUser } from "@/lib/auth/session.ts";
import { lowerUnit } from "@nerdlms/core/tenancy/unit-label.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { TracksView } from "@/features/learner/tracks-view.tsx";
import { getTracksPageData } from "@/features/learner/data.ts";

export const metadata: Metadata = { title: "Trilhas" };

export default async function TracksPage() {
  await requireFeature("trilhas");
  const { tenant } = await requireUser();
  const { student, tracks, recommended } = await getTracksPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/trilhas">
      <TracksView
        tracks={tracks}
        recommended={recommended}
        unitLower={lowerUnit(tenant.unitLabel)}
      />
    </AppShell>
  );
}