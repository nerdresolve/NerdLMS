import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { PROVIDER_PRESETS, providerPreset, resolveEndpoint } from "./providers.ts";

describe("SSO, provedores pré-configurados", () => {
  test("Google e Microsoft vêm com os endereços prontos", () => {
    /* É o ponto do white-label: quem implanta cola duas chaves e liga, sem
       precisar descobrir URL de provedor. */
    for (const id of ["google", "microsoft"] as const) {
      const p = providerPreset(id)!;
      assert.ok(p.authorizationUrl, `${id} sem URL de autorização`);
      assert.ok(p.tokenUrl, `${id} sem URL de token`);
      assert.ok(p.jwksUrl, `${id} sem JWKS`);
      assert.ok(p.issuer, `${id} sem issuer`);
    }
  });

  test("todo provedor pede openid", () => {
    /* Sem `openid` o provedor devolve um token de acesso comum e nenhum
       `id_token` — e sem `id_token` não há login. */
    for (const p of PROVIDER_PRESETS) {
      assert.ok(p.scopes.includes("openid"), `${p.id} não pede openid`);
    }
  });

  test("todo provedor pede o e-mail", () => {
    /* O e-mail é a chave do vínculo com a conta. Sem ele, o login não sabe
       quem entrou. */
    for (const p of PROVIDER_PRESETS) {
      assert.ok(p.scopes.includes("email"), `${p.id} não pede email`);
    }
  });

  test("o genérico não inventa endereços", () => {
    /* Não há valor padrão possível para Okta ou Keycloak; fingir um deixaria o
       login falhar longe daqui, com uma mensagem que não explica nada. */
    const p = providerPreset("generico")!;
    assert.equal(p.authorizationUrl, null);
    assert.equal(p.issuer, null);
  });

  test("provedor desconhecido não existe", () => {
    assert.equal(providerPreset("facebook"), undefined);
  });

  test("todo provedor explica como configurar", () => {
    for (const p of PROVIDER_PRESETS) {
      assert.ok(p.hint.length > 40, `${p.id} sem instrução útil`);
    }
  });
});

describe("SSO, endereço com locatário", () => {
  test("a Microsoft recebe o diretório no lugar do marcador", () => {
    const url = resolveEndpoint(
      "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
      "abc-123",
    );

    assert.equal(url, "https://login.microsoftonline.com/abc-123/oauth2/v2.0/authorize");
  });

  test("o marcador é trocado em todas as ocorrências", () => {
    assert.equal(resolveEndpoint("https://x/{tenant}/y/{tenant}", "t"), "https://x/t/y/t");
  });

  test("sem o diretório, o endereço não é montado", () => {
    /* Um endereço com `{tenant}` literal chegaria à Microsoft e voltaria um
       erro que não explica nada. Falhar na configuração é mais barato que
       falhar no meio do login de alguém. */
    assert.equal(resolveEndpoint("https://x/{tenant}/y", null), null);
    assert.equal(resolveEndpoint("https://x/{tenant}/y", "   "), null);
  });

  test("endereço sem marcador passa inteiro", () => {
    const google = "https://accounts.google.com/o/oauth2/v2/auth";
    assert.equal(resolveEndpoint(google, null), google);
  });

  test("o Google não exige diretório e a Microsoft exige", () => {
    assert.equal(providerPreset("google")!.requiresTenantId, false);
    assert.equal(providerPreset("microsoft")!.requiresTenantId, true);
  });

  test("a Microsoft não aceita qualquer conta do mundo", () => {
    /* `common` no lugar do tenant aceitaria contas pessoais da Microsoft.
       Numa plataforma corporativa isso é uma porta aberta. */
    const p = providerPreset("microsoft")!;
    assert.ok(p.authorizationUrl!.includes("{tenant}"));
    assert.ok(!p.authorizationUrl!.includes("/common/"));
  });
});
