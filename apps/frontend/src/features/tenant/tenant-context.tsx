"use client";

import { createContext, useContext } from "react";

import type { TenantContext as Tenant } from "@nerdlms/core/auth/login.ts";
import { lowerUnit, pluralOfUnit } from "@nerdlms/core/tenancy/unit-label.ts";

/**
 * O cliente da sessão, disponível às telas.
 *
 * Existe por causa do vocabulário: um cliente chama suas unidades de
 * "Concessionária", uma rede de varejo chamaria de "Filial". A palavra estava
 * escrita no JSX — "Projeto" em cinco lugares — e num white-label isso é o
 * mesmo que fixar o nome de um cliente no produto.
 *
 * É contexto, e não prop atravessando a árvore, porque o rótulo aparece em
 * telas que não têm relação entre si (filtro de relatório, convite, tabela de
 * usuários). Passar por prop obrigaria cada página intermediária a repassar
 * algo que não usa.
 */
const TenantCtx = createContext<Tenant | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: Tenant;
  children: React.ReactNode;
}) {
  return <TenantCtx.Provider value={tenant}>{children}</TenantCtx.Provider>;
}

/**
 * O rótulo da unidade organizacional deste cliente.
 *
 * Cai em "Unidade" fora do provider — termo neutro que não mente sobre a
 * estrutura de ninguém. Sem esse padrão, um componente usado antes do provider
 * quebraria a tela por causa de uma palavra.
 */
export function useUnitLabel(): string {
  return useContext(TenantCtx)?.unitLabel ?? "Unidade";
}

export function useTenant(): Tenant | null {
  return useContext(TenantCtx);
}

/** O rótulo no plural, para o meio de uma frase. A regra vive no domínio. */
export function useUnitLabelPlural(): string {
  return pluralOfUnit(useUnitLabel());
}

/** O rótulo em minúsculas, para o meio de uma frase. */
export function useUnitLabelLower(): string {
  return lowerUnit(useUnitLabel());
}
