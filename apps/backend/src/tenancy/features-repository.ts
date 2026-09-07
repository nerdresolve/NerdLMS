import { resolveFeatures } from "@nerdlms/core/tenancy/features.ts";

import { query } from "../db/pool.ts";

/**
 * As escolhas de funcionalidade de um cliente.
 *
 * A tabela guarda só o que foi MEXIDO; o resto vem do padrão do catálogo. É
 * isso que permite acrescentar funcionalidade nova sem escrever uma linha para
 * cada tenant existente.
 */

/** O que o cliente escolheu, sem resolver herança. */
export async function findFeatureOverrides(tenantId: string): Promise<Map<string, boolean>> {
  const rows = await query<{ feature: string; enabled: boolean }>(
    `SELECT feature, enabled FROM tenant_features WHERE tenant_id = $1`,
    [tenantId],
  );

  return new Map(rows.map((row) => [row.feature, row.enabled]));
}

/**
 * O estado final de todas as chaves, com herança aplicada.
 *
 * É o que a sessão carrega: com o mapa pronto, cada página consulta por
 * leitura, sem subir a árvore de novo nem voltar ao banco.
 */
export async function findTenantFeatures(tenantId: string): Promise<Map<string, boolean>> {
  return resolveFeatures(await findFeatureOverrides(tenantId));
}

/**
 * Grava a escolha do cliente.
 *
 * `enabled = null` APAGA a linha em vez de gravar: voltar ao padrão do
 * catálogo é diferente de fixar o valor que o padrão tem hoje. Se o padrão
 * mudar amanhã, quem voltou ao padrão acompanha; quem fixou, não.
 */
export async function setTenantFeature(
  tenantId: string,
  feature: string,
  enabled: boolean | null,
): Promise<void> {
  if (enabled === null) {
    await query(`DELETE FROM tenant_features WHERE tenant_id = $1 AND feature = $2`, [
      tenantId,
      feature,
    ]);
    return;
  }

  await query(
    `INSERT INTO tenant_features (tenant_id, feature, enabled)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, feature)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
    [tenantId, feature, enabled],
  );
}
