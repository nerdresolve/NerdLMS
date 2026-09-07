import { enrollUseCase, saveUseCase } from "@nerdlms/backend/courses/enrollment-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/matricula — matricula o aluno da sessão no curso.
 * PATCH /api/matricula — marca ou desmarca o curso como favorito.
 *
 * As duas ações moram na mesma rota porque operam no mesmo recurso: favorito é
 * uma coluna da matrícula, não uma lista separada.
 */

export const dynamic = "force-dynamic";

async function readCourseId(request: Request): Promise<string | null> {
  const body = await readJsonObject(request);
  return body && isUuid(body.courseId) ? body.courseId : null;
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const courseId = await readCourseId(request);
  if (!courseId) return Response.json({ error: "Curso não informado." }, { status: 400 });

  const outcome = await enrollUseCase({ actor: actorOf(user), actorName: user.fullName, courseId });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ enrolled: true });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isUuid(body.courseId)) {
    return Response.json({ error: "Curso não informado." }, { status: 400 });
  }
  if (typeof body.saved !== "boolean") {
    return Response.json({ error: "Informe se o curso deve ficar salvo." }, { status: 400 });
  }

  const outcome = await saveUseCase({
    actor: actorOf(user),
    courseId: body.courseId,
    saved: body.saved,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ saved: outcome.saved });
}
