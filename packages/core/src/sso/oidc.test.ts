import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildAuthorizationUrl,
  decodeIdTokenUnverified,
  parseCallback,
  validateIdTokenClaims,
  type IdTokenClaims,
  type ValidationContext,
} from "./oidc.ts";

const AGORA = 1_800_000_000;

function claims(over: Partial<IdTokenClaims> = {}): IdTokenClaims {
  return {
    iss: "https://accounts.google.com",
    aud: "cliente-123",
    sub: "u-abc",
    exp: AGORA + 3600,
    iat: AGORA - 10,
    nonce: "n-1",
    email: "ana@empresa.com.br",
    email_verified: true,
    name: "Ana Souza",
    ...over,
  };
}

function ctx(over: Partial<ValidationContext> = {}): ValidationContext {
  return {
    expectedIssuer: "https://accounts.google.com",
    expectedAudience: "cliente-123",
    expectedNonce: "n-1",
    now: AGORA,
    ...over,
  };
}

describe("OIDC: URL de autorização", () => {
  test("leva os parâmetros que o protocolo exige", () => {
    const url = new URL(
      buildAuthorizationUrl({
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        clientId: "cliente-123",
        redirectUri: "https://treinamento.acme.com.br/sso/callback",
        scopes: ["openid", "email", "profile"],
        state: "s-1",
        nonce: "n-1",
      }),
    );

    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "cliente-123");
    assert.equal(url.searchParams.get("scope"), "openid email profile");
    assert.equal(url.searchParams.get("state"), "s-1");
    assert.equal(url.searchParams.get("nonce"), "n-1");
  });

  test("preserva parâmetros que já estavam no endereço do provedor", () => {
    /* Alguns provedores publicam a URL de autorização já com parâmetros. Montar
       a URL por concatenação apagaria esses valores. */
    const url = new URL(
      buildAuthorizationUrl({
        authorizationUrl: "https://sso.cliente.com/auth?realm=corporativo",
        clientId: "c",
        redirectUri: "https://x/cb",
        scopes: ["openid"],
        state: "s",
        nonce: "n",
      }),
    );

    assert.equal(url.searchParams.get("realm"), "corporativo");
    assert.equal(url.searchParams.get("client_id"), "c");
  });

  test("o login_hint só aparece quando existe", () => {
    const semDica = new URL(
      buildAuthorizationUrl({
        authorizationUrl: "https://p/auth",
        clientId: "c",
        redirectUri: "https://x/cb",
        scopes: ["openid"],
        state: "s",
        nonce: "n",
        loginHint: null,
      }),
    );

    assert.equal(semDica.searchParams.has("login_hint"), false);
  });
});

describe("OIDC, retorno do provedor", () => {
  test("código e state passam", () => {
    const r = parseCallback(new URLSearchParams("code=abc&state=s-1"));
    assert.deepEqual(r, { ok: true, code: "abc", state: "s-1" });
  });

  test("quem cancelou não vê mensagem de erro", () => {
    /* Desistir do login é uma escolha, não uma falha. */
    const r = parseCallback(new URLSearchParams("error=access_denied"));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /cancelado/i);
  });

  test("retorno sem código é recusado", () => {
    assert.equal(parseCallback(new URLSearchParams("state=s-1")).ok, false);
  });

  test("retorno sem state é recusado", () => {
    /* Sem state não há como saber se este retorno corresponde a um pedido
       nosso — que é a única defesa contra CSRF no fluxo. */
    assert.equal(parseCallback(new URLSearchParams("code=abc")).ok, false);
  });
});

