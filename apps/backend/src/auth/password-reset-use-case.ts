import { hashPassword } from "@nerdlms/core/auth/password.ts";
import {
  RESET_REFUSAL_MESSAGE,
  RESET_REQUESTED_MESSAGE,
  validateNewPassword,
} from "@nerdlms/core/auth/password-reset.ts";

import {
  consumeResetToken,
  createResetToken,
  findUserByEmail,
  setPassword,
} from "./password-reset-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";
import { resetPasswordMail, sendMail } from "../notifications/mailer.ts";

/**
 * Recuperação de senha.
 *
 * O pedido responde sempre igual, exista o e-mail ou não: a diferença
 * transformaria o formulário num verificador de contas.
 */

export interface RequestCommand {
  email: string;
  /**
   * O cliente de quem pede. Resolvido pelo domínio da requisição — o e-mail é
   * único POR TENANT desde a migração 003, então sem isto o link poderia ir
   * para a conta homônima de outra empresa.
   */
  tenantId: string;
  /** O nome do cliente, para o e-mail chegar com a marca de quem o mandou. */
  tenantName?: string;
  /** Base do link, para montar a URL de redefinição. */
  origin: string;
  ip?: string | undefined;
}

/** Sempre 200 com a mesma mensagem — o resultado real fica no log/e-mail. */
export async function requestResetUseCase(
  command: RequestCommand,
): Promise<{ status: 200; message: string }> {
  const user = await findUserByEmail(command.tenantId, command.email);

  if (user) {
    const { token } = await createResetToken(user.id);
    const link = `${command.origin}/redefinir-senha?token=${encodeURIComponent(token)}`;

    await sendMail(resetPasswordMail(user.email, user.fullName, link, command.tenantName));
  }

  /* O tempo de resposta difere entre existir e não existir — quem procura essa
     diferença mede. Aceitável aqui: o pedido é raro e limitado por IP, ao
     contrário do login, onde o custo de comparação é igualado de propósito. */
  return { status: 200, message: RESET_REQUESTED_MESSAGE };
}

export interface ConfirmCommand {
  token: string;
  password: string;
  ip?: string | undefined;
}

export type ConfirmOutcome = { status: 200 } | { status: 400; error: string };

/** Consome o token e define a senha. */
export async function confirmResetUseCase(command: ConfirmCommand): Promise<ConfirmOutcome> {
  const validated = validateNewPassword(command.password);
  if (!validated.ok) {
    return { status: 400, error: RESET_REFUSAL_MESSAGE[validated.reason] };
  }

  /* Consumir antes de gravar: o token é usado uma vez mesmo que a gravação
     falhe depois, e um link que sobrevive ao erro é um link reutilizável. */
  const userId = await consumeResetToken(command.token);
  if (!userId) {
    return { status: 400, error: RESET_REFUSAL_MESSAGE.invalid_token };
  }

  await setPassword(userId, hashPassword(validated.password));

  await recordAudit({
    actorId: userId,
    actorName: "(redefinição de senha)",
    action: "password_reset",
    target: "senha redefinida pelo próprio usuário",
    outcome: "allowed",
    ip: command.ip ?? null,
  });

  return { status: 200 };
}
