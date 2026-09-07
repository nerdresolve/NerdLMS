import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { findElement } from "./xml.ts";
import { readSignature, referenciaCobre } from "./signature.ts";

const SHA256_D = "http://www.w3.org/2001/04/xmlenc#sha256";
const SHA256_S = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

/** Uma asserção assinada, no formato que os provedores emitem. */
function asserçao(over: {
  id?: string;
  uri?: string;
  digestAlg?: string;
  sigAlg?: string;
  assinaturas?: number;
  referencias?: number;
} = {}): string {
  const id = over.id ?? "A1";
  const uri = over.uri ?? "#A1";
  const dAlg = over.digestAlg ?? SHA256_D;
  const sAlg = over.sigAlg ?? SHA256_S;

  const referencia = `<ds:Reference URI="${uri}">
        <ds:DigestMethod Algorithm="${dAlg}"/>
        <ds:DigestValue>ZGlnZXN0</ds:DigestValue>
      </ds:Reference>`;

  const assinatura = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo>
        <ds:SignatureMethod Algorithm="${sAlg}"/>
        ${referencia.repeat(over.referencias ?? 1)}
      </ds:SignedInfo>
      <ds:SignatureValue>c2lnbmF0dXJl</ds:SignatureValue>
      <ds:KeyInfo><ds:X509Data><ds:X509Certificate>Y2VydA==</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
    </ds:Signature>`;

  return `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}">
    ${assinatura.repeat(over.assinaturas ?? 1)}
    <saml:Subject><saml:NameID>ana@acme.com</saml:NameID></saml:Subject>
  </saml:Assertion>`;
}

describe("SAML — leitura da assinatura", () => {
  test("assinatura bem formada é lida", () => {
    const r = readSignature(findElement(asserçao(), "Assertion")!);

    assert.equal(r.ok, true);
    assert.equal(r.ok && r.ref.uri, "#A1");
    assert.equal(r.ok && r.ref.digest, "ZGlnZXN0");
    assert.ok(r.ok && r.ref.signedInfo.includes("SignedInfo"));
  });

  test("asserção sem assinatura é recusada", () => {
    const sem = '<saml:Assertion ID="A1"><saml:Subject>x</saml:Subject></saml:Assertion>';
    const r = readSignature(findElement(sem, "Assertion")!);

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /não está assinada/i);
  });

  test("DUAS assinaturas é recusa, não escolha", () => {
    /* Documento legítimo tem uma. Duas significam que alguém acrescentou a
       sua — e qualquer regra de escolha seria uma aposta sobre qual delas o
       atacante controlava. */
    const r = readSignature(findElement(asserçao({ assinaturas: 2 }), "Assertion")!);

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /mais de uma assinatura/i);
  });

  test("mais de uma Reference é recusada", () => {
    /* O atacante acrescenta uma referência ao próprio conteúdo ao lado da
       legítima, e o validador confere a que ele escolher. */
    const r = readSignature(findElement(asserçao({ referencias: 2 }), "Assertion")!);

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /exatamente um elemento/i);
  });
});

describe("SAML — SHA-1 é recusado por nome", () => {
  test("digest SHA-1 não passa", () => {
    /* Colisão de SHA-1 é demonstrada desde 2017. Aceitá-lo "por
       compatibilidade" tornaria a validação decorativa. */
    const r = readSignature(
      findElement(asserçao({ digestAlg: "http://www.w3.org/2000/09/xmldsig#sha1" }), "Assertion")!,
    );

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /SHA-1/);
  });

  test("assinatura RSA-SHA1 não passa", () => {
    const r = readSignature(
      findElement(
        asserçao({ sigAlg: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }),
        "Assertion",
      )!,
    );

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /SHA1|SHA-1/);
  });

  test("a mensagem diz o que configurar no provedor", () => {
    /* "Algoritmo não suportado" mandaria quem implanta abrir um chamado. */
    const r = readSignature(
      findElement(asserçao({ digestAlg: "http://www.w3.org/2000/09/xmldsig#sha1" }), "Assertion")!,
    );

    assert.match(r.ok === false ? r.error : "", /SHA-256/);
  });

  test("algoritmo desconhecido é recusado", () => {
    const r = readSignature(
      findElement(asserçao({ digestAlg: "http://exemplo.com/md5" }), "Assertion")!,
    );

    assert.equal(r.ok, false);
  });
});

describe("SAML — XML Signature Wrapping", () => {
  test("a assinatura tem de cobrir a asserção que vamos LER", () => {
    /* O ataque: o documento traz a asserção verdadeira (assinada, com o
       e-mail de quem assinou) e a forjada (com o e-mail do atacante). O
       validador aprova a primeira; o resto do código lê a segunda. */
    const doc = asserçao({ id: "A1", uri: "#OUTRA" });
    const elemento = findElement(doc, "Assertion")!;
    const assinatura = readSignature(elemento);

    assert.equal(assinatura.ok, true);

    const cobre = referenciaCobre(assinatura.ok ? assinatura.ref : ({} as never), elemento);
    assert.equal(cobre.ok, false);
    assert.match(cobre.ok === false ? cobre.error : "", /outro elemento/i);
  });

  test("a referência correta passa", () => {
    const elemento = findElement(asserçao(), "Assertion")!;
    const assinatura = readSignature(elemento);

    assert.equal(referenciaCobre(assinatura.ok ? assinatura.ref : ({} as never), elemento).ok, true);
  });

  test("URI vazia — o documento inteiro — é recusada", () => {
    /* Sem saber qual elemento foi coberto, não dá para garantir que é o que
       estamos lendo. */
    const elemento = findElement(asserçao({ uri: "" }), "Assertion")!;
    const assinatura = readSignature(elemento);

    const cobre = referenciaCobre(assinatura.ok ? assinatura.ref : ({} as never), elemento);
    assert.equal(cobre.ok, false);
  });

  test("referência para fora do documento é recusada", () => {
    const elemento = findElement(asserçao({ uri: "https://outro.com/doc" }), "Assertion")!;
    const assinatura = readSignature(elemento);

    const cobre = referenciaCobre(assinatura.ok ? assinatura.ref : ({} as never), elemento);
    assert.equal(cobre.ok, false);
    assert.match(cobre.ok === false ? cobre.error : "", /fora do documento/i);
  });
});
