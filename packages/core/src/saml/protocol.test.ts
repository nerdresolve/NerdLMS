import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildAuthnRequest, readAssertionClaims } from "./protocol.ts";
import { findElement } from "./xml.ts";

const AGORA = Date.parse("2026-08-24T17:00:00Z");

function assercao(over: {
  issuer?: string;
  audience?: string;
  inResponseTo?: string;
  notBefore?: string;
  notOnOrAfter?: string;
  nameId?: string;
  atributos?: string;
} = {}): string {
  const issuer = over.issuer ?? "https://idp.acme.com";
  const audience = over.audience ?? "https://treinamento.acme.com.br";
  const nameId = over.nameId ?? "ana@acme.com";
  const irt = over.inResponseTo ?? "_req1";
  const nb = over.notBefore ?? "2026-08-24T16:55:00Z";
  const noa = over.notOnOrAfter ?? "2026-08-24T17:05:00Z";

  return `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a1">
    <saml:Issuer>${issuer}</saml:Issuer>
    <saml:Subject>
      <saml:NameID>${nameId}</saml:NameID>
      <saml:SubjectConfirmation>
        <saml:SubjectConfirmationData InResponseTo="${irt}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}">
      <saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction>
    </saml:Conditions>
    ${over.atributos ?? ""}
  </saml:Assertion>`;
}

const contexto = {
  expectedIssuer: "https://idp.acme.com",
  expectedAudience: "https://treinamento.acme.com.br",
  expectedInResponseTo: "_req1",
  now: AGORA,
};

function ler(xml: string, ctx = contexto) {
  return readAssertionClaims(findElement(xml, "Assertion")!, ctx);
}

describe("SAML, o pedido de autenticação", () => {
  test("declara quem somos e para onde a resposta volta", () => {
    const req = buildAuthnRequest({
      issuer: "https://treinamento.acme.com.br",
      assertionConsumerServiceUrl: "https://treinamento.acme.com.br/api/saml/retorno",
      id: "_req1",
      instant: "2026-08-24T17:00:00Z",
    });

    assert.match(req, /ID="_req1"/);
    assert.match(req, /Version="2.0"/);
    assert.match(req, /HTTP-POST/);
    assert.match(req, /treinamento.acme.com.br/);
  });

  test("caracteres especiais na URL são escapados", () => {
    /* Um & numa URL de retorno quebraria o XML e o provedor recusaria com um
       erro que não aponta para a causa. */
    const req = buildAuthnRequest({
      issuer: "https://x",
      assertionConsumerServiceUrl: "https://x/cb?a=1&b=2",
      id: "_r",
      instant: "2026-08-24T17:00:00Z",
    });

    assert.match(req, /a=1&amp;b=2/);
    assert.ok(!/a=1&b=2/.test(req));
  });
});

describe("SAML, condições da asserção", () => {
  test("asserção correta é lida", () => {
    const r = ler(assercao());

    assert.equal(r.ok, true, r.ok ? "" : r.error);
    assert.equal(r.ok && r.claims.email, "ana@acme.com");
    assert.equal(r.ok && r.claims.issuer, "https://idp.acme.com");
  });

  test("emissor diferente é recusado", () => {
    const r = ler(assercao({ issuer: "https://idp-falso.com" }));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /outro provedor/i);
  });

  test("asserção emitida para OUTRO sistema é recusada", () => {
    /* Assinatura válida, emissor certo, pessoa certa — e destino errado. É o
       equivalente ao `aud` do OIDC. */
    const r = ler(assercao({ audience: "https://outro-sistema.com" }));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /outro sistema/i);
  });

  test("asserção expirada é recusada", () => {
    /* Sem a janela, uma asserção capturada hoje entraria amanhã: a assinatura
       continua válida para sempre. */
    const r = ler(assercao({ notOnOrAfter: "2026-08-24T16:00:00Z" }));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /expirou/i);
  });

  test("asserção do futuro é recusada", () => {
    const r = ler(assercao({ notBefore: "2026-08-24T18:00:00Z" }));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /ainda não é válida/i);
  });

  test("expirada há poucos segundos ainda passa", () => {
    /* Relógios discordam. Sem folga, o login falha por diferença de segundos
       entre duas máquinas certas. */
    const r = ler(assercao({ notOnOrAfter: "2026-08-24T16:59:30Z" }));
    assert.equal(r.ok, true);
  });

  test("resposta a OUTRO pedido é recusada", () => {
    /* Impede que alguém entregue ao navegador de outra pessoa uma asserção
       legítima obtida em outro lugar. */
    const r = ler(assercao({ inResponseTo: "_pedido-de-outra-pessoa" }));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /outro pedido/i);
  });

  test("asserção sem NameID é recusada", () => {
    const semNome = assercao().replace(/<saml:NameID>[^<]*<\/saml:NameID>/, "");
    assert.equal(ler(semNome).ok, false);
  });
});

describe("SAML, o e-mail vem de onde o provedor mandar", () => {
  test("do atributo, quando há", () => {
    const r = ler(
      assercao({
        nameId: "S-1-5-21-abc",
        atributos:
          '<saml:AttributeStatement><saml:Attribute Name="mail">' +
          "<saml:AttributeValue>ana@acme.com</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>",
      }),
    );

    assert.equal(r.ok && r.claims.email, "ana@acme.com");
  });

  test("do NameID, quando ele já é um e-mail", () => {
    const r = ler(assercao());
    assert.equal(r.ok && r.claims.email, "ana@acme.com");
  });

  test("a URN longa do ADFS é reconhecida", () => {
    /* Não há padrão de nome: o ADFS manda a URN do Schemas.Microsoft, o Okta
       manda `email`. Exigir um faria o produto falhar com o outro. */
    const r = ler(
      assercao({
        nameId: "ana",
        atributos:
          '<saml:AttributeStatement><saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress">' +
          "<saml:AttributeValue>ana@acme.com</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>",
      }),
    );

    assert.equal(r.ok && r.claims.email, "ana@acme.com");
  });

  test("o FriendlyName também vale", () => {
    const r = ler(
      assercao({
        nameId: "ana",
        atributos:
          '<saml:AttributeStatement><saml:Attribute Name="urn:oid:algo" FriendlyName="mail">' +
          "<saml:AttributeValue>ana@acme.com</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>",
      }),
    );

    assert.equal(r.ok && r.claims.email, "ana@acme.com");
  });

  test("sem e-mail em lugar nenhum, é recusa", () => {
    /* Sem e-mail não há como ligar a asserção a uma conta daqui. */
    const r = ler(assercao({ nameId: "S-1-5-21-abc" }));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /e-mail/i);
  });

  test("o e-mail volta normalizado", () => {
    const r = ler(assercao({ nameId: "  Ana@ACME.com  " }));
    assert.equal(r.ok && r.claims.email, "ana@acme.com");
  });
});
