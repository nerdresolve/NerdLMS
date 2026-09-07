import type { ValidStatement } from "@nerdlms/core/xapi/statement.ts";

import { query } from "../db/pool.ts";

/**
 * Learning Record Store — F6-03 (guia §26).
 *
 * Statements entram e saem. Não há função de alterar: o gatilho do banco recusa
 * UPDATE e DELETE, e o padrão define anulação (`voiding`) como o mecanismo —
 * outro statement que anula o primeiro, sem apagar nada.
 */

export interface StoreResult {
  id: string;
  /** `true` quando o statement já existia — reenvio, não erro. */
  duplicate: boolean;
}

/**
 * Guarda um statement.
 *
 * **Reenviar o mesmo id NÃO é erro.** O padrão prevê que o cliente gere o UUID
 * justamente para poder reenviar depois de uma queda de rede sem duplicar. Um
 * app de campo offline reenvia o lote inteiro ao reconectar; responder erro
 * faria a sincronização parar no primeiro que já tinha chegado.
 */
export async function storeStatement(input: {
  tenantId: string;
  statement: ValidStatement;
  raw: unknown;
  actorId: string | null;
  courseId: string | null;
  lessonId: string | null;
  apiKeyId: string | null;
}): Promise<StoreResult> {
  const s = input.statement;

  const rows = await query<{ id: string }>(
    `INSERT INTO xapi_statements
            (id, tenant_id, actor_id, actor_mbox, actor_name,
             verb_id, verb_display, object_id, object_name, object_type,
             result_success, result_completion,
             result_score_scaled, result_score_raw, result_score_min, result_score_max,
             result_duration_seconds, result_response,
             course_id, lesson_id, raw, timestamp, api_key_id)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18,
             $19, $20, $21::jsonb, $22, $23)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      s.id,
      input.tenantId,
      input.actorId,
      s.actorEmail,
      s.actorName,
      s.verbId,
      s.verbDisplay,
      s.objectId,
      s.objectName,
      s.objectType,
      s.success,
      s.completion,
      s.scoreScaled,
      s.scoreRaw,
      s.scoreMin,
      s.scoreMax,
      s.durationSeconds,
      s.response,
      input.courseId,
      input.lessonId,
      JSON.stringify(input.raw),
      s.timestamp,
      input.apiKeyId,
    ],
  );

  /* Sem linha devolvida, o id já existia. Devolve o mesmo id: para quem envia,
     o statement está guardado, que é o que importa. */
  if (rows.length === 0) return { id: s.id!, duplicate: true };

  return { id: rows[0]!.id, duplicate: false };
}

export interface StatementQuery {
  tenantId: string;
  /** Filtros do padrão: agent, verb, activity, since, until. */
  actorEmail?: string | null;
  verbId?: string | null;
  objectId?: string | null;
  since?: string | null;
  until?: string | null;
  limit: number;
}

export interface StoredStatement {
  id: string;
  actorName: string | null;
  actorEmail: string | null;
  verbId: string;
  verbDisplay: string;
  objectId: string;
  objectName: string | null;
  success: boolean | null;
  completion: boolean | null;
  scoreScaled: number | null;
  durationSeconds: number | null;
  timestamp: string;
  stored: string;
  voided: boolean;
  raw: unknown;
}

/**
 * Consulta statements.
 *
 * Os filtros são os que o padrão define para `GET /statements`. A ordem é por
 * `stored` DESC porque é assim que o padrão define a paginação — e porque
 * `timestamp` pode vir do passado num app offline, o que embaralharia a
 * sequência de quem sincroniza.
 */
export async function findStatements(q: StatementQuery): Promise<StoredStatement[]> {
  const rows = await query<{
    id: string;
    actor_name: string | null;
    actor_mbox: string | null;
    verb_id: string;
    verb_display: string;
    object_id: string;
    object_name: string | null;
    result_success: boolean | null;
    result_completion: boolean | null;
    result_score_scaled: string | null;
    result_duration_seconds: number | null;
    timestamp: Date;
    stored: Date;
    voided_by: string | null;
    raw: unknown;
  }>(
    `SELECT id, actor_name, actor_mbox, verb_id, verb_display,
            object_id, object_name, result_success, result_completion,
            result_score_scaled, result_duration_seconds,
            timestamp, stored, voided_by, raw
       FROM xapi_statements
      WHERE tenant_id = $1
        AND ($2::text IS NULL OR actor_mbox = $2)
        AND ($3::text IS NULL OR verb_id = $3)
        AND ($4::text IS NULL OR object_id = $4)
        AND ($5::timestamptz IS NULL OR stored >= $5)
        AND ($6::timestamptz IS NULL OR stored <= $6)
      ORDER BY stored DESC
      LIMIT $7`,
    [
      q.tenantId,
      q.actorEmail ?? null,
      q.verbId ?? null,
      q.objectId ?? null,
      q.since ?? null,
      q.until ?? null,
      q.limit,
    ],
  );

  return rows.map((row) => ({
    id: row.id,
    actorName: row.actor_name,
    actorEmail: row.actor_mbox,
    verbId: row.verb_id,
    verbDisplay: row.verb_display,
    objectId: row.object_id,
    objectName: row.object_name,
    success: row.result_success,
    completion: row.result_completion,
    /* `numeric` chega como texto. */
    scoreScaled: row.result_score_scaled === null ? null : Number(row.result_score_scaled),
    durationSeconds: row.result_duration_seconds,
    timestamp: row.timestamp.toISOString(),
    stored: row.stored.toISOString(),
    voided: row.voided_by !== null,
    raw: row.raw,
  }));
}

/** Um statement pelo id — `GET /statements?statementId=`. */
export async function findStatementById(
  tenantId: string,
  id: string,
): Promise<StoredStatement | null> {
  const rows = await query<{ raw: unknown; voided_by: string | null }>(
    `SELECT raw, voided_by FROM xapi_statements WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, id],
  );

  if (!rows[0]) return null;

  /* O statement volta COMO CHEGOU, do `raw`. Remontá-lo das colunas perderia
     as extensões que o padrão permite — e quem consulta espera receber o que
     mandou, inteiro. */
  return {
    ...(rows[0].raw as StoredStatement),
    id,
    voided: rows[0].voided_by !== null,
    raw: rows[0].raw,
  };
}

