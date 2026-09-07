import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  AGS_SCOPES,
  LTI_ROLES,
  deepLinkClaims,
  isFinalScore,
  ltiRolesOf,
  parseDeepLinkItems,
  resourceLinkClaims,
  validateIncomingClaims,
} from "./claims.ts";

const NS = "https://purl.imsglobal.org/spec/lti/claim";
const NS_DL = "https://purl.imsglobal.org/spec/lti-dl/claim";
const AGORA = new Date("2026-06-01T12:00:00Z").getTime();

function launch(over: Record<string, unknown> = {}) {
  return resourceLinkClaims({
    issuer: "https://lms.exemplo.com",
    clientId: "cli-lab-virtual",
    userId: "u-1",
    userName: "Maria Souza",
    userEmail: "maria@exemplo.com.br",
    role: "learner",
    contextId: "c-1",
    contextTitle: "Tratamento de Água",
    platformName: "Empresa Exemplo",
    linkId: "l-1",
    linkTitle: "Laboratório do módulo 2",
    targetLinkUri: "https://lab.exemplo/launch",
    deploymentId: "d-1",
    nonce: "n-1",
    now: AGORA,
    ...over,
  });
}

describe("LTI 1.3 — claims — F6-04", () => {
  test("o launch tem os campos obrigatórios do padrão", () => {
    /* Faltar um faz a ferramenta recusar com uma mensagem que não diz qual. */
    const c = launch();

    assert.equal(c.iss, "https://lms.exemplo.com");
    assert.equal(c.aud, "cli-lab-virtual");
    assert.equal(c.sub, "u-1");
    assert.equal(c.nonce, "n-1");
    assert.equal(c[`${NS}/message_type`], "LtiResourceLinkRequest");
    assert.equal(c[`${NS}/version`], "1.3.0");
    assert.equal(c[`${NS}/deployment_id`], "d-1");
    assert.equal(c[`${NS}/target_link_uri`], "https://lab.exemplo/launch");
    assert.ok(c[`${NS}/resource_link`]);
    assert.ok(c[`${NS}/context`]);
    assert.ok(Array.isArray(c[`${NS}/roles`]));
  });

  test("o token expira em minutos, não horas", () => {
    /* Um launch dura segundos. Token longo é janela de replay. */
    const c = launch();

    assert.equal(c.iat, Math.floor(AGORA / 1000));
    assert.equal((c.exp as number) - (c.iat as number), 300);
  });

  test("o admin também é instrutor para a ferramenta", () => {
    /* Sem isso, uma ferramenta que só olha papel de curso trataria o
       administrador como visitante. */
    assert.deepEqual(ltiRolesOf("learner"), [LTI_ROLES.learner]);
    assert.deepEqual(ltiRolesOf("instructor"), [LTI_ROLES.instructor]);
    assert.deepEqual(ltiRolesOf("admin"), [LTI_ROLES.admin, LTI_ROLES.instructor]);
    assert.deepEqual(ltiRolesOf("manager"), [LTI_ROLES.manager]);
  });

  test("sem e-mail não inventa campo vazio", () => {
    /* Um `email: ""` faria a ferramenta criar conta com endereço em branco. */
    const c = launch({ userEmail: null });

    assert.equal("email" in c, false);
    assert.equal(launch().email, "maria@exemplo.com.br");
  });

  test("AGS e NRPS só aparecem quando a ferramenta pode usá-los", () => {
    /* Anunciar um serviço que a plataforma vai recusar faria a ferramenta
       falhar DEPOIS do launch, quando já parece que deu certo. */
    const sem = launch();
    assert.equal("https://purl.imsglobal.org/spec/lti-ags/claim/endpoint" in sem, false);

    const com = launch({
      ags: { lineitemUrl: "https://lms.exemplo.com/api/lti/ags/l-1", scopes: [...AGS_SCOPES] },
      nrps: { contextMembershipsUrl: "https://lms.exemplo.com/api/lti/nrps/c-1" },
    });

    const endpoint = com["https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"] as Record<
      string,
      unknown
    >;
    assert.equal(endpoint.lineitem, "https://lms.exemplo.com/api/lti/ags/l-1");
    assert.ok(
      com["https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice"],
    );
  });

  test("o Deep Linking pede o que sabemos receber", () => {
    const c = deepLinkClaims({
      issuer: "https://lms.exemplo.com",
      clientId: "cli-1",
      userId: "u-1",
      userName: "Rafael",
      role: "instructor",
      deploymentId: "d-1",
      nonce: "n-1",
      returnUrl: "https://lms.exemplo.com/api/lti/deeplink",
      contextId: "c-1",
      contextTitle: "Curso",
      now: AGORA,
    });

    assert.equal(c[`${NS}/message_type`], "LtiDeepLinkingRequest");

    const settings = c[`${NS_DL}/deep_linking_settings`] as Record<string, unknown>;
    assert.deepEqual(settings.accept_types, ["ltiResourceLink"]);
    assert.equal(settings.deep_link_return_url, "https://lms.exemplo.com/api/lti/deeplink");
  });

  test("recusa token que não é para esta plataforma", () => {
    /* É o que impede alguém de reaproveitar aqui um token emitido para outra
       instalação. */
    const resultado = validateIncomingClaims(
      { iss: "https://ferramenta", sub: "u", nonce: "n", aud: "https://outra-plataforma" },
      { issuer: "https://lms.exemplo.com", clientId: "cli-1" },
      AGORA,
    );

    assert.deepEqual(resultado, { ok: false, error: "wrong_audience" });
  });

  test("aud como array também vale — o padrão permite", () => {
    const resultado = validateIncomingClaims(
      {
        iss: "https://ferramenta",
        sub: "u",
        nonce: "n",
        aud: ["https://outra", "https://lms.exemplo.com"],
        [`${NS}/deployment_id`]: "d-1",
      },
      { issuer: "https://lms.exemplo.com", clientId: "cli-1" },
      AGORA,
    );

    assert.deepEqual(resultado, { ok: true });
  });

  test("recusa o que falta e o que venceu", () => {
    const base = {
      iss: "https://f",
      sub: "u",
      nonce: "n",
      aud: "https://lms.exemplo.com",
      [`${NS}/deployment_id`]: "d-1",
    };
    const esperado = { issuer: "https://lms.exemplo.com", clientId: "cli-1" };

    assert.equal(validateIncomingClaims({ ...base, iss: "" }, esperado, AGORA).ok, false);
    assert.equal(validateIncomingClaims({ ...base, sub: "" }, esperado, AGORA).ok, false);
    assert.equal(validateIncomingClaims({ ...base, nonce: "" }, esperado, AGORA).ok, false);

    const vencido = validateIncomingClaims(
      { ...base, exp: Math.floor(AGORA / 1000) - 600 },
      esperado,
      AGORA,
    );
    assert.deepEqual(vencido, { ok: false, error: "expired" });

    /* Sem deployment_id não dá para saber de que instalação veio. */
    const semDeployment = validateIncomingClaims(
      { iss: "https://f", sub: "u", nonce: "n", aud: "https://lms.exemplo.com" },
      esperado,
      AGORA,
    );
    assert.deepEqual(semDeployment, { ok: false, error: "missing_deployment" });
  });

  test("tolera 60s de desalinho de relógio", () => {
    /* Servidor desalinhado é a causa mais comum de launch recusado. */
    const base = {
      iss: "https://f",
      sub: "u",
      nonce: "n",
      aud: "https://lms.exemplo.com",
      [`${NS}/deployment_id`]: "d-1",
    };
    const esperado = { issuer: "https://lms.exemplo.com", clientId: "cli-1" };

    /* Expirou há 30s: ainda passa. */
    assert.equal(
      validateIncomingClaims(
        { ...base, exp: Math.floor(AGORA / 1000) - 30 },
        esperado,
        AGORA,
      ).ok,
      true,
    );

    /* Emitido 30s no futuro: ainda passa. */
    assert.equal(
      validateIncomingClaims(
        { ...base, iat: Math.floor(AGORA / 1000) + 30 },
        esperado,
        AGORA,
      ).ok,
      true,
    );

    /* Emitido 5 minutos no futuro: não. */
    assert.deepEqual(
      validateIncomingClaims(
        { ...base, iat: Math.floor(AGORA / 1000) + 300 },
        esperado,
        AGORA,
      ),
      { ok: false, error: "not_yet_valid" },
    );
  });

  test("o tipo da mensagem é conferido quando pedido", () => {
    const base = {
      iss: "https://f",
      sub: "u",
      nonce: "n",
      aud: "https://lms.exemplo.com",
      [`${NS}/deployment_id`]: "d-1",
      [`${NS}/message_type`]: "LtiDeepLinkingResponse",
    };

    assert.equal(
      validateIncomingClaims(
        base,
        {
          issuer: "https://lms.exemplo.com",
          clientId: "c",
          messageType: "LtiDeepLinkingResponse",
        },
        AGORA,
      ).ok,
      true,
    );

    assert.deepEqual(
      validateIncomingClaims(
        base,
        { issuer: "https://lms.exemplo.com", clientId: "c", messageType: "LtiStartAssessment" },
        AGORA,
      ),
      { ok: false, error: "wrong_message_type" },
    );
  });

  test("os itens do Deep Linking são filtrados pelo que sabemos usar", () => {
    const itens = parseDeepLinkItems({
      [`${NS_DL}/content_items`]: [
        {
          type: "ltiResourceLink",
          title: "Exercício de bombas",
          url: "https://lab.exemplo/ex/42",
          lineItem: { scoreMaximum: 10 },
        },
        /* Tipo que não declaramos aceitar. */
        { type: "html", html: "<p>oi</p>" },
        /* URL insegura. */
        { type: "ltiResourceLink", title: "x", url: "http://inseguro/x" },
        /* Sem URL. */
        { type: "ltiResourceLink", title: "y" },
      ],
    });

    assert.equal(itens.length, 1);
    assert.equal(itens[0]!.title, "Exercício de bombas");
    assert.equal(itens[0]!.lineItemScoreMaximum, 10);
  });

  test("item sem título ganha um, em vez de virar linha vazia", () => {
    const itens = parseDeepLinkItems({
      [`${NS_DL}/content_items`]: [
        { type: "ltiResourceLink", url: "https://lab.exemplo/x" },
      ],
    });

    assert.equal(itens[0]!.title, "Atividade");
    assert.equal(itens[0]!.lineItemScoreMaximum, null);
  });

  test("content_items ausente ou malformado devolve lista vazia", () => {
    assert.deepEqual(parseDeepLinkItems({}), []);
    assert.deepEqual(parseDeepLinkItems({ [`${NS_DL}/content_items`]: "nao e array" }), []);
  });

  test("só nota FullyGraded é final", () => {
    /* Uma nota com `PendingManual` é parcial: lançá-la como final colocaria no
       livro um número que ainda vai mudar. */
    assert.equal(isFinalScore("FullyGraded"), true);
    assert.equal(isFinalScore("PendingManual"), false);
    assert.equal(isFinalScore("Pending"), false);
    assert.equal(isFinalScore(undefined), false);
  });
});
