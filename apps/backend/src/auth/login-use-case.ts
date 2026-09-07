import { authenticate, LOGIN_FAILURE_MESSAGE, type SessionUser } from "@nerdlms/core/auth/login.ts";
import { validateLoginInput } from "@nerdlms/core/validation/login.ts";

import { findAccountByIdentifier, touchLastAccess } from "./users-repository.ts";
import { createSession, recentFailures, recordLoginAttempt } from "./sessions-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Caso de uso do login.
 *
 * Concentra a sequência inteira — validar, checar bloqueio, buscar, decidir,
 * registrar, emitir sessão — para que a rota HTTP não precise conhecer nenhuma
 * dessas etapas. É a divisão de controller magro / serviço gordo do SCE API:
 * o `route.ts` traduz HTTP, e todo o resto acontece aqui.
 *
 * Não depende de `Request`, `Response` nem de cookie: recebe dados simples e
 * devolve dados simples. É o que permite testar sem subir servidor, e o que
 * deixa este arquivo intacto se um dia a API sair do Next.
 */

/** Acima disto, o IP espera. Trava força bruta sem depender de serviço externo. */
const MAX_FAILURES_PER_IP = 10;

export interface LoginCommand {
  identifier: string;
  password: string;
  remember: boolean;
  ip: string;
  userAgent: string | null;
}

export type LoginOutcome =
  | { status: 200; user: SessionUser; token: string; expiresAt: Date }
  | { status: 400 | 401 | 429; error: string };

export async function loginUseCase(command: LoginCommand): Promise<LoginOutcome> {
  /* A MESMA validação que o formulário roda no cliente. O cliente valida para
     dar resposta rápida; o servidor valida porque o cliente é adulterável. */
  const valid = validateLoginInput({
    identifier: command.identifier,
    password: command.password,
  });
  if (!valid.ok) {
    return { status: 400, error: "Usuário ou senha inválidos." };
  }

  if ((await recentFailures(command.ip)) >= MAX_FAILURES_PER_IP) {
    return { status: 429, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const account = await findAccountByIdentifier(command.identifier);
  const result = authenticate(account, command.password);

  await recordLoginAttempt(command.identifier, command.ip, result.ok);

  /* `login_attempts` serve ao bloqueio por força bruta; a auditoria serve à
     pergunta "de onde esta conta entrou". São tabelas diferentes porque
     respondem coisas diferentes, e a primeira é limpa periodicamente. */
  if (!result.ok) {
    await recordAudit({
      actorId: account?.id ?? null,
      actorName: account?.fullName ?? command.identifier,
      action: "login_failed",
      target: command.identifier,
      outcome: "denied",
      ip: command.ip,
    });

    /* Mensagem genérica: não distingue conta inexistente de senha errada. */
    return { status: 401, error: LOGIN_FAILURE_MESSAGE[result.reason] };
  }

  const session = await createSession(result.user.id, {
    remember: command.remember,
    userAgent: command.userAgent,
    ip: command.ip,
  });
  await touchLastAccess(result.user.id);

  await recordAudit({
    actorId: result.user.id,
    actorName: result.user.fullName,
    action: "login",
    target: result.user.email ?? result.user.id,
    outcome: "allowed",
    ip: command.ip,
  });

  return { status: 200, user: result.user, token: session.token, expiresAt: session.expiresAt };
}