/**
 * Anula um statement — o `voiding` do padrão.
 *
 * Não apaga: marca. O statement anulado continua consultável e se declara
 * anulado, que é o que o padrão define.
 */
export async function voidStatement(
  tenantId: string,
  targetId: string,
  voidingId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE xapi_statements
        SET voided_by = $3
      WHERE tenant_id = $1 AND id = $2 AND voided_by IS NULL
      RETURNING id`,
    [tenantId, targetId, voidingId],
  );

  return rows.length > 0;
}

/** A pessoa daqui, pelo e-mail do statement. */
export async function resolveActor(
  tenantId: string,
  email: string | null,
): Promise<string | null> {
  if (!email) return null;

  const rows = await query<{ id: string }>(
    `SELECT id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
    [tenantId, email],
  );

  return rows[0]?.id ?? null;
}

export interface ActivitySummary {
  objectId: string;
  objectName: string | null;
  statements: number;
  actors: number;
  completions: number;
  /** Média do score escalado, quando houver. */
  averageScore: number | null;
  totalSeconds: number;
}

/**
 * O resumo por atividade — é o que transforma o LRS em relatório.
 *
 * Sem isto o xAPI seria um depósito: dados entram e ninguém consegue perguntar
 * nada. "Quantas pessoas rodaram a simulação, e como foram" é a pergunta que
 * justifica ter guardado.
 */
