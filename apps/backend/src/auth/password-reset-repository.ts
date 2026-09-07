import { createHash, randomBytes } from "node:crypto";

import { RESET_TOKEN_TTL_MINUTES } from "@nerdlms/core/auth/password-reset.ts";

import { query } from "../db/pool.ts";

/**
 * Tokens de redefinição de senha.
 *
 * O banco guarda o **hash** do token, não o token — mesma razão da sessão: um
 * vazamento do banco não dá links utilizáveis. Quem tem o valor original é
 * apenas quem recebeu o e-mail.
 */

const hashToken = (token: string): Buffer => createHash("sha256").update(token, "utf8").digest();

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

/**
 * Emite um token para o usuário.
 *
 * Os pedidos anteriores são invalidados: dois links válidos ao mesmo tempo
 * dobram a superfície, e quem pediu de novo está usando o mais recente.
 */
export async function createResetToken(userId: string): Promise<IssuedToken> {
  await query(`DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`, [userId]);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [hashToken(token), userId, expiresAt],
  );

  return { token, expiresAt };
}

/**
 * Consome o token e devolve o dono, ou `null`.
 *
 * A marcação de uso acontece **na mesma instrução** que valida: separar
 * permitiria que duas requisições simultâneas com o mesmo link passassem as
 * duas. `used_at IS NULL` no `WHERE` faz a segunda não encontrar nada.
 */
export async function consumeResetToken(token: string): Promise<string | null> {
  if (!token) return null;

  const rows = await query<{ user_id: string }>(
    `UPDATE password_reset_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id`,
    [hashToken(token)],
  );

  return rows[0]?.user_id ?? null;
}

/**
 * Define a senha e encerra as sessões abertas.
 *
 * Trocar a senha sem derrubar as sessões deixaria um invasor logado justamente
 * quando a pessoa agiu para expulsá-lo — que é o motivo mais comum de alguém
 * redefinir a senha.
 */
export async function setPassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE users SET password_hash = $2, status = 'active', updated_at = now() WHERE id = $1`,
    [userId, passwordHash],
  );
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

/**
 * O usuário de um e-mail, para o pedido de recuperação.
 *
 * O tenant é obrigatório porque o e-mail deixou de ser único no banco: desde a
 * migração 003 ele é único POR CLIENTE, e duas empresas podem legitimamente
 * ter a mesma pessoa cadastrada. Sem o recorte, o `LIMIT 1` devolveria quem
 * viesse primeiro — e o link de redefinição iria para a conta errada.
 */
export async function findUserByEmail(
  tenantId: string,
  email: string,
): Promise<{ id: string; fullName: string; email: string } | null> {
  const rows = await query<{ id: string; full_name: string; email: string }>(
    `SELECT id, full_name, email
       FROM users
      WHERE tenant_id = $2 AND email = $1 AND status <> 'inactive'
      LIMIT 1`,
    [email.trim().toLowerCase(), tenantId],
  );

  const row = rows[0];
  return row ? { id: row.id, fullName: row.full_name, email: row.email } : null;
}
