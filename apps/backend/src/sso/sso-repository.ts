import { randomBytes } from "node:crypto";

import {
  providerPreset,
  resolveEndpoint,
  type ProviderPreset,
} from "@nerdlms/core/sso/providers.ts";
import { OIDC_STATE_TTL_SECONDS } from "@nerdlms/core/sso/oidc.ts";

import { query } from "../db/pool.ts";

/**
 * Leitura e escrita do que o SSO guarda.
 *
 * O catálogo de provedores vive no core e não é consultado aqui: os endereços
 * do Google e da Microsoft não mudam por cliente, e guardar uma cópia no banco
 * criaria duas verdades que um dia discordariam. O que vem daqui é só o que é
 * de cada cliente.
 */

export interface SsoProviderConfig {
  id: string;
  tenantId: string;
  provider: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  providerTenantId: string | null;
  /** Já resolvidos: o marcador de locatário foi substituído. */
  authorizationUrl: string | null;
  tokenUrl: string | null;
  jwksUrl: string | null;
  issuer: string | null;
  allowedDomains: string[];
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
  allowPasswordLogin: boolean;
}

interface ProviderRow {
  id: string;
  tenant_id: string;
  provider: string;
  display_name: string;
  client_id: string;
  client_secret: string;
  provider_tenant_id: string | null;
  authorization_url: string | null;
  token_url: string | null;
  jwks_url: string | null;
  issuer: string | null;
  allowed_domains: string;
  allow_jit: boolean;
  jit_role: string;
  enabled: boolean;
  allow_password_login: boolean;
}

/**
 * Junta o que é do cliente com o que vem do catálogo.
 *
 * Para Google e Microsoft os endereços saem do catálogo, com o locatário
 * substituído. Para o genérico saem do banco, porque não há padrão possível.
 */
function toConfig(row: ProviderRow): SsoProviderConfig {
  const preset: ProviderPreset | undefined = providerPreset(row.provider);
  const locatario = row.provider_tenant_id;

  const doCatalogo = (
    doPreset: string | null | undefined,
    doBanco: string | null,
  ): string | null => {
    /* O banco só manda quando o catálogo não tem — é o caso do genérico. */
    if (doPreset) return resolveEndpoint(doPreset, locatario);
    return doBanco;
  };

  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider,
    displayName: row.display_name,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    providerTenantId: locatario,
    authorizationUrl: doCatalogo(preset?.authorizationUrl, row.authorization_url),
    tokenUrl: doCatalogo(preset?.tokenUrl, row.token_url),
    jwksUrl: doCatalogo(preset?.jwksUrl, row.jwks_url),
    issuer: doCatalogo(preset?.issuer, row.issuer),
    allowedDomains: row.allowed_domains
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    allowJit: row.allow_jit,
    jitRole: row.jit_role,
    enabled: row.enabled,
    allowPasswordLogin: row.allow_password_login,
  };
}

const CAMPOS = `id, tenant_id, provider, display_name, client_id, client_secret,
                provider_tenant_id, authorization_url, token_url, jwks_url, issuer,
                allowed_domains, allow_jit, jit_role, enabled, allow_password_login`;

/** Os provedores LIGADOS de um cliente — o que a tela de login mostra. */
export async function enabledProviders(tenantId: string): Promise<SsoProviderConfig[]> {
  const rows = await query<ProviderRow>(
    `SELECT ${CAMPOS}
       FROM sso_providers
      WHERE tenant_id = $1 AND enabled = true
      ORDER BY display_name`,
    [tenantId],
  );

  return rows.map(toConfig);
}

/** Todos os provedores, ligados ou não — a tela de administração. */
export async function allProviders(tenantId: string): Promise<SsoProviderConfig[]> {
  const rows = await query<ProviderRow>(
    `SELECT ${CAMPOS}
       FROM sso_providers
      WHERE tenant_id = $1
      ORDER BY provider`,
    [tenantId],
  );

  return rows.map(toConfig);
}

