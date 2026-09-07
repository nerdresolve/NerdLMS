import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session.ts";

import { AdminPanel } from "@/features/admin/admin-panel.tsx";
import { InstructorPanel } from "@/features/instructor/instructor-panel.tsx";
import { LearnerPanel } from "@/features/dashboard/learner-panel.tsx";
import { ManagerPanel } from "@/features/manager/manager-panel.tsx";

export const metadata: Metadata = { title: "Painel" };

/**
 * A porta de entrada, uma só para todo mundo.
 *
 * O PAPEL DECIDE O CONTEÚDO, NÃO A URL.
 *
 * Antes esta tela era o painel do aluno e só, e quem entrava para dar aula ou
 * administrar caía numa lista de cursos a fazer. A primeira correção mandou
 * cada papel para o endereço da sua área — `/instrutor/engajamento`, `/admin`,
 * `/gestor` —, o que resolvia o sintoma e criava outro problema: o papel
 * passava a fazer parte do endereço de entrada. Um link compartilhado leva ao
 * lugar errado, e quem muda de papel fica com um atalho quebrado.
 *
 * Aqui `/dashboard` é o endereço de todo mundo e serve o painel de quem
 * chegou. As rotas de área continuam existindo, para link direto e trilha de
 * navegação; o que sai da URL é a porta de entrada.
 *
 * Isto não é autorização, e nunca foi: cada painel carrega os próprios dados
 * por um `data.ts` que confere permissão no servidor. Um papel que chegasse ao
 * painel errado receberia a mesma recusa que recebe hoje ao digitar a rota.
 */
export default async function DashboardPage() {
  const { role } = await requireUser();

  switch (role) {
    case "admin":
      return <AdminPanel currentPath="/dashboard" />;
    case "manager":
      return <ManagerPanel currentPath="/dashboard" />;
    case "instructor":
      return <InstructorPanel currentPath="/dashboard" />;
    case "learner":
      return <LearnerPanel currentPath="/dashboard" />;
  }
}
