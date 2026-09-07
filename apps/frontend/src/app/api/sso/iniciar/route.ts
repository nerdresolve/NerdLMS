import { headers } from "next/headers";

import { startSsoLogin } from "@nerdlms/backend/sso/sso-use-case.ts";

import { tenantOfRequest } from "@/lib/tenant-request.ts";
import { publicOrigin, ssoRedirectUri } from "@/lib/sso-redirect.ts";

/**
 * GET /api/sso/iniciar?provedor=<id>&voltar=<caminho>
 *
 * Manda a pessoa ao provedor de identidade. É GET porque o destino é uma
 * navegação — o botão na tela de login é um link, e um POST aqui obrigaria a
 * um formulário só para sair da página.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const tenant = await tenantOfRequest();
  if (!tenant) return Response.json({ error: "Cliente não identificado." }, { status: 404 });

  const url = new URL(request.url);
  const provedor = url.searchParams.get("provedor") ?? "";
  if (!provedor) {
    return Response.json({ error: "Provedor não informado." }, { status: 400 });
  }

  const requestHeaders = await headers();

  const outcome = await startSsoLogin({
    tenantId: tenant.id,
    providerId: provedor,
    redirectPath: url.searchParams.get("voltar") ?? "/",
    redirectUri: ssoRedirectUri(requestHeaders),
    loginHint: url.searchParams.get("email"),
  });

  if (outcome.status !== 200) {
    /* Erro aqui vira uma volta à tela de login com a mensagem, não um JSON: a
       pessoa clicou num botão e espera continuar navegando. */
    const login = new URL("/login", publicOrigin(requestHeaders));
    login.searchParams.set("erro", outcome.error);
    return Response.redirect(login, 303);
  }

  return Response.redirect(outcome.authorizationUrl, 303);
}
