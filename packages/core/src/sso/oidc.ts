/**
 * OpenID Connect — o fluxo de código de autorização.
 *
 * O guia (§32) pede OIDC, Google e Microsoft. Este arquivo é a parte pura: monta
 * a URL para onde a pessoa vai, confere o que volta e valida o `id_token`. Nada
 * de rede e nada de banco — o que fala com o provedor mora no backend.
 *
 * A sequência, resumida:
 *
 *   1. A pessoa clica em "Entrar com o Google". Guardamos um `state` e um
 *      `nonce` e mandamos ela ao provedor.
 *   2. O provedor autentica e devolve à nossa URL de retorno com um `code`.
 *   3. Trocamos o `code` por um `id_token` — pelo canal de trás, com a chave
 *      secreta, onde o navegador não passa.
 *   4. Validamos a assinatura e as afirmações do token. Só então há login.
 *
 * O passo 4 é o que separa SSO de teatro. Um `id_token` não validado é um texto
 * que qualquer um escreve.
 */

import { decodeJwtSegment } from "./jwt-parts.ts";

export const OIDC_STATE_TTL_SECONDS = 600;

/**
 * Tolerância de relógio, em segundos.
 *
 * Servidores discordam em alguns segundos, e sem folga um `iat` no futuro
 * imediato derrubaria logins legítimos. Sessenta segundos é a mesma tolerância
 * já usada no LTI — vale manter uma só, para não haver duas respostas para a
 * mesma pergunta.
 */
const CLOCK_TOLERANCE_SECONDS = 60;

export interface AuthorizationRequest {
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
  /**
   * Sugestão de conta, quando sabemos o e-mail.
   *
   * Pula a tela de "escolha uma conta" para quem tem várias. É conveniência,
   * não segurança: o provedor pode ignorar.
   */
  loginHint?: string | null;
}

/**
 * A URL para onde mandar a pessoa.
 *
 * `state` e `nonce` fazem trabalhos diferentes e são fáceis de confundir:
 * `state` volta na URL e protege contra CSRF — garante que este retorno
 * corresponde a um pedido nosso. `nonce` vai dentro do `id_token` assinado e
 * protege contra repetição — garante que este token foi emitido para este
 * pedido, e não capturado de outro.
 */
export function buildAuthorizationUrl(req: AuthorizationRequest): string {
  const url = new URL(req.authorizationUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", req.clientId);
  url.searchParams.set("redirect_uri", req.redirectUri);
  url.searchParams.set("scope", req.scopes.join(" "));
  url.searchParams.set("state", req.state);
  url.searchParams.set("nonce", req.nonce);

  if (req.loginHint) url.searchParams.set("login_hint", req.loginHint);

  return url.toString();
}

export type CallbackResult =
  | { ok: true; code: string; state: string }
  | { ok: false; error: string };

/**
 * O que voltou do provedor.
 *
 * O erro do provedor vem em `error`, e é traduzido: `access_denied` significa
 * que a pessoa clicou em cancelar, e não é falha nenhuma — mostrar "erro" para
 * quem desistiu de propósito confunde.
 */
export function parseCallback(params: URLSearchParams): CallbackResult {
  const erro = params.get("error");
  if (erro) {
    return {
      ok: false,
      error:
        erro === "access_denied"
          ? "Login cancelado."
          : `O provedor recusou o login (${erro}).`,
    };
  }

  const code = params.get("code");
  const state = params.get("state");

  if (!code) return { ok: false, error: "O provedor não devolveu o código de autorização." };
  if (!state) return { ok: false, error: "O provedor não devolveu o state." };

  return { ok: true, code, state };
}

export interface IdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  hd?: string;
  [key: string]: unknown;
}

