import type { Channels } from "@nerdlms/core/notifications/events.ts";

import { query } from "../db/pool.ts";

/**
 * Preferências de notificação e templates de e-mail — F4-04 e F4-05.
 */

/**
 * O que esta pessoa MUDOU.
 *
 * Só o que ela mexeu: o padrão vive no catálogo, e uma linha por pessoa por
 * evento seria a maior tabela do banco guardando, quase toda, o valor padrão.
 */
export async function findPreferences(userId: string): Promise<Map<string, Channels>> {
  const rows = await query<{ kind: string; in_app: boolean; email: boolean }>(
    `SELECT kind, in_app, email FROM notification_preferences WHERE user_id = $1`,
    [userId],
  );

  return new Map(rows.map((row) => [row.kind, { inApp: row.in_app, email: row.email }]));
}

export async function savePreference(
  userId: string,
  kind: string,
  inApp: boolean,
  email: boolean,
): Promise<void> {
  await query(
    `INSERT INTO notification_preferences (user_id, kind, in_app, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, kind) DO UPDATE SET
       in_app = EXCLUDED.in_app, email = EXCLUDED.email, updated_at = now()`,
    [userId, kind, inApp, email],
  );
}

export interface EmailTemplate {
  kind: string;
  subject: string;
  body: string;
}

/** Os templates que este cliente personalizou. */
export async function findEmailTemplates(tenantId: string): Promise<EmailTemplate[]> {
  const rows = await query<{ kind: string; subject: string; body: string }>(
    `SELECT kind, subject, body FROM email_templates WHERE tenant_id = $1 ORDER BY kind`,
    [tenantId],
  );

  return rows;
}

export async function saveEmailTemplate(
  tenantId: string,
  kind: string,
  subject: string,
  body: string,
): Promise<void> {
  await query(
    `INSERT INTO email_templates (tenant_id, kind, subject, body)
     VALUES ($1, $2, btrim($3), btrim($4))
     ON CONFLICT (tenant_id, kind) DO UPDATE SET
       subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now()`,
    [tenantId, kind, subject, body],
  );
}
