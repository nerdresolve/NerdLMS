import { cookies } from "next/headers";

import { destroySession } from "@nerdlms/backend/auth/sessions-repository.ts";

import { SESSION_COOKIE } from "@/lib/session-cookie.ts";

/**
 * Sair.
 *
 * É um **Route Handler**: dos dois contextos em que o Next deixa escrever
 * cookie, é o único que vale para toda forma de chegada. A versão anterior
 * era uma página com Server Action, e o clique no link da sidebar — que
 * navega pelo roteador do cliente e busca a rota como payload de RSC — nunca
 * executava a ação: o Next derrubava a renderização com "Cookies can only be
 * modified in a Server Action or Route Handler" e o usuário via tela de erro
 * com a sessão já encerrada.
 *
 * Responde a **POST**, e não a GET, porque encerrar sessão muda estado. Com
 * GET, o prefetch do `<Link>` da navegação abria `/sair` sozinho ao montar a
 * sidebar: bastava entrar em qualquer tela para ser deslogado no ato — o
 * login gravava o cookie e o prefetch o apagava em seguida. Só o envio
 * explícito do formulário chega aqui.
 *
 * O `Location` é relativo de propósito: montá-lo a partir de `request.url`
 * devolvia `https://0.0.0.0:3000/login`, porque atrás do túnel e do proxy a
 * URL que chega ao processo carrega o endereço interno do container.
 */

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  /* Invalidar no banco também: só apagar o cookie deixaria o token servindo
     para quem o tivesse copiado. */
  if (token) await destroySession(token);

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

  /* 303 para o navegador trocar o POST por um GET ao seguir o redirecionamento
     — sem isso ele reenviaria o POST para /login. */
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
