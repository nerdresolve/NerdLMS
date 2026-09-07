import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findElement, text } from "@nerdlms/core/saml/xml.ts";

import { canonicalize } from "./c14n.ts";
import { verifyAssertion } from "./saml-verify.ts";

/**
 * Os testes ASSINAM DE VERDADE, com chave RSA e certificado X.509 gerados na
 * hora.
 *
 * Sem asserção fixa no repositório: um XML colado envelheceria junto com o
 * certificado dentro dele, e um teste que falha por data vencida ensina a
 * equipe a ignorar o teste.
 *
 * O certificado sai do OpenSSL porque o Node gera chaves e não certificados.
 * Onde ele não existir, os testes são pulados em vez de falharem — o que
 * validam é a criptografia, e sem certificado não há o que validar.
 */

interface Par {
  chave: string;
  certificado: string;
}

let idp: Par | null = null;
let outro: Par | null = null;
let dir = "";

function gerarPar(nome: string): Par | null {
  const chaveArq = join(dir, nome + "-key.pem");
  const certArq = join(dir, nome + "-cert.pem");

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  writeFileSync(chaveArq, privateKey);

  try {
    execFileSync("openssl", [
      "req", "-x509", "-new", "-key", chaveArq,
      "-out", certArq, "-days", "365", "-subj", "/CN=" + nome, "-sha256",
    ], { stdio: "ignore" });
  } catch {
    return null;
  }

  return { chave: privateKey, certificado: readFileSync(certArq, "utf8") };
}

before(() => {
  dir = mkdtempSync(join(tmpdir(), "saml-"));
  idp = gerarPar("idp");
  outro = gerarPar("outro");
});

/** Monta e assina uma resposta, como um provedor de identidade faz. */
function respostaAssinada(email = "ana@acme.com"): string {
  const assercao =
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a1" Version="2.0"><saml:Issuer>https://idp.acme.com</saml:Issuer><saml:Subject><saml:NameID>${email}</saml:NameID></saml:Subject></saml:Assertion>`;

  const digest = createHash("sha256").update(canonicalize(assercao)!, "utf8").digest("base64");

  const signedInfo =
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#_a1"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${digest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

  const assinador = createSign("RSA-SHA256");
  assinador.update(canonicalize(signedInfo)!, "utf8");
  assinador.end();

  const valor = assinador.sign(idp!.chave, "base64");

  const bloco =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<ds:SignatureValue>${valor}</ds:SignatureValue></ds:Signature>`;

  const assinada = assercao.replace("</saml:Issuer>", "</saml:Issuer>" + bloco);

  return `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r1">${assinada}</samlp:Response>`;
}

/** Sem OpenSSL não há certificado, e sem certificado não há o que validar. */
function temChaves(): boolean {
  return idp !== null && outro !== null;
}

describe("SAML, asserção legítima", () => {
  test("uma asserção assinada pelo provedor é validada", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    const r = verifyAssertion({
      xml: respostaAssinada(),
      certificados: [idp!.certificado],
    });

    assert.equal(r.ok, true, r.ok ? "" : r.error);
    assert.equal(text(findElement(r.ok ? r.assertion.outer : "", "NameID")), "ana@acme.com");
  });

  test("dois certificados cadastrados: a rotação de chave não derruba o login", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    /* Durante a rotação, o provedor assina com a nova e o cliente ainda tem a
       velha cadastrada — ou o contrário. Aceitar qualquer uma das cadastradas
       é o que evita uma janela de indisponibilidade. */
    const r = verifyAssertion({
      xml: respostaAssinada(),
      certificados: [outro!.certificado, idp!.certificado],
    });

    assert.equal(r.ok, true);
  });

  test("a função devolve o TRECHO validado, não um booleano", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    /* É a defesa estrutural contra o wrapping: quem chama recebe a asserção
       que foi assinada e não tem como ler outra, porque outra não é
       devolvida. */
    const r = verifyAssertion({ xml: respostaAssinada(), certificados: [idp!.certificado] });

    assert.equal(r.ok, true);
    assert.ok(r.ok && r.assertion.outer.includes("_a1"));
  });
});

describe("SAML, os ataques", () => {
  test("adulterar o e-mail depois de assinado é barrado", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    const adulterada = respostaAssinada().replace("ana@acme.com", "atacante@evil.com");
    const r = verifyAssertion({ xml: adulterada, certificados: [idp!.certificado] });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /não corresponde à assinatura/i);
  });

  test("XML Signature Wrapping: duas asserções é recusa", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    /* O ataque clássico: a verdadeira assinada, e uma forjada com os dados do
       atacante. Escolher qualquer uma seria apostar em qual delas ele não
       controlava. */
    const forjada =
      '<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_x">' +
      "<saml:Subject><saml:NameID>atacante@evil.com</saml:NameID></saml:Subject></saml:Assertion>";

    const r = verifyAssertion({
      xml: respostaAssinada().replace("</samlp:Response>", `${forjada}</samlp:Response>`),
      certificados: [idp!.certificado],
    });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /mais de uma asserção/i);
  });

  test("assinatura de outro provedor é barrada", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    const r = verifyAssertion({
      xml: respostaAssinada(),
      certificados: [outro!.certificado],
    });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /não confere com o certificado/i);
  });

  test("sem certificado cadastrado, nada passa", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    /* Uma lista vazia não pode significar "aceite qualquer coisa". */
    const r = verifyAssertion({ xml: respostaAssinada(), certificados: [] });

    assert.equal(r.ok, false);
  });

  test("XXE: DOCTYPE com entidade externa é recusado antes de tudo", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    const r = verifyAssertion({
      xml: `<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>${respostaAssinada()}`,
      certificados: [idp!.certificado],
    });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /DOCTYPE/i);
  });

  test("resposta sem asserção nenhuma é recusada", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    const r = verifyAssertion({
      xml: '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r"/>',
      certificados: [idp!.certificado],
    });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /não traz asserção/i);
  });

  test("asserção sem assinatura é recusada", (t) => {
    if (!temChaves()) return t.skip("openssl não disponível");

    const r = verifyAssertion({
      xml:
        '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">' +
        '<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a">' +
        "<saml:Subject><saml:NameID>x@y.com</saml:NameID></saml:Subject></saml:Assertion>" +
        "</samlp:Response>",
      certificados: [idp!.certificado],
    });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /não está assinada/i);
  });
});
