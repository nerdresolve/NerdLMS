import {
  inviteUserUseCase,
  setUserStatusUseCase,
  updateUserUseCase,
} from "@nerdlms/backend/auth/user-admin-use-case.ts";
import type { Role } from "@nerdlms/core/auth/permissions.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/usuarios — convida uma pessoa.
 * PATCH /api/usuarios — edita cadastro, ou ativa/desativa.
 */

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["admin", "manager", "instructor", "learner"];
const isRole = (value: unknown): value is Role =>
  typeof value === "string" && ROLES.includes(value as Role);

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isRole(body.role)) {
    return Response.json({ error: "Papel inválido." }, { status: 400 });
  }

  const outcome = await inviteUserUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    fullName: typeof body.fullName === "string" ? body.fullName : "",
    email: typeof body.email === "string" ? body.email : "",
    role: body.role,
    ...(typeof body.project === "string" && body.project ? { project: body.project } : {}),
  });

  if (outcome.status !== 201) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ userId: outcome.userId }, { status: 201 });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isUuid(body.userId)) {
    return Response.json({ error: "Usuário não informado." }, { status: 400 });
  }

  const actor = actorOf(user);

  /* `active` presente significa ativar/desativar; caso contrário, é edição de
     cadastro. São ações diferentes o bastante para não se misturarem no mesmo
     corpo. */
  if (typeof body.active === "boolean") {
    const outcome = await setUserStatusUseCase({ actor, actorName: user.fullName, userId: body.userId, active: body.active });
    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  if (!isRole(body.role)) {
    return Response.json({ error: "Papel inválido." }, { status: 400 });
  }

  const outcome = await updateUserUseCase({
    actor,
    actorName: user.fullName,
    userId: body.userId,
    fullName: typeof body.fullName === "string" ? body.fullName : "",
    role: body.role,
    ...(typeof body.project === "string" && body.project ? { project: body.project } : {}),
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ ok: true });
}
