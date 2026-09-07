import { uploadUrlUseCase } from "@nerdlms/backend/storage/upload-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/upload
 *
 * Devolve uma URL assinada para o navegador enviar o arquivo direto ao
 * storage. O arquivo nunca passa por aqui: um vídeo de duas horas atravessando
 * o processo do Next ocuparia o event loop e travaria a renderização das
 * páginas para todo mundo.
 *
 * A resposta é curta e some rápido: a URL vale 15 minutos.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.courseId)) {
    return Response.json({ error: "Curso não informado." }, { status: 400 });
  }

  if (typeof body.filename !== "string" || body.filename.trim() === "") {
    return Response.json({ error: "Nome do arquivo não informado." }, { status: 400 });
  }

  const scope = body.scope === "aulas" ? "aulas" : "materiais";

  const outcome = await uploadUrlUseCase({
    actor: actorOf(user),
    courseId: body.courseId,
    filename: body.filename,
    scope,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ url: outcome.url, key: outcome.key, contentType: outcome.contentType });
}
