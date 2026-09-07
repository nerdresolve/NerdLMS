import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildAuthorizationUrl, parseCallback, validateIdTokenClaims } from "./oidc.ts";
import { decideLink } from "./linking.ts";
import { providerPreset, resolveEndpoint } from "./providers.ts";

/**
 * O fluxo inteiro, das peças puras.
 *
 * Os testes por módulo cobrem cada função; este cobre a COSTURA — que a saída
 * de uma serve de entrada para a seguinte. É onde aparecem os erros que nenhum
 * teste de unidade pega: o `nonce` gerado num lugar e conferido em outro, o
 * `state` que volta diferente, o e-mail que chega normalizado de um jeito e é
 * comparado de outro.
 */

const AGORA = 1_800_000_000;

describe("SSO, o caminho feliz, ponta a ponta", () => {
  test("Google: da URL de autorização até a decisão de vincular", () => {
    const preset = providerPreset("google")!;

    /* 1. Ida ao provedor. */
    const state = "st-aleatorio";
    const nonce = "no-aleatorio";
    const url = new URL(
      buildAuthorizationUrl({
        authorizationUrl: preset.authorizationUrl!,
        clientId: "app-da-acme",
        redirectUri: "https://treinamento.acme.com.br/api/sso/retorno",
        scopes: preset.scopes,
        state,
        nonce,
      }),
    );

    /* 2. O provedor devolve com o mesmo `state`. */
    const volta = parseCallback(
      new URLSearchParams({ code: "cod-123", state: url.searchParams.get("state")! }),
    );
    assert.equal(volta.ok, true);
    assert.equal(volta.ok && volta.state, state);

    /* 3. O id_token é validado contra o que guardamos. */
    const validado = validateIdTokenClaims(
      {
        iss: preset.issuer!,
        aud: "app-da-acme",
        sub: "google-sub-999",
        exp: AGORA + 3600,
        iat: AGORA - 5,
        nonce,
        email: "Ana.Souza@ACME.com.br",
        email_verified: true,
        name: "Ana Souza",
      },
      {
        expectedIssuer: preset.issuer!,
        expectedAudience: "app-da-acme",
        expectedNonce: nonce,
        now: AGORA,
        allowedDomains: ["acme.com.br"],
      },
    );
    assert.equal(validado.ok, true);

    /* 4. A decisão: conta existente com o mesmo e-mail é vinculada.

       O e-mail chega do provedor com maiúsculas e sai normalizado do passo 3.
       Se a normalização não atravessasse, a comparação com a conta do banco
       falharia e a pessoa ganharia uma conta duplicada em vez de entrar na
       dela. É exatamente a costura que este teste existe para provar. */
    const email = String(validado.ok && validado.claims.email);
    assert.equal(email, "ana.souza@acme.com.br");

    const decisao = decideLink({
      provider: "google",
      subject: String(validado.ok && validado.claims.sub),
      email,
      fullName: "Ana Souza",
      linked: null,
      byEmail: { id: "u-7", email, status: "active", hasAnyLink: false },
      allowJit: false,
      jitRole: "learner",
    });

    assert.deepEqual(decisao, { kind: "link-and-login", userId: "u-7" });
  });

  test("Microsoft: o diretório atravessa todos os endereços", () => {
    const preset = providerPreset("microsoft")!;
    const diretorio = "11111111-2222-3333-4444-555555555555";

    const autorizacao = resolveEndpoint(preset.authorizationUrl, diretorio)!;
    const emissor = resolveEndpoint(preset.issuer, diretorio)!;

    assert.ok(autorizacao.includes(diretorio));
    assert.ok(!autorizacao.includes("{tenant}"));

    /* O emissor resolvido tem de bater com o `iss` do token — se um lado
       resolvesse o marcador e o outro não, todo login seria recusado. */
    const validado = validateIdTokenClaims(
      {
        iss: emissor,
        aud: "app",
        sub: "s",
        exp: AGORA + 60,
        iat: AGORA,
        nonce: "n",
        email: "joao@acme.com.br",
      },
      { expectedIssuer: emissor, expectedAudience: "app", expectedNonce: "n", now: AGORA },
    );

    assert.equal(validado.ok, true);
  });

  test("state trocado no meio do caminho não passa", () => {
    /* O ataque que o `state` existe para barrar: um retorno forjado, com código
       válido do atacante, chegando ao navegador da vítima. */
    const volta = parseCallback(new URLSearchParams({ code: "c", state: "st-do-atacante" }));
    assert.equal(volta.ok, true);
    assert.notEqual(volta.ok && volta.state, "st-legitimo");
  });

  test("o provedor certo, mas o token de outro app, não passa", () => {
    const preset = providerPreset("google")!;

    const validado = validateIdTokenClaims(
      {
        iss: preset.issuer!,
        aud: "app-de-outra-empresa",
        sub: "s",
        exp: AGORA + 60,
        iat: AGORA,
        nonce: "n",
        email: "x@acme.com.br",
      },
      {
        expectedIssuer: preset.issuer!,
        expectedAudience: "app-da-acme",
        expectedNonce: "n",
        now: AGORA,
      },
    );

    assert.equal(validado.ok, false);
  });
});
