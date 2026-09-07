import { salvarTrilhaUseCase } from "@nerdlms/backend/courses/tracks-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/trilhas — cria uma trilha.
 * PATCH /api/trilhas — edita uma trilha existente.
 *
 * As duas passam pelo mesmo caso de uso porque montam a mesma coisa: nome,
 * alvo e a sequência de cursos. A única diferença é haver ou não um `trackId`.
 */

export const dynamic = "force-dynamic";

async function salvar(request: Request, trackId: string | null): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const resultado = await salvarTrilhaUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    trackId,
    title: body.title,
    summary: body.summary,
    mode: body.mode,
    project: body.project,
    jobTitle: body.jobTitle,
    courseIds: body.courseIds,
  });

  if ("id" in resultado) {
    return Response.json({ id: resultado.id }, { status: resultado.status });
  }

  return Response.json({ error: resultado.error }, { status: resultado.status });
}

export async function POST(request: Request): Promise<Response> {
  return salvar(request, null);
}

export async function PATCH(request: Request): Promise<Response> {
  const clone = request.clone();
  const body = await readJsonObject(clone);

  if (!body || !isUuid(body.trackId)) {
    return Response.json({ error: "Trilha não informada." }, { status: 400 });
  }

  return salvar(request, String(body.trackId));
}
