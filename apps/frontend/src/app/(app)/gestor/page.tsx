import type { Metadata } from "next";

import { ManagerPanel } from "@/features/manager/manager-panel.tsx";

export const metadata: Metadata = { title: "Painel do projeto · Gestor" };

/** A mesma tela que `/dashboard` serve a um gestor, por link direto. */
export default async function ManagerPage() {
  return <ManagerPanel currentPath="/gestor" />;
}
