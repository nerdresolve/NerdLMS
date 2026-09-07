import type { CalendarEvent, Notification } from "@nerdlms/core/courses/calendar.ts";

import { query } from "../db/pool.ts";

/**
 * Agenda e avisos.
 *
 * As duas coisas moram juntas porque a tela é uma só: quem abre a agenda vê o
 * mês e a lista de avisos lado a lado.
 *
 * Evento é institucional e tem recorte por projeto — um treinamento na ETA
 * Guandu não interessa a quem trabalha em outra praça. Evento sem projeto é
 * para todo mundo (norma nova, comunicado geral), então a consulta traz os
 * dois casos.
 *
 * Aviso é pessoal: a coluna é `user_id`, sem recorte por projeto.
 */

interface EventRow {
  id: string;
  on_date: Date | string;
  time_label: string | null;
  title: string;
  kind: string;
  location: string | null;
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  created_at: Date | string;
  read_at: Date | string | null;
}

/* O driver devolve `date` como Date, e `new Date(...).toISOString()` recuaria
   um dia em fuso negativo — no Brasil, um evento do dia 3 apareceria no dia 2.
   Formatar pelos componentes locais evita a conversão para UTC. */
function toCivilDate(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const mes = String(value.getMonth() + 1).padStart(2, "0");
  const dia = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${mes}-${dia}`;
}

const EVENT_KINDS = new Set(["training", "deadline", "announcement"]);
const NOTIFICATION_KINDS = new Set(["announcement", "reminder", "achievement"]);

export async function findEvents(tenantId: string, project: string | null): Promise<CalendarEvent[]> {
  const rows = await query<EventRow>(
    `SELECT id, on_date, time_label, title, kind, location
       FROM events
      WHERE tenant_id = $2
        AND (project IS NULL OR project = $1)
      ORDER BY on_date`,
    [project, tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    date: toCivilDate(row.on_date),
    title: row.title,
    /* Um valor fora do domínio viraria uma classe CSS inexistente e um ícone
       em branco. Cair em "announcement" mostra o evento sem enfeite, que é
       melhor do que escondê-lo. */
    kind: (EVENT_KINDS.has(row.kind) ? row.kind : "announcement") as CalendarEvent["kind"],
    ...(row.time_label ? { time: row.time_label } : {}),
    ...(row.location ? { location: row.location } : {}),
  }));
}

export async function findNotifications(userId: string): Promise<Notification[]> {
  const rows = await query<NotificationRow>(
    `SELECT id, title, body, kind, created_at, read_at
       FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    date: toCivilDate(row.created_at),
    kind: (NOTIFICATION_KINDS.has(row.kind)
      ? row.kind
      : "announcement") as Notification["kind"],
    read: row.read_at !== null,
  }));
}

/**
 * Marca um aviso como lido.
 *
 * O `user_id` entra no WHERE, não só o id do aviso: sem ele, qualquer pessoa
 * autenticada marcaria como lido o aviso de outra, bastando ter o id.
 *
 * `read_at IS NULL` evita reescrever a data de quem já leu — a segunda visita
 * à tela não deve mover o horário da primeira leitura.
 */
export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE notifications SET read_at = now()
      WHERE id = $1 AND user_id = $2 AND read_at IS NULL
      RETURNING id`,
    [notificationId, userId],
  );
  return rows.length > 0;
}
