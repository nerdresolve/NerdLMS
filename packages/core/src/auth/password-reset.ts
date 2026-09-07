/**
 * Regras da recuperação de senha.
 *
 * O token é de uso único e expira: as duas condições ficam no banco
 * (`used_at`, `expires_at`), e aqui mora a decisão sobre a senha nova e sobre
 * o que responder a cada situação.
 */

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../validation/login.ts";

export type ResetRefusal = "password_too_short" | "password_too_long" | "invalid_token";

export const RESET_REFUSAL_MESSAGE: Record<ResetRefusal, string> = {
  password_too_short: `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  password_too_long: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  /* Uma mensagem só para token inexistente, expirado e já usado: distinguir
     diria a quem tenta adivinhar se ele chegou perto. */
  invalid_token: "Este link expirou ou já foi utilizado. Peça um novo.",
};

export type ResetDecision = { ok: true; password: string } | { ok: false; reason: ResetRefusal };

/**
 * Valida a senha escolhida.
 *
 * Os limites são os mesmos do login — se a regra divergisse, alguém definiria
 * uma senha que depois não consegue usar para entrar.
 *
 * Espaços **não** são aparados: espaço é caractere válido de senha, e cortar
 * silenciosamente faria a pessoa digitar uma coisa e o sistema guardar outra.
 */
export function validateNewPassword(password: string): ResetDecision {
  if (password.length < PASSWORD_MIN_LENGTH) return { ok: false, reason: "password_too_short" };
  if (password.length > PASSWORD_MAX_LENGTH) return { ok: false, reason: "password_too_long" };

  return { ok: true, password };
}

/** Validade do link. Curta o bastante para limitar a janela de um vazamento. */
export const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * A resposta ao pedido de recuperação é sempre a mesma.
 *
 * Dizer "não encontramos este e-mail" transformaria o formulário num
 * verificador de contas: qualquer pessoa descobriria quem tem acesso à
 * plataforma testando endereços.
 */
export const RESET_REQUESTED_MESSAGE =
  "Se este e-mail estiver cadastrado, o link de redefinição chegará em instantes.";
