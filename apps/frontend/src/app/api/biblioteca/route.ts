import {
  deleteDocumento,
  insertDocumento,
} from "@nerdlms/backend/courses/material-repository.ts";
import { removeObject } from "@nerdlms/backend/storage/object-storage.ts";
import { recordAudit } from "@nerdlms/backend/audit/audit-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

import { LIMITE_DE_CHAVE, LIMITE_DE_NOME, LIMITE_DE_TEXTO, textoDeEntrada }
  from "@nerdlms/core/validation/texto.ts";
/**
 * POST   /api/biblioteca — publica um documento já enviado ao storage.
 * DELETE /api/biblioteca — tira um documento do acervo.
 *
 * O arquivo sobe direto para o storage por URL assinada (`/api/upload` com
 * `scope: "biblioteca"`); esta rota só grava a linha. Mesmo desenho do anexo de
 * aula: o arquivo não atravessa o processo do Next (DEC-009).
 *
 * QUEM PUBLICA
 *
 * Administrador e instrutor — os mesmos que já criam conteúdo. A checagem está
 * aqui e também no `uploadUrlUseCase`, e as duas são necessárias: sem a de lá,
 * qualquer pessoa conseguiria a URL assinada e escreveria no bucket; sem a
 * daqui, quem conseguisse uma URL por outro caminho registraria a linha.
 */

export const dynamic = "force-dynamic";

/** Extensão → tipo, para o ícone e o filtro na tela. */
function kindOf(filename: string): "pdf" | "spreadsheet" | "slides" | "document" {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(ext)) return "slides";
  return "document";
}

function podePublicar(role: string): boolean {
  return role === "admin" || role === "instructor";
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  if (!podePublicar(user.role)) {
    return Response.json({ error: "Só a administração publica na biblioteca." }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const name = textoDeEntrada(body.name, LIMITE_DE_NOME) ?? "";
  if (name === "") {
    return Response.json(
      { error: `Nome do arquivo não informado, ou acima de ${LIMITE_DE_NOME} caracteres.` },
      { status: 400 },
    );
  }

  const storageKey = textoDeEntrada(body.storageKey, LIMITE_DE_CHAVE) ?? "";
  if (storageKey === "") {
    return Response.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  const descricao = textoDeEntrada(body.description, LIMITE_DE_TEXTO);
  if (descricao === null && body.description !== undefined) {
    return Response.json(
      { error: `A descrição passa de ${LIMITE_DE_TEXTO} caracteres.` },
      { status: 400 },
    );
  }

  const id = await insertDocumento({
    tenantId: user.tenant.id,
    name,
    description: descricao ? descricao : null,
    /* Tema é opcional: o documento entra no acervo mesmo sem assunto definido,
       e a tela oferece um filtro próprio para esses. Exigi-lo faria alguém
       escolher qualquer um só para conseguir publicar. */
    categoryId: isUuid(body.categoryId) ? String(body.categoryId) : null,
    kind: kindOf(name),
    sizeBytes: typeof body.sizeBytes === "number" && body.sizeBytes > 0 ? body.sizeBytes : 0,
    storageKey,
    uploadedBy: user.id,
  });

  await recordAudit({
    tenantId: user.tenant.id,
    actorId: user.id,
    actorName: user.fullName,
    /* Publicar na biblioteca muda o que TODO MUNDO daquele cliente enxerga —
       é a mesma natureza de ligar uma funcionalidade. */
    action: "config_changed",
    target: `biblioteca: ${name}`,
    outcome: "allowed",
  });

  return Response.json({ id }, { status: 201 });
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  if (!podePublicar(user.role)) {
    return Response.json({ error: "Só a administração publica na biblioteca." }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.materialId)) {
    return Response.json({ error: "Documento não informado." }, { status: 400 });
  }

  const chave = await deleteDocumento(user.tenant.id, String(body.materialId));

  /* Documento de outro cliente responde como inexistente: a diferença entre
     "não existe" e "não é seu" já é informação (§18). */
  if (!chave) return Response.json({ error: "Documento não encontrado." }, { status: 404 });

  /* A linha sai primeiro, o arquivo depois. Na ordem inversa, uma falha ao
     apagar a linha deixaria a biblioteca listando um documento cujo arquivo já
     não existe — e o download daria erro sem explicação. */
  await removeObject(chave);

  await recordAudit({
    tenantId: user.tenant.id,
    actorId: user.id,
    actorName: user.fullName,
    action: "config_changed",
    target: `biblioteca: documento removido`,
    outcome: "allowed",
  });

  return Response.json({ ok: true });
}
