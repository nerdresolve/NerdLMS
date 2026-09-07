import { decodeJwtSegment } from "@nerdlms/core/sso/jwt-parts.ts";

import { verifyRs256 } from "../crypto/jwt-verify.ts";

/**
 * O que fala com o provedor pela rede.
 *
 * Separado do caso de uso porque é a única parte que depende de rede: o teste
 * do caso de uso troca este módulo por um dublê e roda sem internet.
 */

/** Nenhuma chamada ao provedor pode pendurar um login. */
const TIMEOUT_MS = 10_000;

export interface TokenResponse {
  idToken: string;
  accessToken: string | null;
}

export type TokenExchange =
  | { ok: true; tokens: TokenResponse }
  | { ok: false; error: string };

/**
 * Troca o código por tokens.
 *
 * Esta chamada sai do NOSSO servidor para o provedor, e leva a chave secreta.
 * É o motivo de o fluxo ter duas pernas: o navegador nunca vê a chave, e o
 * código que ele carregou não vale nada sem ela.
 */
export async function exchangeCode(params: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TokenExchange> {
  const corpo = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  let resposta: Response;
  try {
    resposta = await fetch(params.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: corpo.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    /* Rede fora, DNS errado, provedor lento. A mensagem não repete o erro do
       Node: quem está na tela de login não tem o que fazer com ele. */
    return { ok: false, error: "Não foi possível falar com o provedor de identidade." };
  }

  if (!resposta.ok) {
    /* O corpo do erro traz `error` e `error_description` e costuma dizer
       exatamente o que está errado na configuração — chave secreta vencida,
       URL de retorno não cadastrada. Vai para o log, não para a tela. */
    const detalhe = await resposta.text().catch(() => "");
    console.error("[sso] troca de código recusada", resposta.status, detalhe.slice(0, 500));

    return { ok: false, error: "O provedor de identidade recusou a autenticação." };
  }

  const dados = (await resposta.json().catch(() => null)) as {
    id_token?: string;
    access_token?: string;
  } | null;

  if (!dados?.id_token) {
    return { ok: false, error: "O provedor não devolveu o token de identidade." };
  }

  return { ok: true, tokens: { idToken: dados.id_token, accessToken: dados.access_token ?? null } };
}

interface Jwks {
  keys: Array<Record<string, unknown>>;
}

/**
 * Cache das chaves públicas do provedor.
 *
 * Sem cache, cada login buscaria o JWKS de novo — uma chamada de rede a mais
 * em cada entrada, e um provedor fora do ar derrubaria o login mesmo com as
 * chaves já conhecidas. Cinco minutos é curto o bastante para acompanhar uma
 * rotação e longo o bastante para não pesar.
 */
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { keys: Array<Record<string, unknown>>; buscadoEm: number }>();

async function fetchJwks(jwksUrl: string): Promise<Array<Record<string, unknown>> | null> {
  const guardado = cache.get(jwksUrl);
  if (guardado && Date.now() - guardado.buscadoEm < CACHE_MS) return guardado.keys;

  try {
    const resposta = await fetch(jwksUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) return guardado?.keys ?? null;

    const dados = (await resposta.json()) as Jwks;
    if (!Array.isArray(dados.keys)) return guardado?.keys ?? null;

    cache.set(jwksUrl, { keys: dados.keys, buscadoEm: Date.now() });
    return dados.keys;
  } catch {
    /* Falhou a busca: usa o que já tinha, mesmo vencido. Chave pública não
       muda de significado ao passar dos cinco minutos, e derrubar o login de
       todo mundo porque o JWKS demorou seria pior que usar uma cópia velha. */
    return guardado?.keys ?? null;
  }
}

/**
 * Confere a assinatura do `id_token` contra as chaves do provedor.
 *
 * Isto é o que impede alguém de escrever um `id_token` à mão dizendo ser quem
 * quiser. Sem esta conferência, o resto da validação não protege nada: as
 * afirmações estão em base64, que qualquer um escreve.
 */
export async function verifyIdTokenSignature(
  idToken: string,
  jwksUrl: string,
): Promise<boolean> {
  const partes = idToken.split(".");
  if (partes.length !== 3) return false;

  const cabecalho = decodeJwtSegment(partes[0]!) as { kid?: string; alg?: string } | null;
  if (!cabecalho) return false;

  /* Só RS256. `alg: none` é o ataque clássico contra JWT: o token diz "não
     tenho assinatura" e uma biblioteca ingênua concorda. */
  if (cabecalho.alg !== "RS256") return false;

  const chaves = await fetchJwks(jwksUrl);
  if (!chaves || chaves.length === 0) return false;

  /* Com `kid`, usa a chave indicada. Sem, tenta todas — alguns provedores não
     mandam `kid`, e recusar por isso quebraria provedores corretos. */
  const candidatas = cabecalho.kid
    ? chaves.filter((k) => k.kid === cabecalho.kid)
    : chaves;

  return candidatas.some((chave) => verifyRs256(idToken, chave));
}

/** Descarta o cache. Usado ao trocar a configuração de um provedor. */
export function clearJwksCache(): void {
  cache.clear();
}
