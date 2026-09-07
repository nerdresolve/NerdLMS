import { headers } from "next/headers";

import { startSamlLogin } from "@nerdlms/backend/saml/saml-use-case.ts";

import { publicOrigin } from "@/lib/sso-redirect.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * GET /api/saml/iniciar?voltar=<caminho>
 *
 * Manda a pessoa ao provedor. GET porque o destino é uma navegação — o botão
 * na tela de login é um link.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const tenant = await tenantOfRequest();
  const requestHeaders = await headers();
  const origem = publicOrigin(requestHeaders);

  const paraLogin = (erro: string): Response => {
    const login = new URL("/login", origem);
    login.searchParams.set("erro", erro);
    return Response.redirect(login, 303);
  };

  if (!tenant) return paraLogin("Cliente não identificado.");

  const url = new URL(request.url);

  const outcome = await startSamlLogin({
    tenantId: tenant.id,
    redirectPath: url.searchParams.get("voltar") ?? "/",
    acsUrl: `${origem}/api/saml/retorno`,
    instant: new Date().toISOString(),
  });

  if (outcome.status !== 200) return paraLogin(outcome.error);

  return Response.redirect(outcome.redirectUrl, 303);
}
