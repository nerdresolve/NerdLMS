import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { WebhookEvent } from "@nerdlms/core/api/webhook-events.ts";

import { query } from "../db/pool.ts";

/**
 * Webhooks — F5-02.
 *
 * O produto avisa sistemas de fora quando algo acontece: alguém se matriculou,
 * uma nota saiu, um certificado foi emitido.
 *
 * **A entrega nunca derruba a operação.** Um webhook que falha não pode
 * impedir a matrícula — mesma regra de `notify` e de `recordAudit`.
 */

/* A lista de eventos mora no core: a tela de integrações precisa dela, e duas
   listas seriam duas listas divergindo. Reexportada aqui porque quem dispara
   naturalmente procura por ela junto do disparador. */
export { WEBHOOK_EVENTS, type WebhookEvent } from "@nerdlms/core/api/webhook-events.ts";

/** Segredo de assinatura para um webhook novo. */
export function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/**
 * A assinatura que vai no cabeçalho.
 *
 * HMAC-SHA256 sobre `timestamp.corpo`. O timestamp entra no que é assinado —
 * sem ele, quem capturasse uma entrega poderia reenviá-la para sempre, e a
 * assinatura continuaria válida.
 */
export function signPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Confere uma assinatura — para quem RECEBE.
 *
 * Existe aqui para o teste poder verificar o que mandamos, e serve de
 * referência para quem implementa o outro lado.
 *
 * A comparação é em tempo constante: comparar assinatura com `===` vaza,
 * caractere a caractere, qual é a certa.
 */
export function verifySignature(
  secret: string,
  timestamp: number,
  body: string,
  assinatura: string,
): boolean {
  const esperada = signPayload(secret, timestamp, body);

  const a = Buffer.from(esperada, "hex");
  const b = Buffer.from(assinatura, "hex");

  return a.length === b.length && timingSafeEqual(a, b);
}

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  events: string[];
}

/**
 * Dispara um evento para quem assinou.
 *
 * Cada entrega é registrada ANTES da tentativa: se o processo cair no meio, a
 * linha pendente permite reprocessar. Registrar depois perderia justamente a
 * entrega que falhou.
 */
export async function dispatchWebhook(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<number> {
  let entregues = 0;

  try {
    const rows = await query<WebhookRow>(
      `SELECT id, url, secret, events
         FROM webhooks
        WHERE tenant_id = $1 AND active
          /* Lista vazia é "todos os eventos": é o caso comum de quem espelha
             tudo num sistema próprio. */
          AND (cardinality(events) = 0 OR $2 = ANY(events))`,
      [tenantId, event],
    );

    const corpo = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    for (const hook of rows) {
      const registro = await query<{ id: string }>(
        `INSERT INTO webhook_deliveries (webhook_id, event, payload)
         VALUES ($1, $2, $3::jsonb)
         RETURNING id`,
        [hook.id, event, corpo],
      );

      const deliveryId = registro[0]!.id;
      const ts = Math.floor(Date.now() / 1000);

      try {
        /* Timeout curto: um endereço que não responde não pode segurar a
           requisição de quem matriculou alguém. */
        const controle = new AbortController();
        const timer = setTimeout(() => controle.abort(), 5000);

        const resposta = await fetch(hook.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-nerdlms-event": event,
            "x-nerdlms-timestamp": String(ts),
            "x-nerdlms-signature": signPayload(hook.secret, ts, corpo),
          },
          body: corpo,
          signal: controle.signal,
        });

        clearTimeout(timer);

        await query(
          `UPDATE webhook_deliveries
              SET status_code = $2, delivered_at = CASE WHEN $2 < 400 THEN now() END
            WHERE id = $1`,
          [deliveryId, resposta.status],
        );

        if (resposta.status < 400) entregues += 1;
      } catch (erro) {
        await query(`UPDATE webhook_deliveries SET error = $2 WHERE id = $1`, [
          deliveryId,
          erro instanceof Error ? erro.message.slice(0, 500) : "falha desconhecida",
        ]);
      }
    }
  } catch (erro) {
    /* Nunca lança: a entrega de webhook não pode derrubar a operação que o
       gerou. O erro vai para o console, onde a operação é observável. */
    console.error("[webhook] falhou:", erro);
  }

  return entregues;
}