describe("OIDC, validação do id_token", () => {
  test("token correto passa", () => {
    const r = validateIdTokenClaims(claims(), ctx());
    assert.equal(r.ok, true);
  });

  test("emissor diferente é recusado", () => {
    const r = validateIdTokenClaims(claims({ iss: "https://malicioso.com" }), ctx());
    assert.equal(r.ok, false);
  });

  test("token emitido para OUTRO aplicativo é recusado", () => {
    /* Assinatura válida, provedor certo, e ainda assim não serve: foi emitido
       para outro cliente do mesmo provedor. Aceitar deixaria qualquer app do
       Google entrar aqui com o token dele. */
    const r = validateIdTokenClaims(claims({ aud: "outro-app" }), ctx());
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /outro aplicativo/i);
  });

  test("aud em lista é aceito quando nos inclui", () => {
    const r = validateIdTokenClaims(claims({ aud: ["outro", "cliente-123"] }), ctx());
    assert.equal(r.ok, true);
  });

  test("token expirado é recusado", () => {
    const r = validateIdTokenClaims(claims({ exp: AGORA - 3600 }), ctx());
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /expirou/i);
  });

  test("expirado há poucos segundos ainda passa", () => {
    /* Relógios discordam. Sem folga, o login falha por diferença de segundos
       entre duas máquinas certas. */
    const r = validateIdTokenClaims(claims({ exp: AGORA - 30 }), ctx());
    assert.equal(r.ok, true);
  });

  test("nonce diferente é recusado", () => {
    /* É o que impede reaproveitar um id_token capturado de outro login: a
       assinatura continua válida, porque o provedor é o mesmo. */
    const r = validateIdTokenClaims(claims({ nonce: "n-outro" }), ctx());
    assert.equal(r.ok, false);
  });

  test("token sem nonce é recusado", () => {
    const semNonce = claims();
    delete semNonce.nonce;
    assert.equal(validateIdTokenClaims(semNonce, ctx()).ok, false);
  });
});

describe("OIDC, e-mail e domínio", () => {
  test("e-mail não confirmado pelo provedor é recusado", () => {
    /* Aceitar deixaria alguém declarar o e-mail de outra pessoa no provedor e
       receber a conta dela aqui — parecendo um login normal. */
    const r = validateIdTokenClaims(claims({ email_verified: false }), ctx());
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /não confirmou/i);
  });

  test("provedor que não manda email_verified não é punido", () => {
    /* Ausente é diferente de falso. Recusar por ausência quebraria provedores
       corretos que simplesmente não emitem o campo. */
    const semCampo = claims();
    delete semCampo.email_verified;
    assert.equal(validateIdTokenClaims(semCampo, ctx()).ok, true);
  });

  test("token sem e-mail é recusado", () => {
    const semEmail = claims();
    delete semEmail.email;
    assert.equal(validateIdTokenClaims(semEmail, ctx()).ok, false);
  });

  test("o e-mail volta normalizado", () => {
    const r = validateIdTokenClaims(claims({ email: "  Ana@Empresa.COM.BR " }), ctx());
    assert.equal(r.ok && r.claims.email, "ana@empresa.com.br");
  });

  test("domínio de fora é recusado quando há restrição", () => {
    /* O caso real: a empresa usa o Google como provedor, e sem esta trava
       qualquer conta @gmail.com do mundo entraria no ambiente corporativo. */
    const r = validateIdTokenClaims(
      claims({ email: "qualquer@gmail.com" }),
      ctx({ allowedDomains: ["empresa.com.br"] }),
    );

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /domínio/i);
  });

  test("domínio autorizado passa", () => {
    const r = validateIdTokenClaims(claims(), ctx({ allowedDomains: ["empresa.com.br"] }));
    assert.equal(r.ok, true);
  });

  test("a comparação de domínio não se deixa enganar por maiúsculas", () => {
    const r = validateIdTokenClaims(
      claims({ email: "Ana@EMPRESA.COM.BR" }),
      ctx({ allowedDomains: ["empresa.com.br"] }),
    );

    assert.equal(r.ok, true);
  });

  test("sem lista de domínios, qualquer um passa", () => {
    const r = validateIdTokenClaims(claims({ email: "ana@gmail.com" }), ctx());
    assert.equal(r.ok, true);
  });

  test("subdomínio não passa por domínio autorizado", () => {
    /* `empresa.com.br.malicioso.com` termina com o domínio permitido, e uma
       comparação por sufixo aceitaria. A comparação é do domínio inteiro. */
    const r = validateIdTokenClaims(
      claims({ email: "ana@empresa.com.br.malicioso.com" }),
      ctx({ allowedDomains: ["empresa.com.br"] }),
    );

    assert.equal(r.ok, false);
  });
});

describe("OIDC, leitura sem validação", () => {
  test("lê o conteúdo de um token bem formado", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "u-1" })).toString("base64url");
    const lido = decodeIdTokenUnverified(`cabecalho.${payload}.assinatura`);

    assert.equal(lido?.sub, "u-1");
  });

  test("texto que não é JWT devolve null", () => {
    assert.equal(decodeIdTokenUnverified("nao-e-um-token"), null);
    assert.equal(decodeIdTokenUnverified("a.b.c"), null);
  });
});
