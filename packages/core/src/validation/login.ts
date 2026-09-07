/**
 * Validação da entrada de login.
 *
 * Este módulo é a regra única, compartilhada entre backend e frontend.
 *: a validação do frontend é apenas UX; o backend precisa
 * executar exatamente as mesmas regras antes de tocar no banco.
 *
 * Sem dependências externas.
 */

export const IDENTIFIER_MAX_LENGTH = 254;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const PASSWORD_MIN_LENGTH = 8;
/**
 * Limite superior obrigatório: entradas muito longas viram custo de CPU no
 * hash (Argon2id) e são um vetor de DoS barato./§16.
 */
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export type LoginField = "identifier" | "password";

export interface LoginInput {
  identifier: string;
  password: string;
  remember?: boolean;
}

export interface NormalizedLogin {
  identifier: string;
  identifierKind: "email" | "username";
  password: string;
  remember: boolean;
}

export type LoginValidation =
  | { ok: true; value: NormalizedLogin }
  | { ok: false; errors: Partial<Record<LoginField, string>> };

/** Mensagens em pt-BR. Nenhuma revela se a conta existe. */
export const LOGIN_MESSAGES = {
  identifierRequired: "Informe seu email ou usuário.",
  identifierTooLong: "Email ou usuário excede o tamanho permitido.",
  emailInvalid: "Verifique o formato do email.",
  usernameTooShort: `O usuário precisa ter ao menos ${USERNAME_MIN_LENGTH} caracteres.`,
  usernameTooLong: `O usuário pode ter no máximo ${USERNAME_MAX_LENGTH} caracteres.`,
  usernameInvalid: "Use apenas letras, números, ponto, hífen ou sublinhado.",
  passwordRequired: "Informe sua senha.",
  passwordTooShort: `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  passwordTooLong: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  /** Resposta única para credencial inválida OU conta inexistente. */
  credentialsInvalid: "Email/usuário ou senha incorretos.",
} as const;

function validateIdentifier(raw: unknown): { error: string } | { value: string; kind: "email" | "username" } {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (value.length === 0) return { error: LOGIN_MESSAGES.identifierRequired };
  if (value.length > IDENTIFIER_MAX_LENGTH) return { error: LOGIN_MESSAGES.identifierTooLong };

  if (value.includes("@")) {
    if (!EMAIL_PATTERN.test(value)) return { error: LOGIN_MESSAGES.emailInvalid };
    return { value: value.toLowerCase(), kind: "email" };
  }

  if (value.length < USERNAME_MIN_LENGTH) return { error: LOGIN_MESSAGES.usernameTooShort };
  if (value.length > USERNAME_MAX_LENGTH) return { error: LOGIN_MESSAGES.usernameTooLong };
  if (!USERNAME_PATTERN.test(value)) return { error: LOGIN_MESSAGES.usernameInvalid };

  return { value: value.toLowerCase(), kind: "username" };
}

function validatePassword(raw: unknown): { error: string } | { value: string } {
  // A senha nunca é aparada: espaços podem ser parte legítima do segredo.
  const value = typeof raw === "string" ? raw : "";

  if (value.length === 0) return { error: LOGIN_MESSAGES.passwordRequired };
  if (value.length < PASSWORD_MIN_LENGTH) return { error: LOGIN_MESSAGES.passwordTooShort };
  if (value.length > PASSWORD_MAX_LENGTH) return { error: LOGIN_MESSAGES.passwordTooLong };

  return { value };
}

/**
 * Valida e normaliza a entrada de login.
 * Aceita `unknown` porque o backend recebe corpo de requisição não confiável.
 */
export function validateLoginInput(input: unknown): LoginValidation {
  const source = (typeof input === "object" && input !== null ? input : {}) as Partial<LoginInput>;

  const identifier = validateIdentifier(source.identifier);
  const password = validatePassword(source.password);

  const errors: Partial<Record<LoginField, string>> = {};
  if ("error" in identifier) errors.identifier = identifier.error;
  if ("error" in password) errors.password = password.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      identifier: (identifier as { value: string }).value,
      identifierKind: (identifier as { kind: "email" | "username" }).kind,
      password: (password as { value: string }).value,
      remember: source.remember === true,
    },
  };
}
