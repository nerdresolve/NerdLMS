import type { Metadata } from "next";

import { Breadcrumb } from "@/components/breadcrumb.tsx";
import { InstructorPanel } from "@/features/instructor/instructor-panel.tsx";

export const metadata: Metadata = { title: "Painel do instrutor" };

/** A mesma tela que `/dashboard` serve a um instrutor, por link direto. */
export default async function EngagementPage() {
  return (
    <InstructorPanel
      currentPath="/instrutor/engajamento"
      topbar={
        <Breadcrumb
          items={[{ label: "Instrutor", href: "/instrutor/cursos" }, { label: "Painel" }]}
        />
      }
    />
  );
}
