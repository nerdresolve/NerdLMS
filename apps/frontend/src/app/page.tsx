import type { Metadata } from "next";

import { countPlatform } from "@nerdlms/backend/courses/courses-repository.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";
import { landingStats } from "@nerdlms/core/landing.ts";
import { BRANDING_PADRAO, NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";
import { LandingView } from "@/features/landing/landing-view.tsx";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await tenantOfRequest();
  const nome = tenant?.name ?? NOME_PADRAO;

  return {
    title: `${nome} · Plataforma de ensino`,
    description: `Plataforma de ensino da ${nome}: cursos, trilhas e acompanhamento de progresso.`,
  };
}

/* Renderizada a cada visita, não no build.
   `revalidate` faria o Next pré-renderizar durante `next build` — que roda
   dentro do container, sem banco algum acessível. O resultado daquela
   tentativa ficaria congelado no HTML e serviria para sempre. A consulta é
   uma só, com quatro subconsultas, e a página é leve. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  /* Os números são DESTE cliente. Sem o recorte, a página somaria alunos e
     cursos de todas as empresas — e a landing da ACME anunciaria o catálogo
     de outro cliente. */
  const tenant = await tenantOfRequest();
  const stats = tenant ? landingStats(await countPlatform(tenant.id)) : [];

  return (
    <LandingView
      stats={stats}
      nome={tenant?.name ?? NOME_PADRAO}
      logoLight={tenant?.branding.logoLightUrl ?? BRANDING_PADRAO.logoLight}
      logoDark={tenant?.branding.logoDarkUrl ?? BRANDING_PADRAO.logoDark}
    />
  );
}
