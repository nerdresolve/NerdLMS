import { baseDnDoDominio, directoryPreset } from "@nerdlms/core/ldap/directory.ts";
import type { GroupRole, Role } from "@nerdlms/core/ldap/mapping.ts";

import { query, withTransaction } from "../db/pool.ts";

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
  /** Vazio quando a busca deve usar o vínculo da própria pessoa. */
  serviceDn: string;
  /** Ainda CIFRADA. Abrir é decisão de quem vai usar, não de quem lê a linha. */
  servicePasswordEncrypted: string | null;
  /** Já resolvida: a informada, ou a deduzida do domínio. */
  searchBase: string;
  syncProfile: boolean;
  requireGroup: boolean;
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
  service_dn: string | null;
  service_password: string | null;
  search_base: string | null;
  sync_profile: boolean;
  require_group: boolean;
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
    serviceDn: (row.service_dn ?? "").trim(),
    servicePasswordEncrypted: row.service_password,
    /* A base informada ganha da deduzida. Deduzir sempre impediria limitar a
       busca a uma OU; pedir sempre faria quem configura escrever o domínio
       duas vezes, em formatos diferentes. */
    searchBase: (row.search_base ?? "").trim() || baseDnDoDominio(row.domain),
    syncProfile: row.sync_profile,
    requireGroup: row.require_group,
  };
}

const CAMPOS = `id, tenant_id, kind, display_name, host, port, domain, base_dn,
                dn_template, allow_self_signed, allowed_domains, allow_jit,
                jit_role, enabled, allow_password_login, service_dn,
                service_password, search_base, sync_profile, require_group`;

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

/**
 * O mapa de grupo para papel de um diretório.
 *
 * Lido a cada login, sem cache. É uma consulta a uma tabela pequena com índice
 * pela chave — e guardar em memória significaria que mudar o mapa na
 * administração só valeria depois de reiniciar, ou depois de um tempo que
 * ninguém sabe qual é. Numa regra de ACESSO, esse atraso é o defeito.
 */
export async function groupRoles(directoryId: string): Promise<GroupRole[]> {
  const rows = await query<{ group_cn: string; role: string }>(
    `SELECT group_cn, role FROM ldap_group_roles
      WHERE directory_id = $1
      ORDER BY group_cn`,
    [directoryId],
  );

  return rows.map((r) => ({ groupCn: r.group_cn, role: r.role as Role }));
}

/**
 * Substitui o mapa inteiro de uma vez.
 *
 * Apagar e reinserir, numa transação, em vez de comparar linha a linha: a tela
 * edita a lista como um todo, e uma sincronização incremental teria de decidir
 * o que fazer com o que sumiu — que é exatamente "apagar". Fazer o difícil para
 * chegar ao mesmo lugar só cria caminhos onde o estado fica pela metade.
 */