export async function activitySummary(
  tenantId: string,
  desde: string | null,
): Promise<ActivitySummary[]> {
  const rows = await query<{
    object_id: string;
    object_name: string | null;
    statements: string;
    actors: string;
    completions: string;
    media: string | null;
    segundos: string | null;
  }>(
    `SELECT object_id, max(object_name) AS object_name,
            count(*)                                      AS statements,
            count(DISTINCT COALESCE(actor_mbox, actor_id::text)) AS actors,
            count(*) FILTER (WHERE result_completion)     AS completions,
            avg(result_score_scaled)                      AS media,
            sum(result_duration_seconds)                  AS segundos
       FROM xapi_statements
      WHERE tenant_id = $1
        AND voided_by IS NULL
        AND ($2::timestamptz IS NULL OR stored >= $2)
      GROUP BY object_id
      ORDER BY count(*) DESC
      LIMIT 200`,
    [tenantId, desde],
  );

  return rows.map((row) => ({
    objectId: row.object_id,
    objectName: row.object_name,
    statements: Number(row.statements),
    actors: Number(row.actors),
    completions: Number(row.completions),
    averageScore: row.media === null ? null : Number(row.media),
    totalSeconds: Number(row.segundos ?? 0),
  }));
}

/**
 * O que acontece com os statements de quem pede exclusão de conta.
 *
 * NADA precisa ser feito aqui, e isso é uma decisão, não um esquecimento:
 *
 *   * `actor_id` é `ON DELETE SET NULL` — apagar a pessoa já desliga o vínculo.
 *   * O que ainda identificaria é `actor_mbox`, e o gatilho de imutabilidade
 *     recusa qualquer UPDATE que não seja anulação.
 *
 * A saída NÃO é afrouxar o gatilho: um LRS onde o e-mail dá para reescrever é
 * um LRS onde o statement dá para reescrever. A exclusão de conta limpa o
 * `actor_mbox` na mesma transação em que apaga a pessoa, com o gatilho
 * desabilitado por sessão — operação de administração do banco, deliberada e
 * registrada, não uma função de aplicação que qualquer caminho pode chamar.
 *
 * Enquanto essa rotina não existe, fica registrado no plano como lacuna da
 * LGPD para o F6-03. O statement em si — "alguém completou a simulação X" —
 * é anônimo depois do SET NULL e pode ficar.
 */
export const LGPD_NOTA_XAPI =
  "Statements guardam actor_mbox. A exclusão de conta desliga actor_id (SET NULL) " +
  "mas não limpa o e-mail: o gatilho de imutabilidade recusa UPDATE. Rotina " +
  "administrativa pendente — ver PLANO-LMS, F6-03.";

/**
 * Anonimiza os statements de uma pessoa — LGPD, direito à eliminação.
 *
 * Statement xAPI não se apaga: é registro do que aconteceu, e a própria
 * especificação o define assim. O que se faz é tirar quem era.
 *
 * Três coisas saem: o e-mail (`actor_mbox`), o nome (`actor_name`) e o e-mail
 * DENTRO do `raw` — o statement original recebido, que traz o ator no JSON.
 * Limpar as duas colunas e esquecer o `raw` seria anonimizar pela metade, e a
 * metade que fica é a que uma auditoria abriria primeiro.
 *
 * O que fica: verbo, objeto, resultado e data. "Alguém completou a simulação de
 * emergência em 12/03" continua verdadeiro e não identifica ninguém — e é o que
 * mantém honestos os números de uso de um treinamento que rodou de verdade.
 *
 * Chamada ANTES de excluir a conta: depois, `actor_id` já virou nulo e não há
 * como encontrar as linhas.
 */
export async function anonymizeActorStatements(
  tenantId: string,
  userId: string,
): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE xapi_statements
        SET actor_mbox = NULL,
            actor_name = NULL,
            /* O ator sai do JSON e a marca entra. A marca não é enfeite: é o
               que o gatilho exige para reconhecer esta escrita como
               anonimização, e o que responde "este statement foi anonimizado?"
               sem depender de o e-mail estar ausente por outro motivo. */
            raw = (raw - 'actor') || jsonb_build_object('anonimizado', true)
      WHERE tenant_id = $1
        AND actor_id = $2
      RETURNING id`,
    [tenantId, userId],
  );

  return rows.length;
}
