import type { Metadata } from "next";

import { countPlatform } from "@nerdlms/backend/courses/courses-repository.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";
import { landingStats } from "@nerdlms/core/landing.ts";
import { LandingView } from "@/features/landing/landing-view.tsx";

export const metadata: Metadata = {
  title: "Exemplo S.A. · Plataforma de ensino",
  description:
    "Plataforma de ensino da Exemplo S.A.: cursos, trilhas e acompanhamento de progresso para quem opera os campos de petróleo e gás.",
};

/* Renderizada a cada visita, não no build.
   `revalidate` faria o Next pré-renderizar durante `next build` — que roda
   dentro do container, sem banco algum acessível. O resultado daquela
   tentativa ficaria congelado no HTML e serviria para sempre. A consulta é
   uma só, com quatro subconsultas, e a página é leve. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  /* Os números são DESTE cliente. Sem o recorte, a página somaria alunos e
     cursos de todas as empresas — e a landing da ACME anunciaria o catálogo
     da Exemplo S.A.. */
  const tenant = await tenantOfRequest();
  const stats = tenant ? landingStats(await countPlatform(tenant.id)) : [];

  return <LandingView stats={stats} />;
}
