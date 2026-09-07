import { markNotificationRead } from "@nerdlms/backend/courses/agenda-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * PATCH /api/avisos — marca um aviso como lido.
 *
 * O dono do aviso é sempre a sessão, nunca o corpo: o `userId` vai para o
 * WHERE dentro do repositório, então um id de aviso alheio não encontra linha
 * e responde 404, sem revelar se aquele aviso existe.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.notificationId)) {
    return Response.json({ error: "Aviso não informado." }, { status: 400 });
  }

  const marked = await markNotificationRead(user.id, body.notificationId);
  if (!marked) {
    /* Também cai aqui quando já estava lido. Não é erro: o efeito desejado
       (aviso lido) vale nos dois casos. */
    return Response.json({ ok: true, changed: false });
  }
  return Response.json({ ok: true, changed: true });
}
