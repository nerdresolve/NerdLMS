/**
 * O fluxo SAML 2.0, na parte que não depende de criptografia.
 *
 * Montar o pedido, ler o que volta, conferir as condições da asserção. A
 * validação da assinatura mora no backend, porque precisa de `node:crypto`.
 *
 * O PERFIL É "HTTP-Redirect para ir, HTTP-POST para voltar" — que é o que
 * Okta, ADFS, Azure e Google usam por padrão. O pedido vai comprimido na URL;
 * a resposta volta num formulário auto-submetido, porque uma asserção assinada
 * não cabe numa query string.
 */

export interface AuthnRequestParams {
  /** Nós, como identificador — o `entityId` que o cliente cadastra no provedor. */
  issuer: string;
  /** Onde a resposta deve chegar. */
  assertionConsumerServiceUrl: string;
  /** Identificador do pedido. Volta em `InResponseTo` e é conferido. */
  id: string;
  instant: string;
}

/**
 * O `AuthnRequest`, em XML.
 *
 * Não é assinado. O perfil permite, e a maioria dos provedores não exige — o
 * que protege o fluxo é o `InResponseTo` conferido na volta, não a assinatura
 * da ida. Assinar exigiria um par de chaves nosso por cliente, e o ganho não
 * paga: um pedido forjado só levaria a pessoa a autenticar no provedor dela.
 */