export interface ValidationContext {
  /** O `iss` que o provedor configurado deve declarar. */
  expectedIssuer: string;
  /** Nosso `client_id` — o token tem de ter sido emitido para nós. */
  expectedAudience: string;
  /** O `nonce` que guardamos ao iniciar. */
  expectedNonce: string;
  /** Agora, em segundos desde a época. Parâmetro para o teste ser determinístico. */
  now: number;
  /**
   * Domínios de e-mail aceitos, em minúsculas e sem arroba.
   *
   * Vazio aceita qualquer um. Com valores, recusa quem está fora — é o que
   * impede que uma conta pessoal do Gmail entre num login corporativo que usa
   * o Google como provedor.
   */
  allowedDomains?: string[];
}

export type ClaimsValidation =
  | { ok: true; claims: IdTokenClaims }
  | { ok: false; error: string };

/**
 * Valida as afirmações do `id_token`.
 *
 * Não valida a assinatura: isso exige as chaves públicas do provedor e é feito
 * no backend, antes de chamar esta função. Aqui ficam as conferências que não
 * dependem de rede — e que são igualmente obrigatórias. Assinatura válida com
 * `aud` de outro aplicativo é um token legítimo emitido para outra pessoa.
 */
export function validateIdTokenClaims(
  claims: IdTokenClaims,
  ctx: ValidationContext,
): ClaimsValidation {
  if (claims.iss !== ctx.expectedIssuer) {
    return { ok: false, error: "O emissor do token não é o provedor configurado." };
  }

  /* `aud` pode ser texto ou lista — o protocolo permite os dois. */
  const audiencias = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiencias.includes(ctx.expectedAudience)) {
    return { ok: false, error: "O token foi emitido para outro aplicativo." };
  }

  if (typeof claims.exp !== "number" || claims.exp + CLOCK_TOLERANCE_SECONDS < ctx.now) {
    return { ok: false, error: "O token expirou." };
  }

  if (typeof claims.iat !== "number" || claims.iat - CLOCK_TOLERANCE_SECONDS > ctx.now) {
    return { ok: false, error: "O token foi emitido no futuro." };
  }

  /* Sem esta conferência, um `id_token` capturado de outro login serviria para
     entrar aqui: a assinatura continuaria válida, porque é o mesmo provedor. */
  if (claims.nonce !== ctx.expectedNonce) {
    return { ok: false, error: "O token não corresponde a esta tentativa de login." };
  }

  if (!claims.sub) {
    return { ok: false, error: "O token não identifica a pessoa." };
  }

  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) {
    return { ok: false, error: "O provedor não informou o e-mail." };
  }

  /* `email_verified: false` significa que o provedor NÃO confirmou que a pessoa
     controla aquele endereço. Aceitar seria deixar qualquer um declarar o
     e-mail de outra pessoa e receber a conta dela — o pior tipo de falha,
     porque parece um login normal. Ausente é diferente de falso: nem todo
     provedor manda o campo, e recusar por ausência quebraria provedores
     corretos. */
  if (claims.email_verified === false) {
    return { ok: false, error: "O provedor não confirmou este e-mail." };
  }

  const dominios = ctx.allowedDomains ?? [];
  if (dominios.length > 0) {
    const dominio = email.split("@")[1] ?? "";
    if (!dominios.includes(dominio)) {
      return { ok: false, error: "Este e-mail não pertence a um domínio autorizado." };
    }
  }

  return { ok: true, claims: { ...claims, email } };
}

/**
 * Lê as afirmações sem validar nada.
 *
 * Existe para quem já validou a assinatura e precisa do conteúdo. O nome é
 * longo de propósito: quem escrever `decodeIdToken` e usar o resultado direto
 * está criando um buraco, e o nome deveria fazer parar para pensar.
 */
export function decodeIdTokenUnverified(idToken: string): IdTokenClaims | null {
  const partes = idToken.split(".");
  if (partes.length !== 3) return null;

  const payload = decodeJwtSegment(partes[1]!);
  if (!payload || typeof payload !== "object") return null;

  return payload as IdTokenClaims;
}
