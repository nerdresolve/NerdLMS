import { deflateRawSync } from "node:zlib";

import { buildAuthnRequest, readAssertionClaims } from "@nerdlms/core/saml/protocol.ts";
import { decideLink } from "@nerdlms/core/sso/linking.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import { createSession } from "../auth/sessions-repository.ts";
import { touchLastAccess } from "../auth/users-repository.ts";
import {
  createSsoUser,
  findAccountByEmail,
  findIdentity,
  linkIdentity,
  touchIdentityLogin,
} from "../sso/sso-repository.ts";
import {
  consumeSamlRequest,
  enabledSamlProvider,
  openSamlRequest,
} from "./saml-repository.ts";
import { verifyAssertion } from "./saml-verify.ts";

/**
 * Login por SAML 2.0.
 *
 * A sequência:
 *
 *   1. Guardamos o `ID` do pedido e mandamos a pessoa ao provedor, com o
 *      `AuthnRequest` comprimido na URL.
 *   2. Ela autentica lá.
 *   3. O provedor devolve, por POST, uma asserção assinada.
 *   4. Validamos a assinatura, conferimos as condições, e só então há login.
 *
 * O passo 4 é o que separa SAML de teatro — e é o único lugar do produto onde
 * a validação criptográfica decide, sozinha, se alguém é quem diz ser.
 */

export interface StartCommand {
  tenantId: string;
  redirectPath: string;
  /** Onde a asserção deve chegar. Vai dentro do pedido. */
  acsUrl: string;
  /** Agora, em ISO. Parâmetro para o teste ser determinístico. */
  instant: string;
}

export type StartOutcome =
  | { status: 200; redirectUrl: string }
  | { status: 400 | 404; error: string };

export async function startSamlLogin(command: StartCommand): Promise<StartOutcome> {
  const provedor = await enabledSamlProvider(command.tenantId);
  if (!provedor) return { status: 404, error: "Acesso por SAML não está configurado." };

  const pedido = await openSamlRequest(
    command.tenantId,
    provedor.id,
    seguroParaVoltar(command.redirectPath),
  );

  const xml = buildAuthnRequest({
    issuer: provedor.spEntityId,
    assertionConsumerServiceUrl: command.acsUrl,
    id: pedido.id,
    instant: command.instant,
  });

  /* HTTP-Redirect: o pedido vai DEFLATADO e em base64 na query string.
     `deflateRaw`, sem cabeçalho zlib — é o que o padrão define, e um provedor
     que receba o cabeçalho recusa o pedido inteiro. */
  const comprimido = deflateRawSync(Buffer.from(xml, "utf8")).toString("base64");

  const url = new URL(provedor.ssoUrl);
  url.searchParams.set("SAMLRequest", comprimido);

  return { status: 200, redirectUrl: url.toString() };
}

/**
 * Só caminho interno, nunca URL.
 *
 * Mesma regra do OIDC: guardar a URL inteira e redirecionar para ela abriria
 * um redirecionamento aberto, com a nossa credibilidade emprestada ao destino
 * de outra pessoa. `//outro.com` também é URL, e por isso a barra dupla cai
 * junto.
 */
function seguroParaVoltar(caminho: string): string {
  const limpo = caminho.trim();
  if (!limpo.startsWith("/")) return "/";
  if (limpo.startsWith("//")) return "/";
  return limpo;
}

export interface CallbackCommand {
  tenantId: string;
  /** O `SAMLResponse` do formulário, ainda em base64. */
  samlResponse: string;
  ip: string;
  userAgent: string | null;
  /** Agora, em milissegundos. */
  now: number;
}

export type CallbackOutcome =
  | { status: 200; token: string; expiresAt: Date; redirectPath: string; userId: string }
  | { status: 400 | 401 | 403; error: string };

