import {
  channelsFor,
  renderTemplate,
  type Channels,
  type NotificationKind,
} from "@nerdlms/core/notifications/events.ts";

import { query } from "../db/pool.ts";
import { isFeatureEnabled } from "@nerdlms/core/tenancy/features.ts";

import { findTenantFeatures } from "../tenancy/features-repository.ts";
import { sendMail } from "./mailer.ts";

/**
 * Disparar notificação — F4-03, F4-04, F4-05.
 *
 * O ponto único por onde todo evento do produto avisa alguém. Antes disto,
 * `notifications` só recebia linha do seed: matricular, publicar nota ou emitir
 * certificado não avisava ninguém.
 *
 * **Nunca lança.** Uma notificação que derruba a operação notificada troca um
 * problema de comunicação por um de disponibilidade — a pessoa perderia a
 * matrícula porque o e-mail falhou. Mesma regra de `recordAudit`.
 */

export interface NotifyCommand {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Para onde o aviso leva. Sem ele, não há o que clicar. */
  link?: string | null;
  /** Valores das variáveis do template, quando há e-mail. */
  values?: Record<string, string>;
}

/** As preferências desta pessoa, só o que ela mudou. */
async function preferencesOf(userId: string): Promise<Map<string, Channels>> {
  const rows = await query<{ kind: string; in_app: boolean; email: boolean }>(
    `SELECT kind, in_app, email FROM notification_preferences WHERE user_id = $1`,
    [userId],
  );

  return new Map(rows.map((row) => [row.kind, { inApp: row.in_app, email: row.email }]));
}

/** O destinatário: nome, e-mail e tenant, para o template. */
async function recipientOf(
  userId: string,
): Promise<{ email: string | null; fullName: string; tenantId: string } | null> {
  const rows = await query<{ email: string | null; full_name: string; tenant_id: string }>(
    `SELECT email, full_name, tenant_id FROM users WHERE id = $1 AND status <> 'inactive' LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;

  return { email: row.email, fullName: row.full_name, tenantId: row.tenant_id };
}

/** O template do cliente, quando ele personalizou (F4-05). */
async function templateOf(
  tenantId: string,
  kind: NotificationKind,
): Promise<{ subject: string; body: string } | null> {
  const rows = await query<{ subject: string; body: string }>(
    `SELECT subject, body FROM email_templates WHERE tenant_id = $1 AND kind = $2 LIMIT 1`,
    [tenantId, kind],
  );

  return rows[0] ?? null;
}

/**
 * Avisa uma pessoa.
 *
 * Devolve por onde saiu, para quem chama poder registrar — mas nunca falha: se
 * o e-mail cair, a notificação in-app continua lá.
 */
export async function notify(command: NotifyCommand): Promise<Channels> {
  const enviado: Channels = { inApp: false, email: false };

  try {
    const destinatario = await recipientOf(command.userId);
    /* Pessoa inativa ou removida não recebe: notificar quem saiu da empresa é
       ruído, e o e-mail pode nem existir mais. */
    if (!destinatario) return enviado;

    const canais = channelsFor(command.kind, await preferencesOf(command.userId));

    /* A feature do CLIENTE manda sobre a preferência da pessoa.
       
       Um cliente que desligou `notificacoes` não tem notificação nenhuma, e um
       que desligou `notificacoes.email` não manda e-mail — mesmo para quem
       deixou o e-mail ligado nas preferências. Sem esta checagem, a flag seria
       decoração: a tela esconderia o menu e o sistema continuaria enviando. */
    const features = await findTenantFeatures(destinatario.tenantId);

    if (!isFeatureEnabled("notificacoes", features)) return enviado;
    if (!isFeatureEnabled("notificacoes.email", features)) canais.email = false;

    /* O id da linha in-app, para marcar o envio de e-mail nela mesma. */
    let notificationId: string | null = null;

    if (canais.inApp) {
      const rows = await query<{ id: string }>(
        `INSERT INTO notifications (user_id, title, body, kind, link)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [command.userId, command.title, command.body, command.kind, command.link ?? null],
      );

      notificationId = rows[0]?.id ?? null;
      enviado.inApp = true;
    }

    if (canais.email && destinatario.email) {
      const template = await templateOf(destinatario.tenantId, command.kind);

      const values = {
        nome: destinatario.fullName,
        /* O primeiro nome é o que se usa em saudação; o completo soa formal
           demais para um aviso de nota. */
        primeiroNome: destinatario.fullName.split(" ")[0] ?? destinatario.fullName,
        titulo: command.title,
        ...command.values,
      };

      const assunto = template ? renderTemplate(template.subject, values) : command.title;
      const corpo = template ? renderTemplate(template.body, values) : command.body;

      const resultado = await sendMail({
        to: destinatario.email,
        subject: assunto,
        body: corpo,
      });

      if (resultado.sent) {
        enviado.email = true;

        /* Marca no ID da linha recém-criada, não por janela de tempo: uma
           janela de um minuto marcaria a notificação errada quando a mesma
           pessoa recebe dois avisos do mesmo tipo seguidos — e é justamente o
           que acontece ao matricular alguém em vários cursos de uma vez. */
        if (notificationId) {
          await query(`UPDATE notifications SET emailed_at = now() WHERE id = $1`, [
            notificationId,
          ]);
        }
      }
    }
  } catch (error) {
    /* Nunca lança: ver o comentário do topo. O erro vai para o console, onde a
       operação é observável. */
    console.error("[notify] falhou:", error);
  }

  return enviado;
}

/** Avisa várias pessoas do mesmo evento. */
export async function notifyMany(
  userIds: string[],
  command: Omit<NotifyCommand, "userId">,
): Promise<number> {
  let entregues = 0;

  for (const userId of userIds) {
    const canais = await notify({ ...command, userId });
    if (canais.inApp || canais.email) entregues += 1;
  }

  return entregues;
}
