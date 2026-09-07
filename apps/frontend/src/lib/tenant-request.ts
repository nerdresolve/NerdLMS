import "server-only";

import { headers } from "next/headers";

import type { TenantContext } from "@nerdlms/core/auth/login.ts";
import { findTenantByDomain, findTenantBySlug } from "@nerdlms/backend/tenancy/tenants-repository.ts";

/**
 * O tenant de uma requisição SEM sessão.
 *
 * Existe para os fluxos públicos — a página inicial e a recuperação de senha —
 * onde não há usuário logado de quem herdar o cliente. Sem isso, a landing
 * somaria os números de todas as empresas, e o link de redefinição poderia
 * cair na conta homônima de outro cliente (o e-mail é único por tenant desde a
 * migração 003).
 *
 * A resolução é por DOMÍNIO, que é como um white-label distingue visitantes:
 * quem chega por `treinamento.acme.com.br` é da ACME. Enquanto só houver um
 * cliente, o padrão cobre o domínio compartilhado.
 */

/** Slug usado quando o domínio não identifica ninguém. */
const TENANT_PADRAO = process.env.NERDRESOLVE_DEFAULT_TENANT ?? "lms";

export async function tenantOfRequest(): Promise<TenantContext | null> {
  const store = await headers();

  /* `x-forwarded-host` antes de `host`: atrás do proxy e do túnel, `host`
     chega como o nome interno do serviço, não o que a pessoa digitou. */
  const raw = store.get("x-forwarded-host") ?? store.get("host") ?? "";
  const domain = raw.split(":")[0]?.trim().toLowerCase() ?? "";

  if (domain) {
    const byDomain = await findTenantByDomain(domain);
    if (byDomain) return byDomain;
  }

  return findTenantBySlug(TENANT_PADRAO);
}
