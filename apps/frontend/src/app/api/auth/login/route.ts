import { cookies, headers } from "next/headers";

import { loginUseCase } from "@nerdlms/backend/auth/login-use-case.ts";

import { SESSION_COOKIE } from "@/lib/session-cookie.ts";
import { readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/auth/login
 *
 * A rota só traduz HTTP: lê o corpo, descobre o IP, chama o caso de uso e
 * transforma o resultado em resposta e cookie. Toda a regra — validação,
 * bloqueio por tentativa, verificação de senha, emissão de sessão — mora em
 * `@nerdlms/backend`.
 *
 * O arquivo continua aqui porque no Next a rota **é** o arquivo: movê-lo para
 * `apps/backend` faria o endpoint deixar de existir.
 */

export const dynamic = "force-dynamic";

function clientIp(requestHeaders: Headers): string {
  /* Atrás do Caddy, o IP real vem no cabeçalho. O fallback existe para não
     quebrar em execução direta; `inet` não aceita string vazia. */
  const forwarded = requestHeaders.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || requestHeaders.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const requestHeaders = await headers();

  const outcome = await loginUseCase({
    identifier: typeof body.identifier === "string" ? body.identifier : "",
    password: typeof body.password === "string" ? body.password : "",
    remember: body.remember === true,
    ip: clientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, outcome.token, {
    httpOnly: true, // fora do alcance de qualquer script
    secure: true,
    sameSite: "lax", // sobrevive a navegação vinda de link, barra CSRF
    path: "/",
    expires: outcome.expiresAt,
  });

  return Response.json({ user: outcome.user });
}
