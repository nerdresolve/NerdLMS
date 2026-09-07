import { registrarEficaciaUseCase } from "@nerdlms/backend/assessment/effectiveness-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/eficacia — registra a avaliação de eficácia de uma conclusão.
 *
 * Só POST: a avaliação é somente-inserção, e corrigir um veredito se faz
 * revogando e registrando outro, não editando o que está lá. A tabela recusaria
 * um PATCH mesmo que esta rota o oferecesse.
 *
 * A autorização inteira mora no caso de uso, porque ela depende do curso: o
 * instrutor avalia quem concluiu os cursos que ele assina, o administrador vê a
 * organização. Duplicá-la aqui daria dois lugares para a mesma regra.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.enrollmentId)) {
    return Response.json({ error: "Matrícula não informada." }, { status: 400 });
  }

  const resultado = await registrarEficaciaUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    enrollmentId: String(body.enrollmentId),
    veredito: body.veredito,
    observacao: body.observacao,
  });

  if (resultado.status === 201) {
    return Response.json({ id: resultado.id }, { status: 201 });
  }

  /* Já avaliada não é erro: alguém chegou primeiro, ou o botão foi clicado
     duas vezes. O registro existe, que é o que quem clicou queria. */
  if (resultado.status === 200) {
    return Response.json({ jaAvaliada: true }, { status: 200 });
  }

  return Response.json({ error: resultado.error }, { status: resultado.status });
}
