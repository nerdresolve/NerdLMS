import { createHash, createVerify, X509Certificate } from "node:crypto";

import { findElement, findElements, guardXml, type XmlElement } from "@nerdlms/core/saml/xml.ts";
import {
  digestNodeAlgorithm,
  readSignature,
  referenciaCobre,
  signatureNodeAlgorithm,
} from "@nerdlms/core/saml/signature.ts";

import { canonicalize, namespacesAntesDe } from "./c14n.ts";

/**
 * A verificação criptográfica da asserção.
 *
 * Vive no backend porque depende de `node:crypto`; o que é regra pura — quais
 * algoritmos valem, o que a assinatura precisa cobrir — mora no core, testado
 * sem chave nenhuma.
 *
 * A FUNÇÃO DEVOLVE O TRECHO VALIDADO, não um booleano.
 *
 * É a defesa estrutural contra o XML Signature Wrapping: quem chama recebe a
 * asserção que foi assinada, e não tem como ler outra — porque outra não é
 * devolvida. Um `boolean` deixaria o chamador validar um elemento e ler o
 * vizinho, que é exatamente como o ataque funciona.
 */

export type VerifyResult =
  | { ok: true; assertion: XmlElement }
  | { ok: false; error: string };

export interface VerifyParams {
  /** O XML da resposta, já decodificado de base64. */
  xml: string;
  /** Os certificados que o cliente cadastrou, em PEM. */
  certificados: string[];
}

export function verifyAssertion(params: VerifyParams): VerifyResult {
  const guarda = guardXml(params.xml);
  if (!guarda.ok) return { ok: false, error: guarda.error };

  if (params.certificados.length === 0) {
    return { ok: false, error: "Nenhum certificado cadastrado para este provedor." };
  }

  const assercoes = findElements(params.xml, "Assertion");

  if (assercoes.length === 0) {
    return { ok: false, error: "A resposta não traz asserção." };
  }

  /* MAIS DE UMA ASSERÇÃO É RECUSA.

     Uma resposta de login tem uma. Duas são a forma clássica do wrapping: a
     verdadeira, assinada, e a forjada, com os dados do atacante. Escolher
     qualquer uma delas seria apostar em qual o atacante não controlava. */
  if (assercoes.length > 1) {
    return { ok: false, error: "A resposta traz mais de uma asserção." };
  }

  const assertion = assercoes[0]!;

  const assinatura = readSignature(assertion);
  if (!assinatura.ok) return { ok: false, error: assinatura.error };

  const cobre = referenciaCobre(assinatura.ref, assertion);
  if (!cobre.ok) return { ok: false, error: cobre.error };

  /* O DIGEST é calculado sobre a asserção SEM a assinatura — é o que o padrão
     manda (a transformação "enveloped signature"), e faz sentido: a assinatura
     não pode cobrir a si mesma. */
  const semAssinatura = removerAssinatura(assertion.outer);

  const herdados = namespacesAntesDe(params.xml, assertion.start);

  const canonica = canonicalize(semAssinatura, herdados);
  if (canonica === null) {
    return { ok: false, error: "A asserção não pôde ser normalizada." };
  }

  const algDigest = digestNodeAlgorithm(assinatura.ref.digestAlgorithm)!;
  const calculado = createHash(algDigest).update(canonica, "utf8").digest("base64");

  if (calculado !== assinatura.ref.digest) {
    /* O conteúdo foi alterado depois de assinado. É o caso mais direto de
       adulteração: alguém trocou o e-mail dentro da asserção. */
    return { ok: false, error: "O conteúdo da asserção não corresponde à assinatura." };
  }

  /* A ASSINATURA cobre o `SignedInfo`, não a asserção. É indireto de
     propósito: o `SignedInfo` carrega o digest, e assinar um bloco pequeno de
     tamanho fixo é o que torna a operação barata. */
  const signedInfoCanon = canonicalize(
    assinatura.ref.signedInfo,
    namespacesAntesDe(params.xml, assertion.start),
  );
  if (signedInfoCanon === null) {
    return { ok: false, error: "O bloco assinado não pôde ser normalizado." };
  }

  const algAssinatura = signatureNodeAlgorithm(assinatura.ref.signatureAlgorithm)!;
  const bytes = Buffer.from(assinatura.ref.signatureValue, "base64");

  const confere = params.certificados.some((pem) =>
    verificaCom(pem, algAssinatura, signedInfoCanon, bytes),
  );

  if (!confere) {
    return {
      ok: false,
      error: "A assinatura não confere com o certificado cadastrado para o provedor.",
    };
  }

  return { ok: true, assertion };
}

/**
 * Tira o `Signature` do trecho, para calcular o digest.
 *
 * É a transformação "enveloped signature" do padrão, e a razão é circular por
 * natureza: a assinatura está DENTRO do que ela assina, e não pode cobrir a si
 * mesma. Remove-se, calcula-se o hash do resto.
 *
 * Remove apenas o `Signature` de primeiro nível: um `Signature` aninhado mais
 * fundo pertence a outro elemento e faz parte do conteúdo assinado.
 */
function removerAssinatura(outer: string): string {
  const assinatura = findElement(outer, "Signature");
  if (!assinatura) return outer;

  return outer.slice(0, assinatura.start) + outer.slice(assinatura.start + assinatura.outer.length);
}

/**
 * A assinatura confere com este certificado?
 *
 * O certificado vem do CADASTRO do cliente, nunca do documento. O `Signature`
 * traz um `X509Certificate` embutido, e usá-lo seria deixar quem assina
 * escolher a própria chave — a assinatura conferiria sempre, e a validação não
 * provaria nada.
 */
function verificaCom(
  pem: string,
  algoritmo: string,
  conteudo: string,
  assinatura: Buffer,
): boolean {
  try {
    const certificado = new X509Certificate(normalizarPem(pem));

    /* Certificado vencido não autentica ninguém. É o erro mais comum numa
       implantação que já rodava: o provedor rotacionou e ninguém avisou. */
    const agora = new Date();
    if (new Date(certificado.validTo) < agora) return false;
    if (new Date(certificado.validFrom) > agora) return false;

    /* `certificado.publicKey` JÁ É um KeyObject. Passá-lo por
       `createPublicKey` levanta ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE, que o
       `catch` abaixo engoliria como "não confere" — a assinatura correta
       seria recusada em silêncio, e o erro apontaria para o certificado do
       cliente em vez do código. */
    const publica = certificado.publicKey;

    const verificador = createVerify(algoritmo);
    verificador.update(conteudo, "utf8");
    verificador.end();

    return verificador.verify(publica, assinatura);
  } catch {
    /* Certificado malformado, algoritmo incompatível, base64 inválido: tudo
       isso é "não confere", não exceção. Deixar vazar transformaria um
       certificado mal colado num erro 500. */
    return false;
  }
}

/**
 * Aceita o certificado com ou sem as linhas de cabeçalho.
 *
 * O `X509Certificate` do Node exige o PEM completo, e o SAML transporta só o
 * base64 do meio. Quem cola da tela do provedor traz um dos dois formatos, e
 * recusar um deles seria um erro de configuração disfarçado de erro de
 * assinatura.
 */
function normalizarPem(valor: string): string {
  const limpo = valor.trim();
  if (limpo.includes("BEGIN CERTIFICATE")) return limpo;

  const base64 = limpo.replace(/\s+/g, "");
  const linhas = base64.match(/.{1,64}/g) ?? [];

  return `-----BEGIN CERTIFICATE-----\n${linhas.join("\n")}\n-----END CERTIFICATE-----`;
}
