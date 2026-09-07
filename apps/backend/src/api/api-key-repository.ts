import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { isValidKeyFormat } from "@nerdlms/core/api/keys.ts";

import { query } from "../db/pool.ts";

/**
 * Chaves de API — F5-01.
 *
 * A CHAVE EM TEXTO EXISTE UMA VEZ SÓ, no instante em que é criada. O banco
 * guarda o hash — uma chave que o banco conhece é uma chave que vaza com o
 * banco, e diferente de senha ela não tem dono para trocá-la quando isso
 * acontece.
 */

/** SHA-256 e não Argon2, ao contrário da senha.
 *
 * A diferença é a entropia: uma senha humana tem talvez 40 bits e precisa de
 * um hash lento para resistir a força bruta. Esta chave tem 192 bits de
 * aleatoriedade criptográfica — força bruta é impossível, e um hash lento
 * custaria centenas de milissegundos em TODA requisição da API.
 */
function hashKey(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

export interface CreatedKey {
  id: string;
  /** O texto completo. Só aparece aqui, nunca mais. */
  key: string;
  prefix: string;
}

/**
 * Cria uma chave.
 *
 * 24 bytes = 48 hexadecimais = 192 bits. `randomBytes` é o gerador
 * criptográfico do sistema — `Math.random()` seria previsível e a chave,
 * adivinhável.
 */
export async function createApiKey(input: {
  tenantId: string;
  name: string;
  scopes: string[];
  createdBy: string;
}): Promise<CreatedKey> {
  const chave = `aeg_${randomBytes(24).toString("hex")}`;
  const prefixo = chave.slice(0, 12);

  const rows = await query<{ id: string }>(
    `INSERT INTO api_keys (tenant_id, name, key_hash, key_prefix, scopes, created_by)
     VALUES ($1, btrim($2), $3, $4, $5, $6)
     RETURNING id`,
    [input.tenantId, input.name, hashKey(chave), prefixo, input.scopes, input.createdBy],
  );

  return { id: rows[0]!.id, key: chave, prefix: prefixo };
}

export interface ApiKeyIdentity {
  id: string;
  tenantId: string;
  scopes: string[];
}

/**
 * Quem é esta chave?
 *
 * Devolve `null` para chave inválida, desconhecida ou revogada — os três casos
 * com a mesma resposta, para não dizer a quem tenta se a chave existe.
 */
export async function authenticateApiKey(chave: string): Promise<ApiKeyIdentity | null> {
  /* Formato primeiro: recusar lixo sem ir ao banco. */
  if (!isValidKeyFormat(chave)) return null;

  const hash = hashKey(chave);

  const rows = await query<{
    id: string;
    tenant_id: string;
    scopes: string[];
    key_hash: string;
  }>(
    `SELECT id, tenant_id, scopes, key_hash
       FROM api_keys
      WHERE key_hash = $1 AND revoked_at IS NULL
      LIMIT 1`,
    [hash],
  );

  const row = rows[0];
  if (!row) return null;

  /* Comparação em tempo constante.

     A busca já foi por igualdade no índice, então o vazamento aqui é teórico —
     mas a comparação custa nada e a alternativa é raciocinar sobre o que o
     Postgres faz internamente. */
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(row.key_hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  /* O último uso é gravado sem esperar: a resposta da API não deve atrasar
     por causa de telemetria. */
  void query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => {
    /* Falhar aqui não pode derrubar a requisição autenticada. */
  });

  return { id: row.id, tenantId: row.tenant_id, scopes: row.scopes };
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export async function findApiKeys(tenantId: string): Promise<ApiKeySummary[]> {
  const rows = await query<{
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    created_at: Date;
    last_used_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT id, name, key_prefix, scopes, created_at, last_used_at, revoked_at
       FROM api_keys
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
    [tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    scopes: row.scopes,
    createdAt: row.created_at.toISOString(),
    revoked: row.revoked_at !== null,
    ...(row.last_used_at ? { lastUsedAt: row.last_used_at.toISOString() } : {}),
  }));
}

/**
 * Revoga.
 *
 * Não apaga: o histórico de uso continua fazendo sentido, e apagar impediria
 * auditar o que aquela chave fez enquanto valia.
 */
export async function revokeApiKey(id: string, tenantId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE api_keys SET revoked_at = now()
      WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
      RETURNING id`,
    [id, tenantId],
  );

  return rows.length > 0;
}
