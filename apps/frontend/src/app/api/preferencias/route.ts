import { NOTIFICATION_CATALOG } from "@nerdlms/core/notifications/events.ts";
import { saveEmailTemplate, savePreference } from "@nerdlms/backend/notifications/preferences-repository.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { readJsonObject } from "@/lib/request-body.ts";

/**
 * PATCH /api/preferencias — liga/desliga um canal de aviso, ou salva um
 * template de e-mail do cliente.
 *
 * As duas coisas na mesma rota porque respondem à mesma pergunta — "como as
 * mensagens chegam" — e a segunda é do admin, com a checagem no caso de uso.
 */

export const dynamic = "force-dynamic";

/** Só eventos do catálogo: um `kind` livre entraria no banco sem template. */
const CONHECIDOS = new Set(NOTIFICATION_CATALOG.map((e) => e.kind));

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || typeof body.kind !== "string" || !CONHECIDOS.has(body.kind as never)) {
    return Response.json({ error: "Evento desconhecido." }, { status: 400 });
  }

  /* Template é do CLIENTE e do admin; preferência é da pessoa e de qualquer
     um. Por isso a checagem de papel vive só neste ramo. */
  if (typeof body.subject === "string" || typeof body.template === "string") {
    if (user.role !== "admin") {
      return Response.json({ error: "Sem permissão." }, { status: 403 });
    }

    if (typeof body.subject !== "string" || typeof body.template !== "string") {
      return Response.json({ error: "Informe assunto e corpo." }, { status: 400 });
    }

    if (body.subject.trim() === "" || body.template.trim() === "") {
      return Response.json({ error: "Assunto e corpo não podem ficar vazios." }, { status: 400 });
    }

    await saveEmailTemplate(user.tenant.id, body.kind, body.subject, body.template);
    return Response.json({ ok: true });
  }

  if (typeof body.inApp !== "boolean" || typeof body.email !== "boolean") {
    return Response.json({ error: "Informe os dois canais." }, { status: 400 });
  }

  await savePreference(actorOf(user).id, body.kind, body.inApp, body.email);
  return Response.json({ ok: true });
}
