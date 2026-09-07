import { findMaterialKey } from "@nerdlms/backend/courses/material-repository.ts";
import { presignDownload } from "@nerdlms/backend/storage/object-storage.ts";

import { getLessonPageData } from "@/features/lesson/data.ts";
import { currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * GET /api/materiais/[materialId]?aula=<lessonId>
 *
 * Devolve uma URL assinada para baixar o material.
 *
 * A aula vem por parâmetro porque a autorização é sobre ELA: quem pode abrir a
 * aula pode baixar o material dela. Sem isso, um id de material sozinho
 * bastaria para puxar o anexo de qualquer curso — e a checagem de matrícula
 * não protegeria nada.
 *
 * `getLessonPageData` já resolve permissão e matrícula, e devolve null tanto
 * para aula inexistente quanto para aula sem acesso. Reaproveitar essa função
 * mantém uma regra só: se ela mudar, o download acompanha.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ materialId: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const { materialId } = await params;
  const lessonId = new URL(request.url).searchParams.get("aula");

  if (!isUuid(materialId) || !lessonId || !isUuid(lessonId)) {
    return Response.json({ error: "Material não informado." }, { status: 400 });
  }

  /* Autoriza pela aula. 404 quando não pode — a mesma resposta de aula
     inexistente, para não revelar o que existe. */
  const aula = await getLessonPageData(lessonId);
  if (!aula) {
    return Response.json({ error: "Material não encontrado." }, { status: 404 });
  }

  /* O vínculo material→aula é conferido no banco, não pela lista já carregada:
     a consulta é a fonte, e depender do que a página trouxe deixaria a regra
     em dois lugares. */
  const key = await findMaterialKey(lessonId, materialId);
  if (!key) {
    return Response.json({ error: "Material não encontrado." }, { status: 404 });
  }

  return Response.json({ url: await presignDownload(key) });
}
