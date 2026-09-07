import { cookies, headers } from "next/headers";

import { ldapLoginUseCase } from "@nerdlms/backend/ldap/ldap-use-case.ts";

import { SESSION_COOKIE } from "@/lib/session-cookie.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * POST /api/ldap/entrar — login pelo diretório da empresa.
 *
 * POST com corpo, e não redirecionamento como o OIDC: aqui a senha é digitada
 * NA NOSSA TELA. Não há ida ao provedor, então não há volta.
 *
 * A senha atravessa esta rota e vai ao diretório. Ela não é registrada em
 * lugar nenhum — nem no log de acesso, nem na auditoria, nem numa variável que
 * sobreviva ao retorno da função.
 */

export const dynamic = "force-dynamic";

function clientIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || requestHeaders.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: Request): Promise<Response> {
  const tenant = await tenantOfRequest();
  if (!tenant) return Response.json({ error: "Cliente não identificado." }, { status: 404 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.diretorio)) {
    return Response.json({ error: "Diretório não informado." }, { status: 400 });
  }

  const requestHeaders = await headers();

  const outcome = await ldapLoginUseCase({
    tenantId: tenant.id,
    directoryId: String(body.diretorio),
    usuario: typeof body.usuario === "string" ? body.usuario : "",
    senha: typeof body.senha === "string" ? body.senha : "",
    ip: clientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, outcome.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: outcome.expiresAt,
  });

  return Response.json({ ok: true });
}