export function buildAuthnRequest(params: AuthnRequestParams): string {
  return (
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${params.id}" Version="2.0" IssueInstant="${params.instant}" ` +
    `ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" ` +
    `AssertionConsumerServiceURL="${escapeAttr(params.assertionConsumerServiceUrl)}">` +
    `<saml:Issuer>${escapeText(params.issuer)}</saml:Issuer>` +
    `</samlp:AuthnRequest>`
  );
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

import { attr, findElement, findElements, text, type XmlElement } from "./xml.ts";

export interface AssertionClaims {
  /** Quem a asserção identifica. */
  nameId: string;
  /** O provedor que a emitiu. */
  issuer: string;
  email: string;
  fullName: string | null;
  /** O pedido que ela responde, quando declarado. */
  inResponseTo: string | null;
}

export interface ConditionsContext {
  /** O `entityId` do provedor, como o cliente cadastrou. */
  expectedIssuer: string;
  /** Nosso identificador — a asserção precisa ser destinada a nós. */
  expectedAudience: string;
  /**
   * O `ID` do pedido que iniciamos.
   *
   * `null` diz "não confira aqui" — usado por quem só quer LER o
   * `InResponseTo` para depois buscá-lo no banco. Passar string vazia para
   * isso comparava com vazio e recusava toda asserção legítima, que foi o que
   * o teste de ponta a ponta encontrou.
   */
  expectedInResponseTo: string | null;
  /** Agora, em milissegundos. Parâmetro para o teste ser determinístico. */
  now: number;
}

export type ClaimsResult =
  | { ok: true; claims: AssertionClaims }
  | { ok: false; error: string };

/**
 * Tolerância de relógio, em milissegundos.
 *
 * Sessenta segundos, a mesma do OIDC e do LTI. Servidores discordam, e sem
 * folga uma asserção emitida no mesmo segundo seria recusada por chegar
 * "antes" de existir.
 */
const TOLERANCIA_MS = 60_000;

/**
 * Confere as condições da asserção e extrai quem ela identifica.
 *
 * A ASSINATURA JÁ FOI VALIDADA quando esta função é chamada — ela recebe o
 * trecho que `verifyAssertion` devolveu. Conferir as condições antes de saber
 * que o documento é autêntico seria conferir um texto que qualquer um escreve.
 */
export function readAssertionClaims(
  assertion: XmlElement,
  ctx: ConditionsContext,
): ClaimsResult {
  const issuer = text(findElement(assertion.outer, "Issuer"));
  if (issuer !== ctx.expectedIssuer) {
    return { ok: false, error: "A asserção veio de outro provedor." };
  }

  /* A JANELA DE VALIDADE. Sem ela, uma asserção capturada hoje entraria
     amanhã: a assinatura continua válida para sempre, e é justamente por isso
     que o padrão define o prazo dentro do documento assinado. */
  const condicoes = findElement(assertion.outer, "Conditions");

  if (condicoes) {
    const notBefore = attr(condicoes, "NotBefore");
    const notOnOrAfter = attr(condicoes, "NotOnOrAfter");

    if (notBefore) {
      const inicio = Date.parse(notBefore);
      if (Number.isNaN(inicio)) return { ok: false, error: "A asserção tem data inválida." };
      if (ctx.now + TOLERANCIA_MS < inicio) {
        return { ok: false, error: "A asserção ainda não é válida." };
      }
    }

    if (notOnOrAfter) {
      const fim = Date.parse(notOnOrAfter);
      if (Number.isNaN(fim)) return { ok: false, error: "A asserção tem data inválida." };
      if (ctx.now - TOLERANCIA_MS >= fim) {
        return { ok: false, error: "A asserção expirou." };
      }
    }
  }

  /* A ASSERÇÃO PRECISA SER DESTINADA A NÓS.

     Sem esta conferência, uma asserção que o mesmo provedor emitiu para OUTRO
     sistema entraria aqui — assinatura válida, emissor certo, pessoa certa, e
     destino errado. É o equivalente ao `aud` do OIDC. */
  const audiencias = findElements(assertion.outer, "Audience").map((a) => text(a));

  if (audiencias.length > 0 && !audiencias.includes(ctx.expectedAudience)) {
    return { ok: false, error: "A asserção foi emitida para outro sistema." };
  }

  /* `InResponseTo` liga a resposta ao pedido que iniciamos. É o que impede
     alguém de entregar ao navegador de outra pessoa uma asserção legítima
     obtida em outro lugar. */
  const confirmacao = findElement(assertion.outer, "SubjectConfirmationData");
  const inResponseTo = confirmacao ? attr(confirmacao, "InResponseTo") : null;

  if (
    ctx.expectedInResponseTo !== null &&
    inResponseTo &&
    inResponseTo !== ctx.expectedInResponseTo
  ) {
    return { ok: false, error: "A asserção responde a outro pedido." };
  }

  const nameId = text(findElement(assertion.outer, "NameID"));
  if (!nameId) return { ok: false, error: "A asserção não identifica ninguém." };

  const atributos = lerAtributos(assertion);

  /* O e-mail vem do atributo quando o provedor o envia; do `NameID` quando
     ele já é um e-mail. Provedor que não manda nenhum dos dois não permite
     identificar a pessoa aqui dentro. */
  const email = (atributos.email ?? (nameId.includes("@") ? nameId : "")).trim().toLowerCase();

  if (!email) {
    return { ok: false, error: "A asserção não traz o e-mail da pessoa." };
  }

  return {
    ok: true,
    claims: {
      nameId,
      issuer,
      email,
      fullName: atributos.nome ?? null,
      inResponseTo: inResponseTo ?? null,
    },
  };
}

/**
 * Os nomes que cada provedor usa para "e-mail" e "nome".
 *
 * Não há padrão: o ADFS manda a URN longa do Schemas.Microsoft, o Okta manda
 * `email`, o Azure manda ambos conforme a configuração, e o Google manda
 * `mail`. Exigir um nome específico faria o produto funcionar com um provedor
 * e falhar com outro — e a falha apareceria como "não traz o e-mail", que
 * culpa o provedor por uma limitação nossa.
 *
 * A lista é comparada em minúsculas, e o nome curto vale tanto quanto a URN
 * inteira.
 */
const NOMES_DE_EMAIL = [
  "email",
  "mail",
  "emailaddress",
  "urn:oid:0.9.2342.19200300.100.1.3",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "http://schemas.xmlsoap.org/claims/emailaddress",
];

const NOMES_DE_NOME = [
  "displayname",
  "name",
  "cn",
  "urn:oid:2.5.4.3",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  "http://schemas.microsoft.com/identity/claims/displayname",
];

function lerAtributos(assertion: XmlElement): { email?: string; nome?: string } {
  const saida: { email?: string; nome?: string } = {};

  for (const atributo of findElements(assertion.outer, "Attribute")) {
    /* `Name` é o nome de verdade; `FriendlyName` é o apelido legível, que
       alguns provedores usam sozinho. Conferir os dois cobre os dois casos. */
    const nome = (attr(atributo, "Name") ?? "").toLowerCase();
    const amigavel = (attr(atributo, "FriendlyName") ?? "").toLowerCase();

    const valor = text(findElement(atributo.outer, "AttributeValue"));
    if (!valor) continue;

    if (!saida.email && (NOMES_DE_EMAIL.includes(nome) || NOMES_DE_EMAIL.includes(amigavel))) {
      saida.email = valor;
    }

    if (!saida.nome && (NOMES_DE_NOME.includes(nome) || NOMES_DE_NOME.includes(amigavel))) {
      saida.nome = valor;
    }
  }

  return saida;
}
