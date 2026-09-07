import { updateOwnProfileUseCase } from "@nerdlms/backend/auth/user-admin-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { readJsonObject } from "@/lib/request-body.ts";

/**
 * PATCH /api/perfil — a pessoa edita o próprio cadastro.
 *
 * Rota separada de `/api/usuarios` de propósito. Lá o alvo vem no corpo,
 * porque quem administra edita outras pessoas; aqui o alvo é sempre a sessão.
 * Se as duas dividissem a mesma rota, um `userId` no corpo passaria a valer
 * para qualquer conta autenticada.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (typeof body.fullName !== "string") {
    return Response.json({ error: "Informe o nome." }, { status: 400 });
  }

  const outcome = await updateOwnProfileUseCase({
    actor: actorOf(user),
    fullName: body.fullName,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ ok: true });
}
