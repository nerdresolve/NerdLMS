import { findBadgePublic } from "@nerdlms/backend/badges/badge-repository.ts";
import { criteriaNarrative, openBadgeClass } from "@nerdlms/core/badges/open-badges.ts";

import { baseUrlOf } from "@/lib/base-url.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * GET /api/badges/{id} — a BadgeClass do Open Badges 2.0.
 *
 * "O que este badge significa e como se ganha." Público: é a `badge` que a
 * assertion referencia, e um verificador precisa poder buscá-la.
 *
 * Só o que já é público na página de verificação sai daqui — nome, descrição e
 * critério. Nada sobre quem recebeu.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ badgeId: string }> },
): Promise<Response> {
  const { badgeId } = await params;

  if (!isUuid(badgeId)) return Response.json({ error: "not_found" }, { status: 404 });

  const badge = await findBadgePublic(badgeId);
  if (!badge) return Response.json({ error: "not_found" }, { status: 404 });

  const classe = openBadgeClass({
    baseUrl: await baseUrlOf(),
    badgeId: badge.id,
    name: badge.name,
    description: badge.description,
    criteriaText: criteriaNarrative(badge.criterion, {
      courseName: badge.courseName,
      trackName: badge.trackName,
      threshold: badge.threshold,
    }),
  });

  return Response.json(classe, {
    headers: {
      "content-type": "application/ld+json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
