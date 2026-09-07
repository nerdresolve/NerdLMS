import { findDocumentoKey } from "@nerdlms/backend/courses/material-repository.ts";
import { presignDownload } from "@nerdlms/backend/storage/object-storage.ts";

import { origemDaRequisicao } from "@/lib/origem-da-requisicao.ts";
import { currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * GET /api/biblioteca/[materialId] — URL assinada para baixar o documento.
 *
 * A autorização é a SESSÃO, e nada além dela: a biblioteca é da organização, e
 * um procedimento de segurança que só quem está matriculado num curso pode ler
 * não cumpre o propósito de estar publicado.
 *
 * O recorte que importa é o cliente, e ele está na consulta — `findDocumentoKey`
 * exige o tenant e exige `lesson_id IS NULL`. Sem a segunda condição, esta rota
 * viraria um caminho para baixar o anexo de qualquer aula sem matrícula
 * nenhuma, contornando a checagem que a rota de material faz.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ materialId: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const { materialId } = await params;
  if (!isUuid(materialId)) {
    return Response.json({ error: "Documento não informado." }, { status: 400 });
  }

  const chave = await findDocumentoKey(user.tenant.id, materialId);
  if (!chave) return Response.json({ error: "Documento não encontrado." }, { status: 404 });

  /* Assinada contra a origem desta requisição: `http://storage:9000` só
     resolve dentro da rede do Compose. */
  const origem = await origemDaRequisicao();
  const url = await presignDownload(chave, origem ?? undefined);

  return Response.json({ url });
}
