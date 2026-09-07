import { findIssuerContact } from "@nerdlms/backend/badges/badge-repository.ts";
import { openBadgeIssuer } from "@nerdlms/core/badges/open-badges.ts";

import { baseUrlOf } from "@/lib/base-url.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * GET /api/badges/issuer — o Issuer do Open Badges 2.0.
 *
 * "Quem emite estes badges." Público e sem sessão: é o documento que um
 * verificador busca para saber de onde o badge veio.
 *
 * O emissor é o CLIENTE, resolvido pelo domínio da requisição — não a
 * plataforma. Quem responde por um badge de NR-10 é a empresa que treinou, e é
 * o nome dela que precisa aparecer para quem confere.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const tenant = await tenantOfRequest();

  /* O e-mail de contato vem do banco e não da sessão: `TenantContext` viaja em
     TODA requisição, e engordá-lo com um campo que só este endereço usa
     custaria em todas as outras. */
  const email = tenant ? await findIssuerContact(tenant.id) : null;

  const issuer = openBadgeIssuer({
    baseUrl: await baseUrlOf(),
    tenantName: tenant?.name ?? "Plataforma de ensino",
    email,
  });

  return Response.json(issuer, {
    headers: {
      "content-type": "application/ld+json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
