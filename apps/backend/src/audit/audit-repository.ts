import type { AuditAction, AuditEvent, AuditOutcome } from "@nerdlms/core/courses/audit.ts";

import { query } from "../db/pool.ts";

/**
 * Escrita e leitura do registro de auditoria.
 *
 * A tabela é somente-inserção: um gatilho recusa UPDATE e DELETE.
 * Registro que se edita não prova nada — é essa a diferença entre auditoria e
 * histórico.
 *
 * `actor_name` é guardado junto, e não buscado por junção na leitura. Parece
 * redundante e não é: quem foi desativado ou removido continua nomeado no
 * registro, e o rastro não vira "usuário desconhecido" com o tempo.
 */

export interface AuditRecord {
  actorId: string | null;
  actorName: string;
  action: AuditAction;
  target: string;
  outcome: AuditOutcome;
  ip?: string | null;
}

/**
 * Grava um evento.
 *
 * **Nunca lança.** Auditoria que derruba a operação auditada troca um problema
 * de rastreabilidade por um problema de disponibilidade — o usuário perderia o
 * comentário porque o log falhou. A falha vai para o console do servidor, onde
 * a operação é observável, e a ação segue.
 */
export async function recordAudit(record: AuditRecord): Promise<void> {
  try {
    /* O tenant é DERIVADO do ator, por subconsulta, em vez de vir no registro.
       
       São 20 pontos de chamada; exigir o campo em cada um garantiria que
       alguém esqueceria — e a coluna é NOT NULL, então o esquecimento
       apareceria como auditoria que deixou de gravar. Derivar do
       `actor_id`, que toda chamada já informa, fecha essa porta.
       
       `actor_id` é nulo em evento de sistema; nesse caso o tenant fica nulo
       também, e a tela de auditoria mostra o evento para quem tem acesso
       global. */
    await query(
      `INSERT INTO audit_log (tenant_id, actor_id, actor_name, action, target, outcome, ip)
       VALUES ((SELECT tenant_id FROM users WHERE id = $1), $1, $2, $3, $4, $5, $6)`,
      [
        record.actorId,
        record.actorName,
        record.action,
        record.target.slice(0, 500),
        record.outcome,
        record.ip ?? null,
      ],
    );
  } catch (error) {
    console.error("auditoria não registrada:", error);
  }
}

interface AuditRow {
  id: string;
  at: Date;
  actor_id: string | null;
  actor_name: string;
  action: AuditAction;
  target: string;
  outcome: AuditOutcome;
}

/**
 * Eventos do mais recente para o mais antigo.
 *
 * O limite existe porque a tabela só cresce: sem ele, a tela de auditoria
 * ficaria mais lenta a cada mês até deixar de abrir.
 */
export async function findAuditEvents(tenantId: string, limit = 200): Promise<AuditEvent[]> {
  const rows = await query<AuditRow>(
    `SELECT id::text, at, actor_id, actor_name, action, target, outcome
       FROM audit_log
      WHERE tenant_id = $2
      ORDER BY at DESC
      LIMIT $1`,
    [limit, tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    at: row.at.toISOString(),
    actorId: row.actor_id ?? "",
    actorName: row.actor_name,
    action: row.action,
    target: row.target,
    outcome: row.outcome,
  }));
}
