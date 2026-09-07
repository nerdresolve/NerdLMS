import { findAssignment } from "@nerdlms/backend/assessment/assignment-repository.ts";
import { createRubric } from "@nerdlms/backend/assessment/rubric-repository.ts";
import { authorizeCourse } from "@nerdlms/backend/courses/course-editor-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/rubricas — cria ou substitui a rubrica de um trabalho.
 *
 * Um trabalho tem UMA rubrica: acumular versões deixaria a correção sem saber
 * qual usar. As notas já lançadas não se perdem — vivem em `grade_entries`,
 * que é append-only e não aponta para a rubrica.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.assignmentId)) {
    return Response.json({ error: "Trabalho não informado." }, { status: 400 });
  }

  const assignment = await findAssignment(String(body.assignmentId));
  if (!assignment) return Response.json({ error: "Trabalho não encontrado." }, { status: 404 });

  /* Montar rubrica é editar a avaliação do curso — mesma autorização de
     corrigir. */
  const ownership = await authorizeCourse(actorOf(user), assignment.courseId);
  if (!ownership) return Response.json({ error: "Trabalho não encontrado." }, { status: 404 });

  if (!Array.isArray(body.criteria) || body.criteria.length === 0) {
    return Response.json({ error: "Informe ao menos um critério." }, { status: 400 });
  }

  /* Cada critério é validado individualmente e os inválidos são descartados,
     em vez de recusar o lote: uma linha em branco no formulário é acidente
     comum, e devolver erro faria o instrutor procurar qual das oito era. */
  const criteria = body.criteria.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return [];
    const c = item as Record<string, unknown>;

    const name = typeof c.name === "string" ? c.name.trim() : "";
    const maxPoints = typeof c.maxPoints === "number" ? c.maxPoints : Number.NaN;

    if (name === "" || !Number.isFinite(maxPoints) || maxPoints <= 0) return [];

    return [
      {
        name,
        maxPoints,
        description: typeof c.description === "string" ? c.description : null,
      },
    ];
  });

  if (criteria.length === 0) {
    return Response.json({ error: "Nenhum critério válido." }, { status: 400 });
  }

  const rubricId = await createRubric({
    tenantId: ownership.tenantId,
    assignmentId: String(body.assignmentId),
    name: typeof body.name === "string" && body.name.trim() !== "" ? body.name : "Rubrica",
    criteria,
  });

  return Response.json({ rubricId }, { status: 201 });
}
