import type { Metadata } from "next";

import { AdminPanel } from "@/features/admin/admin-panel.tsx";

export const metadata: Metadata = { title: "Painel da plataforma · Admin" };

/** A mesma tela que `/dashboard` serve a um administrador, por link direto. */
export default async function AdminPage() {
  return <AdminPanel currentPath="/admin" />;
}
