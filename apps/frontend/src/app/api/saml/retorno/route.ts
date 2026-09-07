import { cookies, headers } from "next/headers";

import { completeSamlLogin } from "@nerdlms/backend/saml/saml-use-case.ts";

import { SESSION_COOKIE } from "@/lib/session-cookie.ts";
import { publicOrigin } from "@/lib/sso-redirect.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * POST /api/saml/retorno — onde a asserção chega.
 *
 * POST, não GET: uma asserção assinada tem alguns kilobytes e não cabe numa
 * query string. É o que o perfil HTTP-POST do padrão define, e é como todo
 * provedor devolve.
 *
 * Sem sessão exigida: quem chega aqui ainda não entrou. O que autoriza é a
 * assinatura da asserção, conferida contra o certificado cadastrado.
 */

export const dynamic = "force-dynamic";

/** Uma asserção passa de 4 KB com frequência; 512 KB é folga generosa. */
const LIMITE_BYTES = 512 * 1024;

function clientIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || requestHeaders.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: Request): Promise<Response> {
  const requestHeaders = await headers();
  const origem = publicOrigin(requestHeaders);

  const paraLogin = (erro: string): Response => {
    const login = new URL("/login", origem);
    login.searchParams.set("erro", erro);
    return Response.redirect(login, 303);
  };

  const tenant = await tenantOfRequest();
  if (!tenant) return paraLogin("Cliente não identificado.");

  const corpo = await request.text().catch(() => "");

  if (corpo.length > LIMITE_BYTES) {
    return paraLogin("A resposta do provedor é grande demais.");
  }

  const campos = new URLSearchParams(corpo);
  const resposta = campos.get("SAMLResponse");

  if (!resposta) return paraLogin("O provedor não devolveu a asserção.");

  const outcome = await completeSamlLogin({
    tenantId: tenant.id,
    samlResponse: resposta,
    ip: clientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
    now: Date.now(),
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
