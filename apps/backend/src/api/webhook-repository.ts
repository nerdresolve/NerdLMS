import { generateSecret } from "./webhook-dispatcher.ts";

import { query } from "../db/pool.ts";

/**
 * Webhooks cadastrados — F5-02.
 */

export interface WebhookSummary {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  /** Últimas entregas, para depurar integração. */
  lastStatus?: number;
  lastError?: string;
  deliveries: number;
}

export async function findWebhooks(tenantId: string): Promise<WebhookSummary[]> {
  const rows = await query<{
    id: string;
    url: string;
    events: string[];
    active: boolean;
    created_at: Date;
    last_status: number | null;
    last_error: string | null;
    deliveries: string;
  }>(
    `SELECT w.id, w.url, w.events, w.active, w.created_at,
            (SELECT d.status_code FROM webhook_deliveries d
              WHERE d.webhook_id = w.id ORDER BY d.created_at DESC LIMIT 1) AS last_status,
            (SELECT d.error FROM webhook_deliveries d
              WHERE d.webhook_id = w.id ORDER BY d.created_at DESC LIMIT 1) AS last_error,
            (SELECT count(*) FROM webhook_deliveries d WHERE d.webhook_id = w.id) AS deliveries
       FROM webhooks w
      WHERE w.tenant_id = $1
      ORDER BY w.created_at DESC`,
    [tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    events: row.events,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    deliveries: Number(row.deliveries),
    ...(row.last_status !== null ? { lastStatus: row.last_status } : {}),
    ...(row.last_error ? { lastError: row.last_error } : {}),
  }));
}

/**
 * Cria um webhook.
 *
 * O segredo volta em texto UMA vez: quem recebe precisa dele para conferir a
 * assinatura, e guardá-lo em texto no banco seria guardar a chave junto da
 * fechadura. Aqui ele é gravado porque a plataforma precisa ASSINAR com ele —
 * ao contrário da chave de API, que só precisa ser conferida.
 */
export async function createWebhook(
  tenantId: string,
  url: string,
  events: string[],
): Promise<{ id: string; secret: string }> {
  const secret = generateSecret();

  const rows = await query<{ id: string }>(
    `INSERT INTO webhooks (tenant_id, url, events, secret)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tenantId, url, events, secret],
  );

  return { id: rows[0]!.id, secret };
}

export async function deleteWebhook(id: string, tenantId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [id, tenantId],
  );

  return rows.length > 0;
}
