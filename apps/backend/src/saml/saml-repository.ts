import { randomBytes } from "node:crypto";

import { query } from "../db/pool.ts";

/**
 * Provedores SAML e pedidos em andamento.
 *
 * Nada de segredo compartilhado aqui, ao contrário do OIDC: a confiança vem do
 * certificado do provedor, que é público por definição. O que guardamos não
 * permite a ninguém se passar por nós.
 */

/** Quanto tempo um pedido de autenticação vale. */
const REQUEST_TTL_MINUTES = 10;

export interface SamlProvider {
  id: string;
  tenantId: string;
  displayName: string;
  idpEntityId: string;
  ssoUrl: string;
  certificates: string[];
  spEntityId: string;
  allowedDomains: string[];
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
  allowPasswordLogin: boolean;
}

interface Row {
  id: string;
  tenant_id: string;
  display_name: string;
  idp_entity_id: string;
  sso_url: string;
  certificates: string[] | null;
  sp_entity_id: string;
  allowed_domains: string;
  allow_jit: boolean;
  jit_role: string;
  enabled: boolean;
  allow_password_login: boolean;
}

function toProvider(row: Row): SamlProvider {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    displayName: row.display_name,
    idpEntityId: row.idp_entity_id,
    ssoUrl: row.sso_url,
    /* Nulo vira lista vazia, e lista vazia não valida nada — o `verifyAssertion`
       recusa antes de olhar a assinatura. */
    certificates: row.certificates ?? [],
    spEntityId: row.sp_entity_id,
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

const CAMPOS = `id, tenant_id, display_name, idp_entity_id, sso_url, certificates,
                sp_entity_id, allowed_domains, allow_jit, jit_role, enabled,
                allow_password_login`;

export async function enabledSamlProvider(tenantId: string): Promise<SamlProvider | null> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS} FROM saml_providers WHERE tenant_id = $1 AND enabled = true`,
    [tenantId],
  );

  const row = rows[0];
  return row ? toProvider(row) : null;
}

export async function samlProvider(tenantId: string): Promise<SamlProvider | null> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS} FROM saml_providers WHERE tenant_id = $1`,
    [tenantId],
  );

  const row = rows[0];
  return row ? toProvider(row) : null;
}

export interface SamlRequest {
  id: string;
  redirectPath: string;
}

/**
 * Abre um pedido: guarda o `ID` para conferir o `InResponseTo` que volta.
 *
 * O `ID` precisa começar com letra ou sublinhado — é regra do XML, e um valor
 * que comece com dígito produz um documento inválido que o provedor recusa
 * com um erro que não aponta para cá.
 */
export async function openSamlRequest(
  tenantId: string,
  providerId: string,
  redirectPath: string,
): Promise<SamlRequest> {
  const id = `_${randomBytes(24).toString("hex")}`;
  const expira = new Date(Date.now() + REQUEST_TTL_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO saml_requests (id, tenant_id, provider_id, redirect_path, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, tenantId, providerId, redirectPath, expira],
  );

  return { id, redirectPath };
}

/**
 * Gasta um pedido — uma vez só.
 *
 * `UPDATE ... RETURNING` faz a leitura e a marcação numa instrução: ler e
 * depois marcar deixaria uma janela em que duas respostas simultâneas passariam
 * as duas, que é exatamente o ataque de repetição que o `InResponseTo` existe
 * para impedir.
 */
export async function consumeSamlRequest(
  tenantId: string,
  id: string,
): Promise<SamlRequest | null> {
  const rows = await query<{ id: string; redirect_path: string }>(
    `UPDATE saml_requests
        SET consumed_at = now()
      WHERE id = $1 AND tenant_id = $2
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING id, redirect_path`,
    [id, tenantId],
  );

  const row = rows[0];
  return row ? { id: row.id, redirectPath: row.redirect_path } : null;
}

/** Limpa pedidos vencidos. O corte é por tempo, não por cliente. */
export async function purgeSamlRequests(): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM saml_requests WHERE expires_at < now() - interval '1 day' RETURNING id`,
  );

  return rows.length;
}

export interface UpsertSamlInput {
  tenantId: string;
  displayName: string;
  idpEntityId: string;
  ssoUrl: string;
  certificates: string[];
  spEntityId: string;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
}

/**
 * Cria ou atualiza o provedor SAML de um cliente.
 *
 * Os certificados substituem os anteriores por inteiro, e é assim que a
 * rotação funciona: quem vai trocar cadastra os dois, espera a troca, e depois
 * remove o antigo. Somar em vez de substituir deixaria certificados vencidos
 * acumulando para sempre — e um deles poderia ser o de um provedor que o
 * cliente nem usa mais.
 */
export async function upsertSamlProvider(input: UpsertSamlInput): Promise<SamlProvider> {
  const rows = await query<Row>(
    `INSERT INTO saml_providers
            (tenant_id, display_name, idp_entity_id, sso_url, certificates,
             sp_entity_id, allowed_domains, allow_jit, jit_role, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       display_name    = EXCLUDED.display_name,
       idp_entity_id   = EXCLUDED.idp_entity_id,
       sso_url         = EXCLUDED.sso_url,
       certificates    = EXCLUDED.certificates,
       sp_entity_id    = EXCLUDED.sp_entity_id,
       allowed_domains = EXCLUDED.allowed_domains,
       allow_jit       = EXCLUDED.allow_jit,
       jit_role        = EXCLUDED.jit_role,
       enabled         = EXCLUDED.enabled,
       updated_at      = now()
     RETURNING ${CAMPOS}`,
    [
      input.tenantId,
      input.displayName,
      input.idpEntityId,
      input.ssoUrl,
      input.certificates,
      input.spEntityId,
      input.allowedDomains,
      input.allowJit,
      input.jitRole,
      input.enabled,
    ],
  );

  return toProvider(rows[0]!);
}
