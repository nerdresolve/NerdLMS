import { can, type Actor, type Role } from "@nerdlms/core/auth/permissions.ts";
import {
  NAME_MAX_LENGTH,
  USER_REFUSAL_MESSAGE,
  canChangeOwnRole,
  validateProfile,
  validateUser,
} from "@nerdlms/core/auth/user-management.ts";

import {
  findUserRole,
  inviteUser,
  setUserStatus,
  updateOwnProfile,
  updateUser,
} from "./user-admin-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Casos de uso da gestão de usuários.
 *
 * O gestor enxerga e convida gente do **próprio projeto**; o admin, todo
 * mundo. A checagem usa `kind: "user"` com o projeto do alvo — passar o
 * projeto do ator deixaria um gestor editar qualquer pessoa.
 */

/** Falha comum às três operações. */
export type UserAdminFailure = { status: 400 | 403 | 404 | 409; error: string };

export type InviteOutcome = { status: 201; userId: string } | UserAdminFailure;
export type UserWriteOutcome = { status: 200 } | UserAdminFailure;

export interface InviteCommand {
  actor: Actor;
  /** Nome de quem age, para o registro de auditoria. `Actor` só carrega id. */
  actorName: string;
  fullName: string;
  email: string;
  role: Role;
  project?: string | undefined;
}

export async function inviteUserUseCase(command: InviteCommand): Promise<InviteOutcome> {
  const validated = validateUser({
    fullName: command.fullName,
    email: command.email,
    role: command.role,
    project: command.project,
  });

  if (!validated.ok) {
    return { status: 400, error: USER_REFUSAL_MESSAGE[validated.reason] };
  }

  /* A permissão é avaliada sobre o projeto de DESTINO: um gestor de Siririzinho
     não convida ninguém para Unidade Norte. */
  const allowed = can(command.actor, "create", {
    kind: "user",
    ...(validated.project ? { project: validated.project } : {}),
  });
  if (!allowed) {
    return { status: 403, error: "Sem permissão para convidar esta pessoa." };
  }

  /* Sem tenant não há onde convidar: a pessoa nasceria órfã, e a coluna é
     NOT NULL. */
  if (!command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para convidar esta pessoa." };
  }

  const result = await inviteUser({
    tenantId: command.actor.tenantId,
    fullName: validated.fullName,
    email: validated.email,
    role: validated.role,
    project: validated.project,
  });

  if (!result.ok) {
    return { status: 409, error: "Já existe uma conta com este e-mail." };
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "user_invited",
    target: validated.email,
    outcome: "allowed",
  });

  return { status: 201, userId: result.userId };
}

export interface UpdateUserCommand {
  actor: Actor;
  actorName: string;
  userId: string;
  fullName: string;
  role: Role;
  project?: string | undefined;
}

export async function updateUserUseCase(command: UpdateUserCommand): Promise<UserWriteOutcome> {
  const target = await findUserRole(command.userId);
  if (!target) return { status: 404, error: "Usuário não encontrado." };

  const validated = validateProfile({
    fullName: command.fullName,
    role: command.role,
    project: command.project,
  });
  if (!validated.ok) {
    return { status: 400, error: USER_REFUSAL_MESSAGE[validated.reason] };
  }

  /* Duas checagens de projeto: quem a pessoa é HOJE e o que ela viraria. Sem a
     primeira, um gestor moveria alguém de outro projeto para o dele. */
  const allowedOnTarget = can(command.actor, "update", {
    kind: "user",
    ...(target.project ? { project: target.project } : {}),
  });
  const allowedOnResult = can(command.actor, "update", {
    kind: "user",
    ...(validated.project ? { project: validated.project } : {}),
  });

  if (!allowedOnTarget || !allowedOnResult) {
    return { status: 403, error: "Sem permissão para editar esta pessoa." };
  }

  if (!canChangeOwnRole(command.actor.id, command.userId, validated.role)) {
    return { status: 400, error: USER_REFUSAL_MESSAGE.cannot_demote_self };
  }

  await updateUser({
    userId: command.userId,
    fullName: validated.fullName,
    role: validated.role,
    project: validated.project,
  });

  /* Só mudança de papel entra na auditoria: renomear alguém é rotina, promover
     a administrador é o que precisa deixar rastro (SENSITIVE_ACTIONS). */
  if (target.role !== validated.role) {
    await recordAudit({
      actorId: command.actor.id,
      actorName: command.actorName,
      action: "role_changed",
      target: `${validated.fullName}: ${target.role} → ${validated.role}`,
      outcome: "allowed",
    });
  }

  return { status: 200 };
}

export interface StatusCommand {
  actor: Actor;
  actorName: string;
  userId: string;
  active: boolean;
}

export async function setUserStatusUseCase(command: StatusCommand): Promise<UserWriteOutcome> {
  const target = await findUserRole(command.userId);
  if (!target) return { status: 404, error: "Usuário não encontrado." };

  const allowed = can(command.actor, "update", {
    kind: "user",
    ...(target.project ? { project: target.project } : {}),
  });
  if (!allowed) {
    return { status: 403, error: "Sem permissão para alterar esta pessoa." };
  }

  /* Desativar a si mesmo tem o mesmo problema de se rebaixar: quem sai não
     consegue voltar para desfazer. */
  if (command.actor.id === command.userId && !command.active) {
    return { status: 400, error: "Você não pode desativar a própria conta." };
  }

  await setUserStatus(command.userId, command.active);

  if (!command.active) {
    await recordAudit({
      actorId: command.actor.id,
      actorName: command.actorName,
      action: "user_deactivated",
      target: command.userId,
      outcome: "allowed",
    });
  }

  return { status: 200 };
}

export interface UpdateOwnProfileCommand {
  actor: Actor;
  fullName: string;
}

/**
 * Edição do próprio perfil.
 *
 * Separado de `updateUserUseCase` porque a pergunta de permissão é outra:
 * lá é "este gestor pode editar aquela pessoa?", aqui é "esta pessoa é ela
 * mesma?". A resposta vem do id da sessão, não do corpo da requisição — se o
 * alvo viesse do corpo, bastaria trocar o id para editar outra conta.
 *
 * Não passa por `validateProfile` inteiro: aquela função também decide papel e
 * projeto, que aqui não mudam. Reaproveitar por reaproveitar exigiria informar
 * um papel, e um papel no corpo é exatamente o que não pode existir.
 */
export async function updateOwnProfileUseCase(
  command: UpdateOwnProfileCommand,
): Promise<UserWriteOutcome> {
  const fullName = command.fullName.trim();

  if (fullName.length === 0) return { status: 400, error: USER_REFUSAL_MESSAGE.name_required };
  if (fullName.length > NAME_MAX_LENGTH) {
    return { status: 400, error: USER_REFUSAL_MESSAGE.name_too_long };
  }

  const updated = await updateOwnProfile(command.actor.id, fullName);
  if (!updated) return { status: 404, error: "Usuário não encontrado." };

  /* Fora da auditoria: trocar o próprio nome é rotina, e a auditoria existe
     para o que muda poder (SENSITIVE_ACTIONS). */
  return { status: 200 };
}
