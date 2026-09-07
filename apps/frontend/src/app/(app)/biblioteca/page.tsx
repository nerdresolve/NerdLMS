import type { Metadata } from "next";

import { findBiblioteca } from "@nerdlms/backend/courses/material-repository.ts";
import { findCategoryOptions } from "@nerdlms/backend/courses/category-repository.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { LibraryView } from "@/features/library/library-view.tsx";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";

export const metadata: Metadata = { title: "Biblioteca" };

/* Um documento publicado agora precisa aparecer ao voltar para a tela. */
export const dynamic = "force-dynamic";

/**
 * A biblioteca de conteúdos.
 *
 * Aberta a QUEM TEM SESSÃO, e não só a quem está matriculado em algo: um
 * procedimento de segurança que depende de matrícula em curso não cumpre o
 * propósito de estar publicado. O recorte que importa é o cliente, e ele está
 * na consulta.
 *
 * Publicar é outra história — administrador e instrutor, os mesmos que já
 * criam conteúdo. A rota confere de novo; esconder o formulário não é
 * autorização, é só não oferecer o caminho.
 */
export default async function LibraryPage() {
  const user = await requireUser();

  const [documentos, categorias] = await Promise.all([
    findBiblioteca(user.tenant.id),
    findCategoryOptions(user.tenant.id),
  ]);

  return (
    <AppShell
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/biblioteca"
    >
      <LibraryView
        documentos={documentos}
        temasCadastrados={categorias.map((c) => ({ id: c.id, name: c.name }))}
        podePublicar={user.role === "admin" || user.role === "instructor"}
        podeDefinirAssunto={user.role === "admin"}
      />
    </AppShell>
  );
}
