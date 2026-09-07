import { BRANDING_PADRAO } from "@nerdlms/core/tenancy/branding.ts";
import { findBadgePublic } from "@nerdlms/backend/badges/badge-repository.ts";
import { badgeSvg } from "@nerdlms/core/badges/open-badges.ts";

import { isUuid } from "@/lib/request-body.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * GET /api/badges/{id}/imagem.svg — a imagem do badge.
 *
 * O Open Badges EXIGE uma imagem: um `image` quebrado invalida o documento em
 * qualquer leitor externo. Ela é gerada a partir do nome e da cor da marca —
 * pedir upload por badge traria storage, formato e moderação para um problema
 * que um desenho paramétrico resolve, e garante que o badge sempre tem imagem.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ badgeId: string }> },
): Promise<Response> {
  const { badgeId } = await params;

  if (!isUuid(badgeId)) return new Response("not found", { status: 404 });

  const badge = await findBadgePublic(badgeId);
  if (!badge) return new Response("not found", { status: 404 });

  const tenant = await tenantOfRequest();

  const svg = badgeSvg(
    badge.name,
    tenant?.branding?.brandColor ?? BRANDING_PADRAO.brandColor,
    /* As iniciais do badge: "NR-10 Básico" vira "NR". É o que cabe num círculo
       de 200px e ainda distingue um badge do outro na lista de um perfil. */
    badge.name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2),
  );

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      /* A imagem é derivada do nome e da marca: muda pouco, e um verificador
         externo pode buscá-la muitas vezes. */
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}
