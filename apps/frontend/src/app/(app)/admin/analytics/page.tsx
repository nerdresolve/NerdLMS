import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { AnalyticsView } from "@/features/admin/analytics-view.tsx";
import { getAnalyticsPageData } from "@/features/admin/data.ts";

export const metadata: Metadata = { title: "Analytics · Admin" };

/* Os números mudam a cada aula concluída. */
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string }>;
}) {
  const { curso } = await searchParams;
  const { admin, analytics, courses, selectedCourseId } = await getAnalyticsPageData(curso);

  return (
    <AppShell
      topbar={<Breadcrumb items={[{ label: "Administração", href: "/admin" }, { label: "Indicadores" }]} />} fullName={admin.fullName} role={admin.role} currentPath="/admin/analytics">
      {/* O curso vai na URL, não no estado: o relatório fica compartilhável, e
          é o que se espera de um número que alguém vai mandar para outra
          pessoa. Mesma decisão da exportação de relatórios. */}
      {courses.length > 1 ? (
        <nav className="an__cursos" aria-label="Escolher curso">
          {courses.map((item) => (
            <Link
              key={item.id}
              href={`/admin/analytics?curso=${item.id}`}
              className="an__curso"
              aria-current={item.id === selectedCourseId ? "page" : undefined}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      ) : null}

      <AnalyticsView data={analytics} />
    </AppShell>
  );
}
