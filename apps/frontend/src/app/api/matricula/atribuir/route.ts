import { assignEnrollmentUseCase } from "@nerdlms/backend/courses/assign-enrollment-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/matricula/atribuir — o gestor matricula a equipe num curso.
 *
 * Rota separada de `/api/matricula` de propósito: lá o sujeito é sempre quem
 * está na sessão, e o corpo não carrega identidade de ninguém. Aceitar
 * `learnerIds` naquela rota misturaria "matricule-me" com "matricule outros",
 * e a diferença entre as duas é toda a autorização.
 */

export const dynamic = "force-dynamic";

/** Limite de pessoas por chamada. Uma turma grande ainda cabe; um ataque não. */
const MAX_POR_CHAMADA = 200;

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.courseId)) {
    return Response.json({ error: "Curso não informado." }, { status: 400 });
  }

  if (!Array.isArray(body.learnerIds) || body.learnerIds.length === 0) {
    return Response.json({ error: "Nenhuma pessoa selecionada." }, { status: 400 });
  }

  if (body.learnerIds.length > MAX_POR_CHAMADA) {
    return Response.json(
      { error: `Selecione no máximo ${MAX_POR_CHAMADA} pessoas por vez.` },
      { status: 400 },
    );
  }

  /* Todo id é validado antes de chegar ao caso de uso: um valor que não é UUID
     viraria erro de banco lá dentro, e erro de banco não é resposta de API. */
  if (!body.learnerIds.every((id: unknown) => isUuid(id))) {
    return Response.json({ error: "Pessoa inválida na seleção." }, { status: 400 });
  }

  const outcome = await assignEnrollmentUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    courseId: body.courseId,
    learnerIds: body.learnerIds as string[],
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json(outcome.result);
}
