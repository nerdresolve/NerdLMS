/**
 * Validação da assinatura de uma asserção SAML.
 *
 * É a parte que decide tudo. Uma asserção não validada é um texto XML que
 * qualquer um escreve — inclusive dizendo que é o administrador da plataforma.
 *
 * O QUE SE VALIDA, E POR QUE CADA COISA
 *
 *   O DIGEST — o hash do elemento assinado bate com o declarado? Sem isso,
 *   alguém troca o e-mail dentro da asserção e a assinatura continua a mesma.
 *
 *   A ASSINATURA — o `SignedInfo` foi assinado pela chave do provedor? Sem
 *   isso, alguém recalcula o digest depois de alterar e nada acusa.
 *
 *   O QUE FOI ASSINADO — a `Reference` aponta para o elemento que estamos
 *   lendo? Esta é a que as bibliotecas famosas erraram, e o ataque tem nome:
 *   XML Signature Wrapping. O documento traz DUAS asserções — uma assinada e
 *   verdadeira, outra forjada — e o validador confere a primeira enquanto o
 *   resto do código lê a segunda.
 *
 * A defesa contra o wrapping está em `assertionValidada`: quem chama recebe o
 * TRECHO que foi assinado, não um "sim". Assim é impossível validar um
 * elemento e ler outro — não há outro para ler.
 */

import { findElement, findElements, attr, text, type XmlElement } from "./xml.ts";

export interface SignedRef {
  /** O `ID` que a assinatura declara ter assinado. */
  uri: string;
  /** O hash declarado, em base64. */
  digest: string;
  /** O algoritmo do digest, como IRI. */
  digestAlgorithm: string;
  /** Os bytes exatos de `SignedInfo` — é o que a assinatura cobre. */
  signedInfo: string;
  /** A assinatura, em base64. */
  signatureValue: string;
  signatureAlgorithm: string;
  /** O certificado embutido, quando há. */
  certificate: string | null;
}

export type SignatureRead =
  | { ok: true; ref: SignedRef }
  | { ok: false; error: string };

/** Os algoritmos aceitos, por IRI. */
const DIGEST_OK: Record<string, string> = {
  "http://www.w3.org/2001/04/xmlenc#sha256": "sha256",
  "http://www.w3.org/2001/04/xmldsig-more#sha384": "sha384",
  "http://www.w3.org/2001/04/xmlenc#sha512": "sha512",
};

const SIGNATURE_OK: Record<string, string> = {
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256": "RSA-SHA256",
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384": "RSA-SHA384",
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512": "RSA-SHA512",
};

/**
 * SHA-1 NÃO ESTÁ NAS LISTAS, e a ausência é decisão.
 *
 * Colisão de SHA-1 é demonstrada desde 2017: é possível forjar um documento
 * com o mesmo digest de outro. Provedores antigos ainda o oferecem por padrão,
 * e aceitá-lo "por compatibilidade" tornaria a validação decorativa. Quem
 * encontrar um provedor assim precisa trocar a configuração dele, e a
 * mensagem de erro diz isso.
 */
const SHA1_DIGEST = "http://www.w3.org/2000/09/xmldsig#sha1";
const SHA1_SIGNATURE = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

export function digestNodeAlgorithm(iri: string): string | null {
  return DIGEST_OK[iri] ?? null;
}

export function signatureNodeAlgorithm(iri: string): string | null {
  return SIGNATURE_OK[iri] ?? null;
}

/**
 * Lê a assinatura de um elemento.
 *
 * O `Signature` tem de ser FILHO DIRETO do elemento que ele assina. Aceitar
 * uma assinatura de qualquer lugar do documento é metade do XML Signature
 * Wrapping: o atacante põe a assinatura verdadeira dentro da asserção forjada
 * e o validador a encontra.
 */
