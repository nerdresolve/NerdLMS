import { directoryPreset } from "@nerdlms/core/ldap/directory.ts";

import { query } from "../db/pool.ts";

/**
 * Diretórios LDAP configurados por cliente.
 *
 * O molde do DN vem do catálogo para `ad` e `openldap`, e do banco só para o
 * genérico — mesma decisão do OIDC: o que é conhecimento do produto não vira
 * cópia no banco de cada cliente, porque uma cópia envelhece.
 */

export interface LdapDirectory {
  id: string;
  tenantId: string;
  kind: string;
  displayName: string;
  host: string;
  port: number;
  domain: string | null;
  baseDn: string | null;
  /** Já resolvido: do catálogo, ou do banco no caso do genérico. */
  dnTemplate: string;
  allowSelfSigned: boolean;
  allowedDomains: string[];
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
  allowPasswordLogin: boolean;
}

interface Row {
  id: string;
  tenant_id: string;
  kind: string;
  display_name: string;
  host: string;
  port: number;
  domain: string | null;
  base_dn: string | null;
  dn_template: string | null;
  allow_self_signed: boolean;
  allowed_domains: string;
  allow_jit: boolean;
  jit_role: string;
  enabled: boolean;
  allow_password_login: boolean;
}

function toDirectory(row: Row): LdapDirectory {
  const preset = directoryPreset(row.kind);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind,
    displayName: row.display_name,
    host: row.host,
    port: row.port,
    domain: row.domain,
    baseDn: row.base_dn,
    /* O catálogo primeiro; o banco só quando o catálogo não tem molde — que é
       exatamente o caso do genérico. */
    dnTemplate: preset?.dnTemplate || row.dn_template || "",
    allowSelfSigned: row.allow_self_signed,
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

const CAMPOS = `id, tenant_id, kind, display_name, host, port, domain, base_dn,
                dn_template, allow_self_signed, allowed_domains, allow_jit,
                jit_role, enabled, allow_password_login`;

export async function enabledDirectories(tenantId: string): Promise<LdapDirectory[]> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS} FROM ldap_directories
      WHERE tenant_id = $1 AND enabled = true
      ORDER BY display_name`,
    [tenantId],
  );

  return rows.map(toDirectory);
}

export async function allDirectories(tenantId: string): Promise<LdapDirectory[]> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS} FROM ldap_directories WHERE tenant_id = $1 ORDER BY kind`,
    [tenantId],
  );

  return rows.map(toDirectory);
}

export async function directoryById(
  tenantId: string,
  id: string,
): Promise<LdapDirectory | null> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS} FROM ldap_directories WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );

  const row = rows[0];
  return row ? toDirectory(row) : null;
}

export interface UpsertDirectoryInput {
  tenantId: string;
  kind: string;
  displayName: string;
  host: string;
  port: number;
  domain: string | null;
  baseDn: string | null;
  /** Só o genérico usa; nos demais o molde vem do catálogo. */
  dnTemplate: string | null;
  allowSelfSigned: boolean;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
}

/**
 * Cria ou atualiza o diretório de um cliente.
 *
 * Não há segredo a preservar aqui, ao contrário do OIDC: o produto não guarda
 * credencial de serviço — só pergunta ao diretório se a senha de quem está
 * entrando está certa. Por isso a escrita substitui tudo, sem `COALESCE`.
 */
export async function upsertDirectory(input: UpsertDirectoryInput): Promise<LdapDirectory> {
  const rows = await query<Row>(
    `INSERT INTO ldap_directories
            (tenant_id, kind, display_name, host, port, domain, base_dn, dn_template,
             allow_self_signed, allowed_domains, allow_jit, jit_role, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
     ON CONFLICT (tenant_id, kind) DO UPDATE SET
       display_name      = EXCLUDED.display_name,
       host              = EXCLUDED.host,
       port              = EXCLUDED.port,
       domain            = EXCLUDED.domain,
       base_dn           = EXCLUDED.base_dn,
       dn_template       = EXCLUDED.dn_template,
       allow_self_signed = EXCLUDED.allow_self_signed,
       allowed_domains   = EXCLUDED.allowed_domains,
       allow_jit         = EXCLUDED.allow_jit,
       jit_role          = EXCLUDED.jit_role,
       enabled           = EXCLUDED.enabled,
       updated_at        = now()
     RETURNING ${CAMPOS}`,
    [
      input.tenantId,
      input.kind,
      input.displayName,
      input.host,
      input.port,
      input.domain,
      input.baseDn,
      input.dnTemplate,
      input.allowSelfSigned,
      input.allowedDomains,
      input.allowJit,
      input.jitRole,
      input.enabled,
    ],
  );

  return toDirectory(rows[0]!);
}
