import { findAwardByCode, hashRecipientEmail } from "@nerdlms/backend/badges/badge-repository.ts";
import { isValidBadgeCode } from "@nerdlms/core/badges/criteria.ts";
import { openBadgeAssertion } from "@nerdlms/core/badges/open-badges.ts";

import { baseUrlOf } from "@/lib/base-url.ts";

/**
 * GET /api/badges/emissao/{codigo} — a Assertion do Open Badges 2.0.
 *
 * É a URL que o próprio documento declara como sua `id`, e é o que um
 * verificador externo busca para confirmar a emissão. **Pública e sem sessão**:
 * um verificador não tem conta aqui, e é esse o ponto.
 *
 * O e-mail vai como hash com sal, como o padrão define. Nunca em texto.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> },
): Promise<Response> {
  const { codigo } = await params;

  /* Formato antes do banco: recusar lixo sem consultar. */
  if (!isValidBadgeCode(codigo)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const award = await findAwardByCode(codigo);
  if (!award) return Response.json({ error: "not_found" }, { status: 404 });

  const assertion = openBadgeAssertion(
    {
      baseUrl: await baseUrlOf(),
      code: award.code,
      badgeId: award.badgeId,
      /* Sem e-mail cadastrado, o hash sai de uma string vazia com o mesmo sal —
         o documento continua válido, e não vaza nada porque não há o que
         vazar. */
      recipientEmail: award.userEmail ?? "",
      salt: award.salt,
      awardedAt: award.awardedAt,
      expiresAt: award.expiresAt,
      revoked: award.revokedAt !== null,
      revokedReason: award.revokedReason,
    },
    hashRecipientEmail,
  );

  return Response.json(assertion, {
    headers: {
      /* O tipo que o padrão define. Um verificador que recebe
         `application/json` puro ainda entende, mas o `+ld` é o que declara que
         há contexto JSON-LD. */
      "content-type": "application/ld+json; charset=utf-8",
      /* Emissão revogada precisa refletir imediatamente: um cache aqui faria a
         verificação continuar dizendo "válido" depois da revogação. */
      "cache-control": "no-store",
      /* Verificadores externos buscam de outro domínio. */
      "access-control-allow-origin": "*",
    },
  });
}