export async function providerById(
  tenantId: string,
  id: string,
): Promise<SsoProviderConfig | null> {
  const rows = await query<ProviderRow>(
    `SELECT ${CAMPOS} FROM sso_providers WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );

  const row = rows[0];
  return row ? toConfig(row) : null;
}

/**
 * A senha local continua valendo?
 *
 * Só é desligada quando existe pelo menos um provedor LIGADO. Um cliente que
 * desligou a senha e depois desligou o provedor ficaria sem forma nenhuma de
 * entrar — inclusive o administrador que precisaria consertar.
 */
export async function passwordLoginAllowed(tenantId: string): Promise<boolean> {
  const rows = await query<{ bloqueia: boolean }>(
    `SELECT bool_or(NOT allow_password_login) AS bloqueia
       FROM sso_providers
      WHERE tenant_id = $1 AND enabled = true`,
    [tenantId],
  );

  return !(rows[0]?.bloqueia ?? false);
}

export interface LoginState {
  state: string;
  nonce: string;
  redirectPath: string;
}

/**
 * Abre um login: guarda `state` e `nonce` para conferir na volta.
 *
 * Os dois são aleatórios de 32 bytes. Valor previsível aqui derruba as duas
 * proteções ao mesmo tempo — quem adivinha o `state` forja o retorno, quem
 * adivinha o `nonce` reaproveita um token.
 */
export async function openLoginState(
  tenantId: string,
  providerId: string,
  redirectPath: string,
): Promise<LoginState> {
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + OIDC_STATE_TTL_SECONDS * 1000);

  await query(
    `INSERT INTO sso_login_states (state, tenant_id, provider_id, nonce, redirect_path, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [state, tenantId, providerId, nonce, redirectPath, expiraEm],
  );

  return { state, nonce, redirectPath };
}

export interface ConsumedState {
  providerId: string;
  nonce: string;
  redirectPath: string;
}

/**
 * Gasta um `state` — uma vez só.
 *
 * O `UPDATE ... WHERE consumed_at IS NULL ... RETURNING` faz a leitura e a
 * marcação num comando só. Ler e depois marcar deixaria uma janela em que dois
 * retornos simultâneos passariam os dois, que é exatamente o ataque de
 * repetição que o `state` deveria impedir.
 */
export async function consumeLoginState(
  tenantId: string,
  state: string,
): Promise<ConsumedState | null> {
  const rows = await query<{ provider_id: string; nonce: string; redirect_path: string }>(
    `UPDATE sso_login_states
        SET consumed_at = now()
      WHERE state = $1
        AND tenant_id = $2
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING provider_id, nonce, redirect_path`,
    [state, tenantId],
  );

  const row = rows[0];
  if (!row) return null;

  return { providerId: row.provider_id, nonce: row.nonce, redirectPath: row.redirect_path };
}

/** Limpa estados velhos. Chamada pela rotina de manutenção. */
export async function purgeExpiredStates(): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM sso_login_states
      WHERE expires_at < now() - interval '1 day'
      RETURNING state AS id`,
  );

  return rows.length;
}

export interface IdentityRow {
  provider: string;
  subject: string;
  userId: string;
}

/** O vínculo (provedor, sub), se existir. */
export async function findIdentity(
  tenantId: string,
  provider: string,
  subject: string,
): Promise<IdentityRow | null> {
  const rows = await query<{ provider: string; subject: string; user_id: string }>(
    `SELECT provider, subject, user_id
       FROM sso_identities
      WHERE tenant_id = $1 AND provider = $2 AND subject = $3`,
    [tenantId, provider, subject],
  );

  const row = rows[0];
  return row ? { provider: row.provider, subject: row.subject, userId: row.user_id } : null;
}

export interface AccountByEmail {
  id: string;
  email: string;
  status: string;
  hasAnyLink: boolean;
}

/** A conta com este e-mail, dentro deste cliente. */
export async function findAccountByEmail(
  tenantId: string,
  email: string,
): Promise<AccountByEmail | null> {
  const rows = await query<{
    id: string;
    email: string;
    status: string;
    tem_vinculo: boolean;
  }>(
    `SELECT u.id, u.email::text AS email, u.status,
            EXISTS (SELECT 1 FROM sso_identities i WHERE i.user_id = u.id) AS tem_vinculo
       FROM users u
      WHERE u.tenant_id = $1 AND u.email = $2::citext`,
    [tenantId, email],
  );

  const row = rows[0];
  if (!row) return null;

  return { id: row.id, email: row.email, status: row.status, hasAnyLink: row.tem_vinculo };
}

/**
 * Cria o vínculo e registra o acesso.
 *
 * `ON CONFLICT` sobre (tenant, provedor, sub) porque dois retornos simultâneos
 * do provedor — a pessoa clicou duas vezes — chegariam aqui juntos. O segundo
 * atualiza o último acesso em vez de estourar um erro de chave duplicada numa
 * tela de login.
 */
export async function linkIdentity(
  tenantId: string,
  userId: string,
  provider: string,
  subject: string,
  email: string,
): Promise<void> {
  await query(
    `INSERT INTO sso_identities (tenant_id, user_id, provider, subject, email_at_link, last_login_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tenant_id, provider, subject)
     DO UPDATE SET last_login_at = now()`,
    [tenantId, userId, provider, subject, email],
  );
}

export async function touchIdentityLogin(
  tenantId: string,
  provider: string,
  subject: string,
): Promise<void> {
  await query(
    `UPDATE sso_identities
        SET last_login_at = now()
      WHERE tenant_id = $1 AND provider = $2 AND subject = $3`,
    [tenantId, provider, subject],
  );
}

/**
 * Cria a conta de quem entrou pelo SSO e nunca tinha entrado.
 *
 * Sem senha: `password_hash` nulo. É o ponto do SSO — a senha vive no
 * provedor. Quem quiser também entrar por senha usa "esqueci minha senha",
 * que é o mesmo caminho de quem foi cadastrado pelo administrador.
 */
export async function createSsoUser(
  tenantId: string,
  email: string,
  fullName: string,
  role: string,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, full_name, role, status, password_hash)
     VALUES ($1, $2::citext, $3, $4, 'active', NULL)
     RETURNING id`,
    [tenantId, email, fullName, role],
  );

  return rows[0]!.id;
}

