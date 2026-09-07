import { buildAuthorizationUrl, decodeIdTokenUnverified, parseCallback, validateIdTokenClaims } from "@nerdlms/core/sso/oidc.ts";
import { providerPreset } from "@nerdlms/core/sso/providers.ts";
import { decideLink } from "@nerdlms/core/sso/linking.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import { createSession } from "../auth/sessions-repository.ts";
import { touchLastAccess } from "../auth/users-repository.ts";
import { exchangeCode, verifyIdTokenSignature } from "./oidc-client.ts";
import {
  consumeLoginState,
  createSsoUser,
  findAccountByEmail,
  findIdentity,
  linkIdentity,
  openLoginState,
  providerById,
  touchIdentityLogin,
} from "./sso-repository.ts";

/**
 * O login por SSO, de ponta a ponta.
 *
 * Espelha `auth/login-use-case.ts` de propósito: recebe dados simples, devolve
 * dados simples, e termina emitindo a MESMA sessão do login por senha. Quem
 * entrou pelo Google e quem digitou a senha têm daí em diante exatamente o
 * mesmo cookie, a mesma expiração e a mesma auditoria — o resto da plataforma
 * não precisa saber por onde a pessoa entrou.
 */

export interface StartCommand {
  tenantId: string;
  providerId: string;
  /** Caminho interno para onde voltar. */
  redirectPath: string;
  /** A URL de retorno registrada no provedor. */
  redirectUri: string;
  loginHint?: string | null;
}

export type StartOutcome =
  | { status: 200; authorizationUrl: string }
  | { status: 400 | 404; error: string };

export async function startSsoLogin(command: StartCommand): Promise<StartOutcome> {
  const config = await providerById(command.tenantId, command.providerId);
  if (!config || !config.enabled) {
    return { status: 404, error: "Provedor de acesso não encontrado." };
  }

  if (!config.authorizationUrl) {
    /* Acontece com a Microsoft sem o diretório preenchido. Falhar aqui, com
       mensagem clara, é melhor que mandar a pessoa para um endereço com
       `{tenant}` literal e receber um erro do provedor que não explica nada. */
    return { status: 400, error: "O provedor está configurado pela metade." };
  }

  const state = await openLoginState(
    command.tenantId,
    config.id,
    seguroParaVoltar(command.redirectPath),
  );

  const preset = providerPreset(config.provider);

  return {
    status: 200,
    authorizationUrl: buildAuthorizationUrl({
      authorizationUrl: config.authorizationUrl,
      clientId: config.clientId,
      redirectUri: command.redirectUri,
      scopes: preset?.scopes ?? ["openid", "email", "profile"],
      state: state.state,
      nonce: state.nonce,
      loginHint: command.loginHint ?? null,
    }),
  };
}

/**
 * Só caminho interno, nunca URL.
 *
 * Guardar a URL inteira e redirecionar para ela abriria um redirecionamento
 * aberto: um link do nosso domínio levaria a pessoa a outro site, com a nossa
 * credibilidade emprestada. `//outro.com` também é URL, e por isso a barra
 * dupla é recusada junto.
 */
function seguroParaVoltar(caminho: string): string {
  const limpo = caminho.trim();
  if (!limpo.startsWith("/")) return "/";
  if (limpo.startsWith("//")) return "/";
  return limpo;
}

export interface CallbackCommand {
  tenantId: string;
  params: URLSearchParams;
  redirectUri: string;
  ip: string;
  userAgent: string | null;
}

export type CallbackOutcome =
  | { status: 200; token: string; expiresAt: Date; redirectPath: string; userId: string }
  | { status: 400 | 401 | 403; error: string };

