import {
  decidirRetesteUseCase,
  pedirRetesteUseCase,
} from "@nerdlms/backend/assessment/retake-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/provas/reteste — o aluno pede.
 * PATCH /api/provas/reteste — o instrutor decide.
 *
 * Dois verbos e um caminho, porque é uma coisa só vista dos dois lados. A
 * permissão de cada um mora no caso de uso: pedir exige matrícula, decidir
 * exige a mesma autoridade que editar o curso.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.quizId)) {
    return Response.json({ error: "Prova não informada." }, { status: 400 });
  }

  const outcome = await pedirRetesteUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    quizId: String(body.quizId),
    nota: typeof body.nota === "string" ? body.nota : null,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ ok: true, pedidoId: outcome.pedidoId });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.pedidoId)) {
    return Response.json({ error: "Pedido não informado." }, { status: 400 });
  }

  /* Só dois valores viram decisão. Aceitar o que vier permitiria gravar um
     status que o CHECK do banco recusaria — erro de servidor no lugar de
     "requisição inválida". */
  const status = body.status === "approved" || body.status === "denied" ? body.status : null;
  if (!status) {
    return Response.json({ error: "Decisão inválida." }, { status: 400 });
  }

  const outcome = await decidirRetesteUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    pedidoId: String(body.pedidoId),
    status,
    comentario: typeof body.comentario === "string" ? body.comentario : "",
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ ok: true });
}
