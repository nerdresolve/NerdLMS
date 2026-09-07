import { headers } from "next/headers";
import { readJsonObject } from "@/lib/request-body.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";

import {
  confirmResetUseCase,
  requestResetUseCase,
} from "@nerdlms/backend/auth/password-reset-use-case.ts";

/**
 * POST /api/auth/recuperar — pede o link de redefinição.
 * PUT  /api/auth/recuperar — usa o link e define a senha nova.
 *
 * Ambas são públicas: quem esqueceu a senha não tem sessão.
 */

export const dynamic = "force-dynamic";

function clientIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const requestHeaders = await headers();

  /* A origem vem dos cabeçalhos do proxy, não de `request.url`: atrás do Caddy
     a URL interna é `https://0.0.0.0:3000`, e um link com esse endereço não
     abre em lugar nenhum. `x-forwarded-host` é o endereço que a pessoa digitou.
     `PUBLIC_ORIGIN` tem precedência para quando o proxy não repassa o
     cabeçalho. */
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin =
    process.env.PUBLIC_ORIGIN ??
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);

  /* O cliente sai do domínio da requisição: não há sessão aqui, e o e-mail é
     único por tenant. Sem tenant, a resposta é a mesma de sempre — este fluxo
     nunca revela se a conta existe. */
  const tenant = await tenantOfRequest();
  if (!tenant) {
    return Response.json({
      message: "Se houver conta com esse e-mail, o link de redefinição foi enviado.",
    });
  }

  const outcome = await requestResetUseCase({
    email: typeof body.email === "string" ? body.email : "",
    tenantId: tenant.id,
    origin,
    ip: clientIp(requestHeaders),
  });

  return Response.json({ message: outcome.message });
}

export async function PUT(request: Request): Promise<Response> {
  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const requestHeaders = await headers();

  const outcome = await confirmResetUseCase({
    token: typeof body.token === "string" ? body.token : "",
    password: typeof body.password === "string" ? body.password : "",
    ip: clientIp(requestHeaders),
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ ok: true });
}