export function readSignature(elemento: XmlElement): SignatureRead {
  const assinaturas = findElements(elemento.outer, "Signature");
  if (assinaturas.length === 0) {
    return { ok: false, error: "A asserção não está assinada." };
  }

  /* MAIS DE UMA ASSINATURA É RECUSA, não escolha.

     Um documento legítimo tem uma. Duas significam que alguém acrescentou a
     sua — e qualquer regra de escolha (a primeira, a última, a de fora) seria
     uma aposta sobre qual o atacante controlava. */
  if (assinaturas.length > 1) {
    return { ok: false, error: "A asserção tem mais de uma assinatura." };
  }

  const assinatura = assinaturas[0]!;

  const signedInfo = findElement(assinatura.outer, "SignedInfo");
  if (!signedInfo) return { ok: false, error: "Assinatura sem SignedInfo." };

  const referencias = findElements(signedInfo.outer, "Reference");
  if (referencias.length !== 1) {
    /* Zero é assinatura vazia; mais de uma é o wrapping — o atacante
       acrescenta uma referência ao próprio conteúdo ao lado da legítima. */
    return { ok: false, error: "A assinatura precisa cobrir exatamente um elemento." };
  }

  const referencia = referencias[0]!;
  const uri = attr(referencia, "URI") ?? "";

  const digestMethod = findElement(referencia.outer, "DigestMethod");
  const digestAlg = attr(digestMethod?.outer ?? "", "Algorithm") ?? "";

  if (digestAlg === SHA1_DIGEST) {
    return {
      ok: false,
      error: "O provedor assinou com SHA-1, que não é mais seguro. Configure SHA-256 nele.",
    };
  }

  if (!digestNodeAlgorithm(digestAlg)) {
    return { ok: false, error: "Algoritmo de digest não suportado." };
  }

  const signatureMethod = findElement(signedInfo.outer, "SignatureMethod");
  const signatureAlg = attr(signatureMethod?.outer ?? "", "Algorithm") ?? "";

  if (signatureAlg === SHA1_SIGNATURE) {
    return {
      ok: false,
      error: "O provedor assinou com RSA-SHA1, que não é mais seguro. Configure SHA-256 nele.",
    };
  }

  if (!signatureNodeAlgorithm(signatureAlg)) {
    return { ok: false, error: "Algoritmo de assinatura não suportado." };
  }

  const digest = text(findElement(referencia.outer, "DigestValue"));
  const valor = text(findElement(assinatura.outer, "SignatureValue"));

  if (!digest || !valor) {
    return { ok: false, error: "Assinatura incompleta." };
  }

  const certificado = text(findElement(assinatura.outer, "X509Certificate"));

  return {
    ok: true,
    ref: {
      uri,
      digest,
      digestAlgorithm: digestAlg,
      signedInfo: signedInfo.outer,
      signatureValue: valor,
      signatureAlgorithm: signatureAlg,
      certificate: certificado || null,
    },
  };
}

export type ReferenceCheck = { ok: true } | { ok: false; error: string };

/**
 * A assinatura cobre ESTE elemento?
 *
 * A `URI` da referência é `#ID`, e o `ID` tem de ser o do elemento que vamos
 * ler. É a conferência que fecha o XML Signature Wrapping: sem ela, o
 * documento traz a asserção verdadeira (assinada, com o e-mail de quem
 * assinou) e a forjada (com o e-mail do atacante), e o validador aprova a
 * primeira enquanto o resto do código lê a segunda.
 *
 * `URI` vazia significa "o documento inteiro" — recusada, porque então não há
 * como saber qual asserção foi coberta.
 */
export function referenciaCobre(ref: SignedRef, elemento: XmlElement): ReferenceCheck {
  if (!ref.uri) {
    return { ok: false, error: "A assinatura não diz o que cobre." };
  }

  if (!ref.uri.startsWith("#")) {
    /* Referência externa: apontaria para outro documento, que nem chegamos a
       ter. É recusa e não busca. */
    return { ok: false, error: "A assinatura aponta para fora do documento." };
  }

  const id = attr(elemento, "ID");
  if (!id) return { ok: false, error: "O elemento assinado não tem ID." };

  if (ref.uri.slice(1) !== id) {
    return { ok: false, error: "A assinatura cobre outro elemento do documento." };
  }

  return { ok: true };
}
