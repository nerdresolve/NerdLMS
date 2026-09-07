import { cookies, headers } from "next/headers";

import { completeSsoLogin } from "@nerdlms/backend/sso/sso-use-case.ts";

import { SESSION_COOKIE } from "@/lib/session-cookie.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";
import { publicOrigin, ssoRedirectUri } from "@/lib/sso-redirect.ts";

/**
 * GET /api/sso/retorno
 *
 * Onde o provedor devolve a pessoa. Termina emitindo o MESMO cookie de sessão
 * do login por senha — daqui para a frente não há diferença entre quem entrou
 * de um jeito ou de outro.
 *
 * Responde sempre com redirecionamento, nunca com JSON: quem chega aqui vem de
 * uma navegação do navegador, e um JSON na tela seria o fim do login.
 */

export const dynamic = "force-dynamic";

function clientIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || requestHeaders.get("x-real-ip") || "127.0.0.1";
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const requestHeaders = await headers();

  /* Dos cabeçalhos, nunca de `request.url`: atrás do proxy aquele traz o
     endereço interno do contêiner, e o navegador da pessoa não chega lá. */
  const origem = publicOrigin(requestHeaders);

  const paraLogin = (erro: string): Response => {
    const login = new URL("/login", origem);
    login.searchParams.set("erro", erro);
    return Response.redirect(login, 303);
  };

  const tenant = await tenantOfRequest();
  if (!tenant) return paraLogin("Cliente não identificado.");

  const outcome = await completeSsoLogin({
    tenantId: tenant.id,
    params: url.searchParams,
    redirectUri: ssoRedirectUri(requestHeaders),
    ip: clientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
  });

  if (outcome.status !== 200) return paraLogin(outcome.error);

  const store = await cookies();
  store.set(SESSION_COOKIE, outcome.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: outcome.expiresAt,
  });

  return Response.redirect(new URL(outcome.redirectPath, origem), 303);
}