export async function replaceGroupRoles(
  directoryId: string,
  mapeamentos: GroupRole[],
): Promise<void> {
  await withTransaction(async (exec) => {
    await exec(`DELETE FROM ldap_group_roles WHERE directory_id = $1`, [directoryId]);

    for (const m of mapeamentos) {
      const cn = m.groupCn.trim();
      if (!cn) continue;

      /* `ON CONFLICT DO NOTHING` cobre a lista que chega com o mesmo grupo
         escrito duas vezes com grafias diferentes — o índice único é por
         `lower(btrim())`, e sem isto a gravação inteira falharia por um
         descuido de digitação. */
      await exec(
        `INSERT INTO ldap_group_roles (directory_id, group_cn, role)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [directoryId, cn, m.role],
      );
    }
  });
}

export interface SyncInput {
  userId: string;
  /** Nulo = o diretório não informou; o valor daqui fica como está. */
  fullName: string | null;
  email: string | null;
  project: string | null;
  role: Role | null;
  /** A função, para a matriz de treinamento. Nula: o diretório não informou. */
  jobTitle: string | null;
}

/**
 * Traz para o cadastro o que o diretório disse.
 *
 * `COALESCE` em todos os campos, e isso é a regra inteira: o diretório manda no
 * que ele PREENCHE. Um `department` em branco no Active Directory significa
 * "não sei", não "apague o que está aí" — e gravar o vazio apagaria a área que
 * alguém preencheu à mão, sem nada acusando.
 *
 * O papel é a exceção que confirma: ele vem sempre resolvido, inclusive quando
 * a resolução deu o padrão. É o que faz sair de um grupo TIRAR o acesso, e sem
 * isso o mapeamento só concederia — todo mundo acumulando permissão para
 * sempre, que é o problema que ele deveria resolver.
 */
export async function syncFromDirectory(input: SyncInput): Promise<void> {
  await query(
    `UPDATE users
        SET full_name  = COALESCE($2, full_name),
            email      = COALESCE($3::citext, email),
            project    = COALESCE($4, project),
            job_title  = COALESCE($5, job_title),
            role       = COALESCE($6, role),
            updated_at = now()
      WHERE id = $1`,
    [input.userId, input.fullName, input.email, input.project, input.jobTitle, input.role],
  );
}

/** O papel e a área que a conta tem HOJE — o antes, para saber se mudou. */
export async function currentRoleAndProject(
  userId: string,
): Promise<{ role: string; project: string | null } | null> {
  const rows = await query<{ role: string; project: string | null }>(
    `SELECT role, project FROM users WHERE id = $1`,
    [userId],
  );

  return rows[0] ?? null;
}

export interface UpsertDirectoryInput {
  tenantId: string;
  kind: string;
  displayName: string;
  host: string;
  port: number;
  domain: string | null;
  baseDn: string | null;
  dnTemplate: string | null;
  allowSelfSigned: boolean;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
  allowPasswordLogin: boolean;
  serviceDn: string | null;
  /**
   * JÁ CIFRADA, ou `null` para manter a que está gravada.
   *
   * Quem cifra é a rota, com o cofre da aplicação. Este módulo nunca vê a senha
   * em claro — e a restrição `ldap_senha_servico_cifrada` recusa no banco
   * qualquer coisa que não tenha passado por lá.
   */
  servicePassword: string | null;
  searchBase: string | null;
  syncProfile: boolean;
  requireGroup: boolean;
}

/**
 * Grava a configuração do diretório.
 *
 * Um por tipo por cliente — é o que o índice único da 033 garante, e é o que
 * torna `ON CONFLICT` o caminho certo: a tela edita o que existe em vez de
 * acumular linhas que ninguém saberia distinguir.
 */
export async function upsertDirectory(
  input: UpsertDirectoryInput,
): Promise<LdapDirectory> {
  const rows = await query<Row>(
    `INSERT INTO ldap_directories (
       tenant_id, kind, display_name, host, port, domain, base_dn, dn_template,
       allow_self_signed, allowed_domains, allow_jit, jit_role, enabled,
       allow_password_login, service_dn, service_password, search_base,
       sync_profile, require_group, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, now())
     ON CONFLICT (tenant_id, kind) DO UPDATE SET
       display_name         = EXCLUDED.display_name,
       host                 = EXCLUDED.host,
       port                 = EXCLUDED.port,
       domain               = EXCLUDED.domain,
       base_dn              = EXCLUDED.base_dn,
       dn_template          = EXCLUDED.dn_template,
       allow_self_signed    = EXCLUDED.allow_self_signed,
       allowed_domains      = EXCLUDED.allowed_domains,
       allow_jit            = EXCLUDED.allow_jit,
       jit_role             = EXCLUDED.jit_role,
       enabled              = EXCLUDED.enabled,
       allow_password_login = EXCLUDED.allow_password_login,
       service_dn           = EXCLUDED.service_dn,
       /* Nulo mantém a senha guardada. É o mesmo que o OIDC já faz com o
          segredo do cliente: a tela nunca recebe o valor de volta para
          reenviar, então um campo em branco significa "não mexi nisso" — e
          apagar seria o efeito colateral de abrir a tela e salvar. */
       service_password     = COALESCE(EXCLUDED.service_password, ldap_directories.service_password),
       search_base          = EXCLUDED.search_base,
       sync_profile         = EXCLUDED.sync_profile,
       require_group        = EXCLUDED.require_group,
       updated_at           = now()
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
      input.allowPasswordLogin,
      input.serviceDn,
      input.servicePassword,
      input.searchBase,
      input.syncProfile,
      input.requireGroup,
    ],
  );

  return toDirectory(rows[0]!);
}
