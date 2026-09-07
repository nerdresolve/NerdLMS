/**
 * Regras de convite e edição de usuário.
 *
 * O convite não define senha: cria a conta com `password_hash` nulo, que é o
 * estado "pendente" do schema. Quem escolhe a senha é a própria pessoa, no
 * primeiro acesso — um administrador que digita a senha de outro sabe a senha
 * de outro.
 */

import type { Role } from "./permissions.ts";

export const NAME_MAX_LENGTH = 200;
export const EMAIL_MAX_LENGTH = 254;

export type UserRefusal =
  | "name_required"
  | "name_too_long"
  | "email_required"
  | "email_invalid"
  | "email_too_long"
  | "manager_needs_project"
  | "cannot_demote_self";

export const USER_REFUSAL_MESSAGE: Record<UserRefusal, string> = {
  name_required: "Informe o nome da pessoa.",
  name_too_long: `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
  email_required: "Informe o e-mail.",
  email_invalid: "E-mail inválido.",
  email_too_long: `O e-mail pode ter no máximo ${EMAIL_MAX_LENGTH} caracteres.`,
  manager_needs_project: "Um gestor precisa de projeto: sem ele, não há recorte para os relatórios.",
  cannot_demote_self: "Você não pode remover o próprio acesso de administrador.",
};

export interface UserInvite {
  fullName: string;
  email: string;
  role: Role;
  project?: string | undefined;
}

export type UserDecision =
  | { ok: true; fullName: string; email: string; role: Role; project: string | null }
  | { ok: false; reason: UserRefusal };

/** Formato de e-mail, no mesmo critério da validação de login. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Valida um convite ou uma edição de cadastro.
 *
 * **Gestor sem projeto é recusado.** O schema já impõe isso
 * (`users_manager_needs_project`), e repetir a regra aqui transforma um erro de
 * constraint numa frase que a pessoa entende.
 */
export function validateUser(input: UserInvite): UserDecision {
  const profile = validateProfile(input);
  if (!profile.ok) return profile;

  const email = input.email.trim().toLowerCase();
  if (email.length === 0) return { ok: false, reason: "email_required" };
  if (email.length > EMAIL_MAX_LENGTH) return { ok: false, reason: "email_too_long" };
  if (!looksLikeEmail(email)) return { ok: false, reason: "email_invalid" };

  return { ...profile, email };
}

export type ProfileDecision =
  | { ok: true; fullName: string; role: Role; project: string | null }
  | { ok: false; reason: UserRefusal };

/**
 * Valida nome, papel e projeto — o que a **edição** altera.
 *
 * O e-mail fica de fora porque editar cadastro não troca endereço: trocar
 * e-mail é mudar a identidade de acesso, e merece fluxo próprio com
 * confirmação. Sem esta separação, a edição precisaria inventar um e-mail
 * só para satisfazer o validador.
 */
export function validateProfile(input: Omit<UserInvite, "email">): ProfileDecision {
  const fullName = input.fullName.trim();

  if (fullName.length === 0) return { ok: false, reason: "name_required" };
  if (fullName.length > NAME_MAX_LENGTH) return { ok: false, reason: "name_too_long" };

  const project = input.project?.trim() || null;
  if (input.role === "manager" && !project) {
    return { ok: false, reason: "manager_needs_project" };
  }

  return { ok: true, fullName, role: input.role, project };
}

/**
 * Impede que um administrador remova o próprio acesso.
 *
 * Não é paternalismo: um sistema com zero administradores não tem como voltar
 * a ter um, e a recuperação exigiria mexer no banco à mão.
 */
export function canChangeOwnRole(actorId: string, targetId: string, newRole: Role): boolean {
  if (actorId !== targetId) return true;
  return newRole === "admin";
}
