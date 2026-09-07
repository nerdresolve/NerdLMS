import type { Metadata } from "next";

import { requireFeature } from "@/lib/feature-guard.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { RewardsView } from "@/features/learner/rewards-view.tsx";
import { getRewardsPageData } from "@/features/learner/data.ts";

export const metadata: Metadata = { title: "Conquistas" };

export default async function RewardsPage() {
  await requireFeature("gamificacao");
  const { student, earnings, level, balance, badges, rewards, affordable } = await getRewardsPageData();

  return (
    <AppShell fullName={student.fullName} role={student.role} currentPath="/conquistas">
      <RewardsView earnings={earnings} level={level} balance={balance} badges={badges} rewards={rewards} affordable={affordable} />
    </AppShell>
  );
}