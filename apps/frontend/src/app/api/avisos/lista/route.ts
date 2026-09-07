import { findNotifications } from "@nerdlms/backend/courses/agenda-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";

/**
 * GET /api/avisos/lista — os avisos desta pessoa.
 *
 * Existe para o sino da barra do topo, que é um componente de cliente e não
 * recebe dados do servidor: o AppShell envolve todas as páginas, e passar os
 * avisos por prop obrigaria cada uma a buscá-los, inclusive as que nunca
 * mostram o sino.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const notifications = await findNotifications(user.id);

  /* Só os recentes: o painel mostra poucos e leva à agenda para o resto. */
  return Response.json({
    hits: notifications.slice(0, 6),
    unread: notifications.filter((item) => !item.read).length,
  });
}
