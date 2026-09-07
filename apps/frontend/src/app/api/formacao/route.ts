import {
  editarPlanoUseCase,
  excluirPlanoUseCase,
  salvarPlanoUseCase,
} from "@nerdlms/backend/competencies/formation-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/formacao — cria um plano de formação de cargo.
 * PATCH /api/formacao — reescreve um plano existente.
 * DELETE /api/formacao — apaga um plano, se nenhum outro o continuar.
 *
 * O plano diz o que forma alguém por completo: um conjunto de trilhas, cursos e
 * competências. Quando ele declara um cargo, alcança sozinho quem tem aquele
 * cargo — sem alguém precisar atribuir um a um a cada contratação.
 *
 * A autorização inteira mora no caso de uso, que também valida os itens.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const resultado = await salvarPlanoUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    nome: body.nome,
    descricao: body.descricao,
    jobTitle: body.jobTitle,
    continuaId: body.continuaId,
    itens: body.itens,
  });

  if (resultado.status === 201) {
    return Response.json({ id: resultado.id }, { status: 201 });
  }

  return Response.json({ error: resultado.error }, { status: resultado.status });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.planoId)) {
    return Response.json({ error: "Plano não informado." }, { status: 400 });
  }

  const resultado = await editarPlanoUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    planoId: String(body.planoId),
    nome: body.nome,
    descricao: body.descricao,
    jobTitle: body.jobTitle,
    continuaId: body.continuaId,
    itens: body.itens,
  });

  if (resultado.status === 200) {
    return Response.json({ id: resultado.id });
  }

  return Response.json({ error: resultado.error }, { status: resultado.status });
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.planoId)) {
    return Response.json({ error: "Plano não informado." }, { status: 400 });
  }

  const resultado = await excluirPlanoUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    planoId: String(body.planoId),
  });

  if (resultado.status === 200) {
    return Response.json({ nome: resultado.nome });
  }

  return Response.json({ error: resultado.error }, { status: resultado.status });
}
