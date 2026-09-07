import "server-only";

import { enabledDirectories } from "@nerdlms/backend/ldap/ldap-repository.ts";
import { passwordLoginAllowed } from "@nerdlms/backend/sso/sso-repository.ts";

import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * O que a tela de login precisa saber sobre COMO se entra neste cliente.
 *
 * Os campos são os mesmos nos dois casos — usuário e senha. O que muda é o que
 * eles significam, e a tela precisa dizer isso: pedir "sua senha" a quem deve
 * digitar a senha do computador da empresa é a diferença entre entrar de
 * primeira e abrir um chamado.
 *
 * NÃO decide o caminho da autenticação. Isso é `signInUseCase`, no servidor —
 * aqui só sai texto. Se este recorte fosse a decisão, bastaria adulterá-lo no
 * navegador para escolher contra o que a senha é conferida.
 */

export interface LoginMode {
  /** O diretório ligado, quando há um. Só o nome, para a tela. */
  diretorio: string | null;
  /** A senha guardada aqui ainda vale para este cliente. */
  senhaLocal: boolean;
}

export async function loginMode(): Promise<LoginMode> {
  const tenant = await tenantOfRequest();

  /* Sem cliente identificado, o comportamento é o de sempre: senha local. O
     contrário trancaria a tela por causa de um cabeçalho ausente. */
  if (!tenant) return { diretorio: null, senhaLocal: true };

  const [diretorios, senhaLocal] = await Promise.all([
    enabledDirectories(tenant.id),
    passwordLoginAllowed(tenant.id),
  ]);

  return {
    diretorio: diretorios[0]?.displayName ?? null,
    senhaLocal,
  };
}
