import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { ManagerView } from "@/features/manager/manager-view.tsx";
import { getManagerPageData } from "@/features/manager/data.ts";

/** O painel de quem responde por uma equipe. */
export async function ManagerPanel({ currentPath }: { currentPath: string }) {
  const { manager, project, stats, courses } = await getManagerPageData();

  return (
    <AppShell fullName={manager.fullName} role={manager.role} currentPath={currentPath}>
      <ManagerView
        project={project}
        stats={stats}
        courses={courses}
      />
    </AppShell>
  );
}
