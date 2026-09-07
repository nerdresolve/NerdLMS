import { firstNameOf, type AccountRecord } from "@nerdlms/core/auth/login.ts";
import type { Role } from "@nerdlms/core/auth/permissions.ts";

import { query } from "../db/pool.ts";

/**
 * Consultas de usuário.
 *
 * A separação segue o que o SCE API faz entre `Service` e `Models/DTOs`: aqui
 * mora o SQL e a tradução da linha para o tipo do domínio; a regra de quem
 * entra e quem não entra fica em `@nerdlms/core/auth/login.ts`, sem saber que
 * existe banco.
 *
 * Nada nesta camada decide autenticação — só busca. É o que permite testar a
 * regra sem Postgres.
 */

/** A linha crua, como o `pg` devolve: snake_case e tipos do driver. */
interface UserRow {
  id: string;
  email: string | null;
  full_name: string;
  password_hash: string | null;
  role: Role;
  status: "active" | "pending" | "inactive";
  project: string | null;
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_unit_label: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  brand_color: string | null;
}

function toAccount(row: UserRow): AccountRecord {
  return {
    id: row.id,
    firstName: firstNameOf(row.full_name),
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    project: row.project,
    status: row.status,
    passwordHash: row.password_hash,
    tenant: {
      id: row.tenant_id,
      slug: row.tenant_slug,
      name: row.tenant_name,
      unitLabel: row.tenant_unit_label,
      branding: {
        logoLightUrl: row.logo_light_url,
        logoDarkUrl: row.logo_dark_url,
        faviconUrl: row.favicon_url,
        brandColor: row.brand_color,
      },
    },
  };
}

/**
 * Busca a conta pelo identificador do login.
 *
 * Aceita e-mail completo ou só a parte antes do `@` — em homologação as pessoas
 * digitam `admin.mock`, não o endereço inteiro.
 *
 * A comparação ignora maiúsculas nos DOIS casos. A coluna é `citext`, o que
 * já bastaria para o e-mail inteiro; mas `$1 || '@exemplo.com.br'` devolve
 * `text`, e o resultado da concatenação perde a insensibilidade — quem
 * digitasse `ADMIN.MOCK` não entrava, enquanto `ADMIN.MOCK@EXEMPLO.COM.BR`
 * entrava. O cast explícito devolve o comportamento de `citext` ao lado
 * concatenado.
 *
 * Senha continua sensível a maiúsculas, como deve ser: ali a diferença é
 * entropia, não digitação.
 *
 * Devolve `null` quando não encontra: quem decide o que isso significa é
 * `authenticate`, e ele responde a mesma coisa para conta inexistente e senha
 * errada.
 */
export async function findAccountByIdentifier(identifier: string): Promise<AccountRecord | null> {
  const value = identifier.trim();
  if (!value) return null;

  const rows = await query<UserRow>(
    `SELECT u.id, u.email, u.full_name, u.password_hash, u.role, u.status, u.project,
            t.id AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name,
            t.unit_label AS tenant_unit_label,
            t.logo_light_url, t.logo_dark_url, t.favicon_url, t.brand_color
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = $1
         OR u.email = ($1 || '@exemplo.com.br')::citext
      LIMIT 1`,
    [value],
  );

  const row = rows[0];
  return row ? toAccount(row) : null;
}

/** Registra o acesso, para a métrica de usuários ativos. */
export async function touchLastAccess(userId: string): Promise<void> {
  await query(`UPDATE users SET last_access_at = now() WHERE id = $1`, [userId]);
}