export async function completeSsoLogin(command: CallbackCommand): Promise<CallbackOutcome> {
  const retorno = parseCallback(command.params);
  if (!retorno.ok) return { status: 400, error: retorno.error };

  /* Gasta o `state` antes de qualquer outra coisa. Uma vez só: mesmo que o
     resto falhe, este retorno não serve de novo. */
  const estado = await consumeLoginState(command.tenantId, retorno.state);
  if (!estado) {
    return { status: 400, error: "Este login expirou ou já foi usado. Tente de novo." };
  }

  const config = await providerById(command.tenantId, estado.providerId);
  if (!config || !config.enabled) {
    return { status: 403, error: "Provedor de acesso não encontrado." };
  }

  if (!config.tokenUrl || !config.jwksUrl || !config.issuer) {
    return { status: 400, error: "O provedor está configurado pela metade." };
  }

  const troca = await exchangeCode({
    tokenUrl: config.tokenUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code: retorno.code,
    redirectUri: command.redirectUri,
  });
  if (!troca.ok) return { status: 401, error: troca.error };

  /* A assinatura PRIMEIRO. As afirmações estão em base64, que qualquer um
     escreve; validar o conteúdo antes de saber que o provedor o assinou seria
     validar um texto anônimo. */
  const assinado = await verifyIdTokenSignature(troca.tokens.idToken, config.jwksUrl);
  if (!assinado) {
    await recordAudit({
      actorId: null,
      actorName: `sso:${config.provider}`,
      action: "sso_login_failed",
      target: "assinatura inválida",
      outcome: "denied",
      ip: command.ip,
    });

    return { status: 401, error: "O token do provedor não pôde ser verificado." };
  }

  const bruto = decodeIdTokenUnverified(troca.tokens.idToken);
  if (!bruto) return { status: 401, error: "O token do provedor está malformado." };

  const validado = validateIdTokenClaims(bruto, {
    expectedIssuer: config.issuer,
    expectedAudience: config.clientId,
    expectedNonce: estado.nonce,
    now: Math.floor(Date.now() / 1000),
    allowedDomains: config.allowedDomains,
  });

  if (!validado.ok) {
    await recordAudit({
      actorId: null,
      actorName: `sso:${config.provider}`,
      action: "sso_login_failed",
      target: validado.error,
      outcome: "denied",
      ip: command.ip,
    });

    return { status: 401, error: validado.error };
  }

  const claims = validado.claims;
  const email = String(claims.email);
  const subject = String(claims.sub);
  const nome = typeof claims.name === "string" ? claims.name : null;

  const decisao = decideLink({
    provider: config.provider,
    subject,
    email,
    fullName: nome,
    linked: await findIdentity(command.tenantId, config.provider, subject),
    byEmail: await findAccountByEmail(command.tenantId, email),
    allowJit: config.allowJit,
    jitRole: config.jitRole,
  });

  const userId = await aplicarDecisao(
    command.tenantId,
    config.provider,
    subject,
    email,
    decisao,
    command.ip,
  );
  if (typeof userId !== "string") return userId;

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
    target: `sso:${config.provider}`,
    outcome: "allowed",
    ip: command.ip,
  });

  return {
    status: 200,
    token: sessao.token,
    expiresAt: sessao.expiresAt,
    redirectPath: estado.redirectPath,
    userId,
  };
}

/**
 * Executa a decisão de vínculo.
 *
 * Devolve o `userId` quando há login, ou o próprio resultado de recusa. O tipo
 * de retorno misturado evita repetir a montagem da recusa em três lugares.
 */
async function aplicarDecisao(
  tenantId: string,
  provider: string,
  subject: string,
  email: string,
  decisao: ReturnType<typeof decideLink>,
  ip: string,
): Promise<string | CallbackOutcome> {
  switch (decisao.kind) {
    case "login":
      await touchIdentityLogin(tenantId, provider, subject);
      return decisao.userId;

    case "link-and-login":
      await linkIdentity(tenantId, decisao.userId, provider, subject, email);
      /* O vínculo cria uma segunda porta para esta conta. Quem revisa acesso
         precisa ver quando ela apareceu — e, se for indevida, tem aqui a data
         para investigar. */
      await recordAudit({
        actorId: decisao.userId,
        actorName: email,
        action: "sso_identity_linked",
        target: provider,
        outcome: "allowed",
        ip,
      });
      return decisao.userId;

    case "create": {
      const novo = await createSsoUser(tenantId, decisao.email, decisao.fullName, decisao.role);
      await linkIdentity(tenantId, novo, provider, subject, email);
      await recordAudit({
        actorId: novo,
        actorName: email,
        action: "sso_identity_linked",
        target: `${provider} (conta criada pelo SSO)`,
        outcome: "allowed",
        ip,
      });
      return novo;
    }

    case "refuse":
      return { status: 403, error: decisao.reason };
  }
}
