import { cookies } from "next/headers";

import { destroySession } from "@nerdlms/backend/auth/sessions-repository.ts";

import { SESSION_COOKIE } from "@/lib/session-cookie.ts";

/**
 * POST /api/auth/logout
 *
 * Apaga a sessão no banco **e** o cookie. Só limpar o cookie deixaria o token
 * válido para quem o tivesse copiado — sair precisa invalidar de verdade.
 *
 * Responde 204 mesmo sem sessão: sair duas vezes não é erro, e diferenciar os
 * casos não traria nada a quem chama.
 */

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) await destroySession(token);

  const response = new Response(null, { status: 204 });

  /* Os atributos precisam repetir os do `set` no login: `__Host-` só é
     apagado por um cookie com path `/` e `secure`. Sem eles o navegador trata
     como outro cookie e o antigo fica no disco. */
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