export async function completeSamlLogin(
  command: CallbackCommand,
): Promise<CallbackOutcome> {
  const provedor = await enabledSamlProvider(command.tenantId);
  if (!provedor) return { status: 403, error: "Acesso por SAML não está configurado." };

  let xml: string;
  try {
    xml = Buffer.from(command.samlResponse, "base64").toString("utf8");
  } catch {
    return { status: 400, error: "A resposta do provedor não pôde ser lida." };
  }

  if (!xml.includes("<") ) {
    /* Base64 inválido produz lixo em vez de erro. Sem esta conferência, o
       lixo chegaria ao leitor de XML como um documento sem elementos, e o
       erro seria "não traz asserção" — que culpa o provedor. */
    return { status: 400, error: "A resposta do provedor não pôde ser lida." };
  }

  /* A ASSINATURA PRIMEIRO, sempre. Só depois de saber que o provedor assinou
     é que faz sentido ler o que está escrito. */
  const validada = verifyAssertion({ xml, certificados: provedor.certificates });

  if (!validada.ok) {
    await recordAudit({
      actorId: null,
      tenantId: command.tenantId,
      actorName: "saml",
      action: "sso_login_failed",
      target: validada.error,
      outcome: "denied",
      ip: command.ip,
    });

    return { status: 401, error: validada.error };
  }

  /* O `InResponseTo` é lido da asserção VALIDADA e conferido contra o pedido
     que guardamos. É o que impede alguém de entregar ao navegador de outra
     pessoa uma asserção legítima obtida em outro lugar. */
  const bruto = readAssertionClaims(validada.assertion, {
    expectedIssuer: provedor.idpEntityId,
    expectedAudience: provedor.spEntityId,
    /* `null`: a conferência de verdade acontece logo abaixo, contra o banco —
       o `consumeSamlRequest` só encontra o pedido se o ID for o nosso, e só
       uma vez. Conferir aqui exigiria carregar o pedido antes de saber qual
       ID procurar. */
    expectedInResponseTo: null,
    now: command.now,
  });

  if (!bruto.ok) return { status: 401, error: bruto.error };

  if (!bruto.claims.inResponseTo) {
    /* Asserção não solicitada (IdP-initiated). O padrão permite, e este
       produto não: sem um pedido nosso, não há como saber que a pessoa quis
       entrar AQUI, e uma asserção capturada valeria enquanto durasse. */
    return { status: 401, error: "Esta asserção não responde a um pedido desta plataforma." };
  }

  const pedido = await consumeSamlRequest(command.tenantId, bruto.claims.inResponseTo);
  if (!pedido) {
    return { status: 401, error: "Este login expirou ou já foi usado. Tente de novo." };
  }

  const email = bruto.claims.email;

  if (provedor.allowedDomains.length > 0) {
    const dominio = email.split("@")[1] ?? "";
    if (!provedor.allowedDomains.includes(dominio)) {
      return { status: 403, error: "Este e-mail não pertence a um domínio autorizado." };
    }
  }

  const decisao = decideLink({
    provider: "saml",
    /* O `NameID`, não o e-mail: é o identificador que o provedor promete
       estável, e e-mail muda de dono. */
    subject: bruto.claims.nameId,
    email,
    fullName: bruto.claims.fullName,
    linked: await findIdentity(command.tenantId, "saml", bruto.claims.nameId),
    byEmail: await findAccountByEmail(command.tenantId, email),
    allowJit: provedor.allowJit,
    jitRole: provedor.jitRole,
  });

  let userId: string;

  switch (decisao.kind) {
    case "login":
      await touchIdentityLogin(command.tenantId, "saml", bruto.claims.nameId);
      userId = decisao.userId;
      break;

    case "link-and-login":
      await linkIdentity(command.tenantId, decisao.userId, "saml", bruto.claims.nameId, email);
      await recordAudit({
        actorId: decisao.userId,
        actorName: email,
        action: "sso_identity_linked",
        target: "saml",
        outcome: "allowed",
        ip: command.ip,
      });
      userId = decisao.userId;
      break;

    case "create": {
      const novo = await createSsoUser(
        command.tenantId,
        decisao.email,
        decisao.fullName,
        decisao.role,
      );
      await linkIdentity(command.tenantId, novo, "saml", bruto.claims.nameId, email);
      await recordAudit({
        actorId: novo,
        actorName: email,
        action: "sso_identity_linked",
        target: "saml (conta criada pelo provedor)",
        outcome: "allowed",
        ip: command.ip,
      });
      userId = novo;
      break;
    }

    case "refuse":
      return { status: 403, error: decisao.reason };
  }

  const sessao = await createSession(userId, {
    remember: false,
    userAgent: command.userAgent,
    ip: command.ip,
  });
  await touchLastAccess(userId);

  await recordAudit({
    actorId: userId,
    actorName: email,
    action: "login",
    target: "saml",
    outcome: "allowed",
    ip: command.ip,
  });

  return {
    status: 200,
    token: sessao.token,
    expiresAt: sessao.expiresAt,
    redirectPath: pedido.redirectPath,
    userId,
  };
}
