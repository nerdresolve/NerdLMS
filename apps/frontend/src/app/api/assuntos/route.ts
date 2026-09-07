import { createCategory } from "@nerdlms/backend/courses/category-repository.ts";
import { recordAudit } from "@nerdlms/backend/audit/audit-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { LIMITE_DE_NOME, textoDeEntrada } from "@nerdlms/core/validation/texto.ts";

import { readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/assuntos — cria um assunto (categoria).
 *
 * `createCategory` existia no repositório desde a migração 007 e ninguém a
 * chamava: o editor de curso deixava ESCOLHER um assunto e nada os criava, e
 * por isso a lista vinha sempre vazia. A biblioteca precisa deles para o filtro
 * por tema, e o catálogo de cursos passa a ter os mesmos — é a mesma taxonomia,
 * e ter duas seria a última vez que alguém confiaria em qualquer uma.
 *
 * Só administrador: o vocabulário de assuntos é da organização, e não de quem
 * publica um documento. Um campo de texto livre na hora de publicar criaria
 * "Segurança", "seguranca" e "Segurança " como três assuntos distintos, e o
 * filtro passaria a devolver um terço dos documentos em cada um.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  if (user.role !== "admin") {
    return Response.json({ error: "Só a administração define assuntos." }, { status: 403 });
  }

  const body = await readJsonObject(request);
  const nome = textoDeEntrada(body?.name, LIMITE_DE_NOME) ?? "";

  if (nome.length < 2) {
    return Response.json(
      { error: `Dê um nome ao assunto, de 2 a ${LIMITE_DE_NOME} caracteres.` },
      { status: 400 },
    );
  }

  const id = await createCategory({ tenantId: user.tenant.id, name: nome });

  /* Nulo é nome sem nada representável em ASCII, ou assunto já existente — o
     `ON CONFLICT DO NOTHING` do repositório. Nos dois casos a resposta diz o
     que aconteceu em vez de devolver um erro genérico. */
  if (id === null) {
    return Response.json({ error: "Já existe um assunto com este nome." }, { status: 409 });
  }

  await recordAudit({
    tenantId: user.tenant.id,
    actorId: user.id,
    actorName: user.fullName,
    action: "config_changed",
    target: `assunto ${nome}`,
    outcome: "allowed",
  });

  return Response.json({ id, name: nome }, { status: 201 });
}
