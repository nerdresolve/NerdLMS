import type { SessionUser } from "@nerdlms/core/auth/login.ts";

import { enabledDirectories } from "../ldap/ldap-repository.ts";
import { ldapLoginUseCase } from "../ldap/ldap-use-case.ts";
import { passwordLoginAllowed } from "../sso/sso-repository.ts";
import { loginUseCase } from "./login-use-case.ts";
import { findSessionUser } from "./sessions-repository.ts";

/**
 * A porta única do login.
 *
 * POR QUE ELA EXISTE
 *
 * A tela de login é uma só — dois campos e um botão. Por trás dela pode haver o
 * diretório da empresa ou a senha guardada aqui, e QUEM DECIDE ISSO É O
 * SERVIDOR. A alternativa seria a tela tentar um caminho, ver falhar e tentar
 * o outro; e aí a ordem em que se prova credencial passaria a ser definida por
 * JavaScript que qualquer pessoa edita no navegador.
 *
 * Também é o que evita pedir à pessoa que saiba qual botão é o dela. Quem entra
 * digita usuário e senha — os mesmos do computador da empresa — e não precisa
 * saber que existe um Active Directory no caminho.
 *
 * A ORDEM: DIRETÓRIO PRIMEIRO
 *
 * Onde há diretório, ele é a fonte da verdade sobre quem trabalha na empresa. A
 * senha local existe para quem não está lá — o instrutor terceirizado, a conta
 * de serviço de uma integração, o administrador que precisa entrar no dia em
 * que o diretório caiu.
 *
 * Tentar a senha local primeiro inverteria isso: quem tivesse uma senha antiga
 * guardada aqui entraria por ela mesmo depois de ser desligado no diretório —
 * que é exatamente o acesso que uma empresa mais quer cortar.
 */

export interface SignInCommand {
  identifier: string;
  password: string;
  remember: boolean;
  ip: string;
  userAgent: string | null;
  tenantId: string | null;
}

export type SignInOutcome =
  | { status: 200; user: SessionUser; token: string; expiresAt: Date }
  | { status: 400 | 401 | 403 | 429 | 502; error: string };

export async function signInUseCase(command: SignInCommand): Promise<SignInOutcome> {
  const diretorio = command.tenantId ? (await enabledDirectories(command.tenantId))[0] : undefined;

  /* Sem diretório ligado, nada muda: é o caminho de sempre, e é o que roda em
     desenvolvimento e em qualquer cliente que não tenha Active Directory. */
  if (!diretorio) return loginUseCase(command);

  const pelaRede = await ldapLoginUseCase({
    tenantId: diretorio.tenantId,
    directoryId: diretorio.id,
    usuario: command.identifier,
    senha: command.password,
    ip: command.ip,
    userAgent: command.userAgent,
  });

  if (pelaRede.status === 200) {
    const user = await findSessionUser(pelaRede.token);

    if (!user) {
      /* A sessão foi criada e não foi encontrada em seguida. Não deveria
         acontecer; se acontecer, dizer "usuário ou senha inválidos" mandaria a
         pessoa tentar de novo para sempre. */
      return { status: 502, error: "A sessão não pôde ser carregada. Tente de novo." };
    }

    return { status: 200, user, token: pelaRede.token, expiresAt: pelaRede.expiresAt };
  }

  /* O diretório recusou. A senha local ainda vale para este cliente? */
  const senhaLocalVale =
    command.tenantId !== null && (await passwordLoginAllowed(command.tenantId));

  if (!senhaLocalVale) return pelaRede;

  /* Diretório fora do ar é o caso em que a senha local mais importa: é o dia em
     que o administrador precisa entrar para consertar. Já `429` volta como
     está — o bloqueio por tentativa é por IP e vale para os dois caminhos, e
     tentar o segundo depois de estourar o teto no primeiro seria dar o dobro
     de chances a quem está adivinhando senha. */
  if (pelaRede.status === 429) return pelaRede;

  const local = await loginUseCase(command);

  if (local.status === 200) return local;

  /* As duas recusaram. Vale a mensagem do DIRETÓRIO, porque ela é a que diz
     algo: "sua conta da rede está bloqueada" resolve o chamado, e "usuário ou
     senha inválidos" da senha local só manda tentar de novo.

     A exceção é o diretório ter caído: aí a mensagem sobre o servidor não
     ajuda quem simplesmente errou a senha local. */
  return pelaRede.status === 502 ? local : pelaRede;
}
