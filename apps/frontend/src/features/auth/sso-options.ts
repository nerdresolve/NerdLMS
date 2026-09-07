import "server-only";

import { enabledProviders } from "@nerdlms/backend/sso/sso-repository.ts";
import { enabledDirectories } from "@nerdlms/backend/ldap/ldap-repository.ts";
import { enabledSamlProvider } from "@nerdlms/backend/saml/saml-repository.ts";

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

  /* Em paralelo: são três leituras independentes, e a tela só rende com as
     três. Em série, quem abre o login esperaria a soma delas sem motivo. */
  const [oidc, diretorios, saml] = await Promise.all([
    enabledProviders(tenant.id),
    enabledDirectories(tenant.id),
    enabledSamlProvider(tenant.id),
  ]);

  const opcoes: SsoOption[] = oidc.map((p) => ({
    id: p.id,
    provider: p.provider,
    displayName: p.displayName,
    kind: "oidc",
  }));

  /* O LDAP é o único que pede SENHA na nossa tela — não há ida ao provedor.
     Por isso ele não é um link: o botão abre um formulário. O `kind` é o que
     diz isso à tela, e sem ele o clique levaria a uma rota que espera POST. */
  for (const d of diretorios) {
    opcoes.push({ id: d.id, provider: d.kind, displayName: d.displayName, kind: "ldap" });
  }

  if (saml) {
    opcoes.push({ id: saml.id, provider: "saml", displayName: saml.displayName, kind: "saml" });
  }

  return opcoes;
}
