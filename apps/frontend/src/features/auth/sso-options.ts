import "server-only";

import { enabledProviders } from "@nerdlms/backend/sso/sso-repository.ts";

import { tenantOfRequest } from "@/lib/tenant-request.ts";
import type { SsoOption } from "./sso-buttons.tsx";

/**
 * Os provedores que a tela de login deve oferecer.
 *
 * Devolve só o que o botão precisa. A configuração completa traz a chave
 * secreta do cliente, e nada garante que ela não vazasse para o HTML se o
 * objeto inteiro fosse parar numa prop — este recorte é o que impede isso de
 * ser possível por descuido.
 */
export async function ssoOptionsForLogin(): Promise<SsoOption[]> {
  const tenant = await tenantOfRequest();
  if (!tenant) return [];

  const provedores = await enabledProviders(tenant.id);

  return provedores.map((p) => ({
    id: p.id,
    provider: p.provider,
    displayName: p.displayName,
  }));
}