export interface UpsertProviderInput {
  tenantId: string;
  provider: string;
  displayName: string;
  clientId: string;
  /** Vazio mantém a chave que já está guardada. */
  clientSecret: string;
  providerTenantId: string | null;
  authorizationUrl: string | null;
  tokenUrl: string | null;
  jwksUrl: string | null;
  issuer: string | null;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
  allowPasswordLogin: boolean;
}

/**
 * Cria ou atualiza o provedor de um cliente.
 *
 * A chave secreta em branco MANTÉM a que está lá — `COALESCE(NULLIF(...))`.
 * A tela nunca recebe a chave de volta, então um formulário reenviado com o
 * campo vazio não pode significar "apague": significaria perder a
 * configuração a cada edição de qualquer outro campo.
 */
export async function upsertProvider(input: UpsertProviderInput): Promise<SsoProviderConfig> {
  const rows = await query<ProviderRow>(
    `INSERT INTO sso_providers (
       tenant_id, provider, display_name, client_id, client_secret,
       provider_tenant_id, authorization_url, token_url, jwks_url, issuer,
       allowed_domains, allow_jit, jit_role, enabled, allow_password_login, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
     ON CONFLICT (tenant_id, provider) DO UPDATE SET
       display_name         = EXCLUDED.display_name,
       client_id            = EXCLUDED.client_id,
       client_secret        = COALESCE(NULLIF(EXCLUDED.client_secret, ''), sso_providers.client_secret),
       provider_tenant_id   = EXCLUDED.provider_tenant_id,
       authorization_url    = EXCLUDED.authorization_url,
       token_url            = EXCLUDED.token_url,
       jwks_url             = EXCLUDED.jwks_url,
       issuer               = EXCLUDED.issuer,
       allowed_domains      = EXCLUDED.allowed_domains,
       allow_jit            = EXCLUDED.allow_jit,
       jit_role             = EXCLUDED.jit_role,
       enabled              = EXCLUDED.enabled,
       allow_password_login = EXCLUDED.allow_password_login,
       updated_at           = now()
     RETURNING ${CAMPOS}`,
    [
      input.tenantId,
      input.provider,
      input.displayName,
      input.clientId,
      input.clientSecret,
      input.providerTenantId,
      input.authorizationUrl,
      input.tokenUrl,
      input.jwksUrl,
      input.issuer,
      input.allowedDomains,
      input.allowJit,
      input.jitRole,
      input.enabled,
      input.allowPasswordLogin,
    ],
  );

  return toConfig(rows[0]!);
}
