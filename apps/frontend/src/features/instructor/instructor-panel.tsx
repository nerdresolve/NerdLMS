import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { EngagementView } from "@/features/instructor/engagement-view.tsx";
import { getEngagementPageData } from "@/features/instructor/data.ts";

/** O painel de quem assina cursos: engajamento dos cursos de sua autoria. */
export async function InstructorPanel({
  currentPath,
  topbar,
}: {
  currentPath: string;
  topbar?: React.ReactNode;
}) {
  const { instructor, summary, learners, courses, aproveitamento, leitura } =
    await getEngagementPageData();

  return (
    <AppShell
      {...(topbar ? { topbar } : {})}
      fullName={instructor.fullName}
      role={instructor.role}
      currentPath={currentPath}
    >
      <EngagementView
        summary={summary}
        learners={learners}
        courses={courses}
        aproveitamento={aproveitamento}
        leitura={leitura}
      />
    </AppShell>
  );
}
