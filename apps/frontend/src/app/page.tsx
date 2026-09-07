import type { Metadata } from "next";

import { countPlatform } from "@nerdlms/backend/courses/courses-repository.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";
import { landingStats } from "@nerdlms/core/landing.ts";
import { LandingView } from "@/features/landing/landing-view.tsx";
import { NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";

/**
 * Título e descrição saem do cliente que atende esta requisição.
 *
 * Estático seria mais simples e estaria errado: esta é a página PÚBLICA, a
 * primeira que alguém vê e a que os buscadores indexam. Um nome fixo aqui faria
 * a instalação de cada cliente se anunciar com o nome de outro.
 *
 * Sem tenant no domínio, cai no nome do produto (`brand/brand.config.ts`).
 */
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
     da organização. */
  const tenant = await tenantOfRequest();
  const stats = tenant ? landingStats(await countPlatform(tenant.id)) : [];

  return <LandingView stats={stats} />;
}
