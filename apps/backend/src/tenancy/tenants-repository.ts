import type { TenantContext } from "@nerdlms/core/auth/login.ts";

import { query } from "../db/pool.ts";

/**
 * Consultas de tenant.
 *
 * O tenant normalmente chega junto da sessão, por JOIN — é o caminho quente e
 * não justifica uma segunda ida ao banco. Este módulo existe para os casos em
 * que não há sessão ainda: o atalho de desenvolvimento e, adiante, a
 * resolução por domínio.
 */

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  unit_label: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  brand_color: string | null;
}

function toTenant(row: TenantRow): TenantContext {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    unitLabel: row.unit_label,
    branding: {
      logoLightUrl: row.logo_light_url,
      logoDarkUrl: row.logo_dark_url,
      faviconUrl: row.favicon_url,
      brandColor: row.brand_color,
    },
  };
}

export async function findTenantBySlug(slug: string): Promise<TenantContext | null> {
  const rows = await query<TenantRow>(
    `SELECT id, slug, name, unit_label, logo_light_url, logo_dark_url, favicon_url, brand_color
       FROM tenants WHERE slug = $1 AND status = 'active' LIMIT 1`,
    [slug],
  );
  const row = rows[0];
  return row ? toTenant(row) : null;
}

/**
 * Tenant pelo domínio da requisição.
 *
 * É como um white-label decide de quem é a visita antes de haver login: o
 * cliente com domínio próprio cai no seu tenant, e quem usa o domínio
 * compartilhado não resolve por aqui.
 */
export async function findTenantByDomain(domain: string): Promise<TenantContext | null> {
  const rows = await query<TenantRow>(
    `SELECT id, slug, name, unit_label, logo_light_url, logo_dark_url, favicon_url, brand_color
       FROM tenants WHERE domain = $1 AND status = 'active' LIMIT 1`,
    [domain],
  );
  const row = rows[0];
  return row ? toTenant(row) : null;
}

/**
 * Atualiza a identidade visual do cliente.
 *
 * Só os campos informados mudam: passar `undefined` não é o mesmo que passar
 * `null`. `null` limpa e volta ao padrão do produto; ausente deixa como está.
 * Sem essa distinção, salvar só a cor apagaria a logo.
 */
export async function updateTenantBranding(
  tenantId: string,
  branding: {
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    faviconUrl?: string | null;
    brandColor?: string | null;
    mailFromName?: string | null;
    mailFromEmail?: string | null;
  },
): Promise<void> {
  const colunas: Record<string, string> = {
    logoLightUrl: "logo_light_url",
    logoDarkUrl: "logo_dark_url",
    faviconUrl: "favicon_url",
    brandColor: "brand_color",
    mailFromName: "mail_from_name",
    mailFromEmail: "mail_from_email",
  };

  const sets: string[] = [];
  const valores: unknown[] = [tenantId];

  for (const [campo, coluna] of Object.entries(colunas)) {
    const valor = branding[campo as keyof typeof branding];
    if (valor === undefined) continue;

    valores.push(valor === "" ? null : valor);
    sets.push(`${coluna} = $${valores.length}`);
  }

  if (sets.length === 0) return;

  await query(
    `UPDATE tenants SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`,
    valores,
  );
}
