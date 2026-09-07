import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  initiationPayload,
  isRegisteredRedirect,
  validateAuthRequest,
} from "./oidc-launch.ts";

function pedido(over: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    scope: "openid",
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    client_id: "ferramenta-1",
    redirect_uri: "https://ferramenta.com/lti/launch",
    login_hint: "u-123",
    nonce: "nonce-da-ferramenta",
    state: "state-da-ferramenta",
    ...over,
  });
}

describe("LTI — etapa 1, iniciação", () => {
  test("leva o que a ferramenta precisa para voltar", () => {
    const campos = initiationPayload({
      iss: "https://treinamento.acme.com.br",
      loginHint: "u-1",
      targetLinkUri: "https://ferramenta.com/atividade/9",
      ltiMessageHint: "msg-1",
      clientId: "ferramenta-1",
      deploymentId: "dep-1",
    });

    assert.equal(campos.iss, "https://treinamento.acme.com.br");
    assert.equal(campos.login_hint, "u-1");
    assert.equal(campos.target_link_uri, "https://ferramenta.com/atividade/9");
    assert.equal(campos.lti_message_hint, "msg-1");
  });

  test("não leva nada sensível", () => {
    /* A etapa 1 é pública por natureza: diz só "alguém quer abrir isto". Quem
       manda dado de pessoa aqui o entrega antes de a ferramenta se
       identificar. */
    const campos = initiationPayload({
      iss: "https://x",
      loginHint: "u-1",
      targetLinkUri: "https://f/a",
      ltiMessageHint: "m",
      clientId: "c",
      deploymentId: "d",
    });

    const tudo = JSON.stringify(campos).toLowerCase();
    assert.ok(!tudo.includes("@"), "e-mail não pode estar aqui");
    assert.ok(!tudo.includes("token"));
  });
});

describe("LTI — etapa 2, pedido de autenticação", () => {
  test("pedido correto passa", () => {
    const r = validateAuthRequest(pedido());
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.request.nonce, "nonce-da-ferramenta");
  });

  test("escopo diferente de openid é recusado", () => {
    assert.equal(validateAuthRequest(pedido({ scope: "profile" })).ok, false);
  });

  test("resposta que não é id_token é recusada", () => {
    assert.equal(validateAuthRequest(pedido({ response_type: "code" })).ok, false);
  });

  test("entrega em query string é recusada", () => {
    /* O token na URL vira histórico do navegador, log do servidor e `Referer`:
       a credencial guardada em texto em três lugares. */
    const r = validateAuthRequest(pedido({ response_mode: "query" }));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /form_post/);
  });

  test("pedir login de novo no meio do launch é recusado", () => {
    assert.equal(validateAuthRequest(pedido({ prompt: "login" })).ok, false);
  });

  test("pedido sem nonce é recusado", () => {
    /* Sem o nonce dela, o token não prova nada para ela. */
    const sem = pedido();
    sem.delete("nonce");
    assert.equal(validateAuthRequest(sem).ok, false);
  });

  test("state é opcional — a especificação não exige", () => {
    /* Exigir quebraria ferramenta correta que não manda. */
    const sem = pedido();
    sem.delete("state");
    const r = validateAuthRequest(sem);

    assert.equal(r.ok, true);
    assert.equal(r.ok && r.request.state, "");
  });

  test("pedido sem redirect_uri é recusado", () => {
    const sem = pedido();
    sem.delete("redirect_uri");
    assert.equal(validateAuthRequest(sem).ok, false);
  });
});

describe("LTI — o redirect_uri é conferido por igualdade", () => {
  test("endereço cadastrado passa", () => {
    assert.equal(
      isRegisteredRedirect("https://ferramenta.com/lti/launch", [
        "https://ferramenta.com/lti/launch",
        "https://ferramenta.com/lti/deeplink",
      ]),
      true,
    );
  });

  test("endereço parecido NÃO passa", () => {
    /* O ataque: `https://ferramenta.com.evil.com` começa com o endereço
       cadastrado. Uma comparação por prefixo mandaria o token assinado por nós
       para o servidor de outra pessoa — a credencial inteira, de bandeja. */
    assert.equal(
      isRegisteredRedirect("https://ferramenta.com.evil.com/lti", ["https://ferramenta.com"]),
      false,
    );
    assert.equal(
      isRegisteredRedirect("https://ferramenta.com/lti/launch/extra", [
        "https://ferramenta.com/lti/launch",
      ]),
      false,
    );
  });

  test("sem nada cadastrado, nada passa", () => {
    assert.equal(isRegisteredRedirect("https://qualquer.com", []), false);
  });

  test("espaço nas pontas não decide segurança", () => {
    /* Um endereço colado num formulário costuma vir com espaço. Recusar por
       isso seria um defeito de configuração disfarçado de erro de segurança. */
    assert.equal(
      isRegisteredRedirect(" https://ferramenta.com/lti ", ["https://ferramenta.com/lti"]),
      true,
    );
  });
});
