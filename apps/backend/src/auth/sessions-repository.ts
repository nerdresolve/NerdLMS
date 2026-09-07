import { createHash, randomBytes } from "node:crypto";

import { firstNameOf, type SessionUser } from "@nerdlms/core/auth/login.ts";
import type { Role } from "@nerdlms/core/auth/permissions.ts";

import { query } from "../db/pool.ts";

/**
 * Sessões e tentativas de login.
 *
 * O token vai para o navegador em texto; o banco guarda só o **hash** dele
 * (`token_hash bytea`, como 001_init.sql já previa). Se o banco vazar, os
 * tokens não são reutilizáveis — mesma lógica de nunca guardar senha em texto.
 */

/** Uma semana com "lembrar de mim", um dia sem. */
const SESSION_DAYS = { remembered: 7, default: 1 } as const;

const hashToken = (token: string): Buffer => createHash("sha256").update(token, "utf8").digest();

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

/** Cria a sessão e devolve o token que vai no cookie. */
export async function createSession(
  userId: string,
  options: { remember?: boolean; userAgent?: string | null; ip?: string | null } = {},
): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const days = options.remember ? SESSION_DAYS.remembered : SESSION_DAYS.default;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashToken(token), userId, expiresAt, options.userAgent ?? null, options.ip ?? null],
  );

  return { token, expiresAt };
}

interface SessionRow {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  project: string | null;
  job_title: string | null;
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_unit_label: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  brand_color: string | null;
}

/**
 * Resolve o token do cookie para o usuário da sessão.
 *
 * A expiração é filtrada no `WHERE`, e não em JavaScript: sessão vencida não
 * pode depender de o servidor lembrar de checar.
 */
export async function findSessionUser(token: string): Promise<SessionUser | null> {
  if (!token) return null;

  const rows = await query<SessionRow>(
    /* O tenant entra por JOIN, na mesma ida ao banco: toda página precisa dele
       e uma segunda consulta por requisição custaria caro à toa. */
    `SELECT u.id, u.full_name, u.email, u.role, u.project, u.job_title,
            t.id AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name,
            t.unit_label AS tenant_unit_label,
            t.logo_light_url, t.logo_dark_url, t.favicon_url, t.brand_color
       FROM sessions s
       JOIN users u   ON u.id = s.user_id
       JOIN tenants t ON t.id = u.tenant_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.status = 'active'
      LIMIT 1`,
    [hashToken(token)],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    firstName: firstNameOf(row.full_name),
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    project: row.project,
    jobTitle: row.job_title,
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

/** Encerra a sessão. Idempotente: sair duas vezes não é erro. */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

/**
 * Registra a tentativa, para o bloqueio por força bruta.
 *
 * Grava sucesso e falha: só as falhas contam para o bloqueio, mas o sucesso é
 * o que permite auditar "de onde esta conta entrou".
 */
export async function recordLoginAttempt(
  identifier: string,
  ip: string,
  succeeded: boolean,
): Promise<void> {
  await query(`INSERT INTO login_attempts (identifier, ip, succeeded) VALUES ($1, $2, $3)`, [
    identifier.slice(0, 254),
    ip,
    succeeded,
  ]);
}

/** Tentativas falhas recentes do mesmo IP — a base do bloqueio temporário. */
export async function recentFailures(ip: string, minutes = 15): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM login_attempts
      WHERE ip = $1
        AND succeeded = false
        AND at > now() - make_interval(mins => $2)`,
    [ip, minutes],
  );
  return Number(rows[0]?.count ?? 0);
}
