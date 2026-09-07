import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { DashboardView } from "@/features/dashboard/dashboard-view.tsx";
import { getDashboardData } from "@/features/dashboard/data.ts";

/**
 * O painel de quem estuda, sem a rota em volta.
 *
 * Extraído de `/dashboard/page.tsx` porque agora tem dois chamadores: a porta
 * de entrada, que escolhe o painel pelo papel, e nada mais — mas o mesmo vale
 * para os outros três, e manter os quatro no mesmo formato é o que deixa o
 * despacho legível.
 *
 * `currentPath` vem de fora: é ele que decide qual item do menu fica marcado, e
 * a mesma tela pode ser alcançada por caminhos diferentes.
 */
export async function LearnerPanel({ currentPath }: { currentPath: string }) {
  const data = await getDashboardData();

  return (
    <AppShell fullName={data.student.fullName} role={data.student.role} currentPath={currentPath}>
      <DashboardView {...data} />
    </AppShell>
  );
}
