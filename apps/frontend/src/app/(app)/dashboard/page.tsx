import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { DashboardView } from "@/features/dashboard/dashboard-view.tsx";
import { getDashboardData } from "@/features/dashboard/data.ts";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <AppShell fullName={data.student.fullName} role={data.student.role} currentPath="/dashboard">
      <DashboardView {...data} />
    </AppShell>
  );
}
