import { trocarFetchPorToken } from "@nerdlms/backend/cmi5/cmi5-repository.ts";

import { isUuid } from "@/lib/request-body.ts";

/**
 * POST /api/cmi5/fetch?t=<sessão> — o conteúdo troca o identificador pelo token.
 *
 * O cmi5 define esta etapa em vez de mandar a credencial na URL de launch: a
 * URL do iframe aparece no histórico do navegador e no `Referer` de tudo que o
 * conteúdo carregar.
 *
 * SEM SESSÃO DE USUÁRIO. Quem chama é o conteúdo, que pode estar num app fora
 * do navegador — e o identificador de uso único É a autorização. É a mesma
 * lógica da URL assinada do storage.
 *
 * A resposta tem o formato que o padrão exige: `{"auth-token": "..."}`. O nome
 * do campo tem hífen e não é escolha nossa.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const t = new URL(request.url).searchParams.get("t") ?? "";

  if (!isUuid(t)) {
    /* O padrão manda responder com `error-text` mesmo em falha, e status 200:
       um AU que receba 400 costuma abortar sem mostrar nada à pessoa. */
    return Response.json({ "error-text": "Credencial indisponível." });
  }

  const resultado = await trocarFetchPorToken(t);

  if (!resultado.ok) {
    return Response.json({ "error-text": resultado.erro });
  }

  return Response.json(
    { "auth-token": resultado.token },
    { headers: { "cache-control": "no-store" } },
  );
}
