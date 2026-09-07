import type { Metadata } from "next";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { UsersView } from "@/features/admin/users-view.tsx";
import { UsersImport } from "@/features/admin/users-import.tsx";
import { getUsersPageData } from "@/features/admin/data.ts";
import { requireUser } from "@/lib/auth/session.ts";

export const metadata: Metadata = { title: "Usuários · Admin" };

export default async function UsersPage() {
  const { admin, users } = await getUsersPageData();
  const { tenant } = await requireUser();

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Administração", href: "/admin" }, { label: "Usuários" }]} />} fullName={admin.fullName} role={admin.role} currentPath="/admin/usuarios">
      <UsersView users={users} unitLabel={tenant.unitLabel} />

      {/* A importação vem DEPOIS da lista: quem chega aqui quase sempre quer ver
          ou editar alguém, e importar em massa é a exceção. */}
      <UsersImport unitLabel={tenant.unitLabel} />
    </AppShell>
  );
}
