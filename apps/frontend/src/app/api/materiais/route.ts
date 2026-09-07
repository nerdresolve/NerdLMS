import {
  deleteMaterial,
  findLessonCourse,
  insertMaterial,
} from "@nerdlms/backend/courses/material-repository.ts";
import { authorizeCourse } from "@nerdlms/backend/courses/course-editor-use-case.ts";
import { removeObject } from "@nerdlms/backend/storage/object-storage.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST   /api/materiais — registra um material já enviado ao storage.
 * DELETE /api/materiais — desanexa um material da aula.
 *
 * O arquivo sobe direto para o storage por URL assinada (`/api/upload` com
 * `scope: "materiais"`); esta rota só grava a linha. É o mesmo desenho do
 * vídeo da aula: o arquivo não atravessa o processo do Next (DEC-009).
 */

export const dynamic = "force-dynamic";

/** Extensão → tipo de material, para o ícone e o rótulo na tela. */
function kindOf(filename: string): "pdf" | "spreadsheet" | "slides" | "document" {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(ext)) return "slides";
  return "document";
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.lessonId)) {
    return Response.json({ error: "Aula não informada." }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return Response.json({ error: "Nome do arquivo não informado." }, { status: 400 });
  }

  if (typeof body.storageKey !== "string" || body.storageKey.trim() === "") {
    return Response.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  const tamanho = typeof body.sizeBytes === "number" && body.sizeBytes > 0 ? body.sizeBytes : 0;

  /* A permissão é sobre o CURSO da aula: anexar material é editar o conteúdo.
     A aula é traduzida no curso pelo módulo a que pertence. */
  const lessonId = String(body.lessonId);

  const courseId = await findLessonCourse(lessonId);
  if (!courseId) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  const ownership = await authorizeCourse(actorOf(user), courseId);
  if (!ownership) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  const id = await insertMaterial({
    lessonId,
    name: body.name.trim(),
    kind: kindOf(body.name),
    sizeBytes: tamanho,
    storageKey: body.storageKey,
    uploadedBy: user.id,
  });

  return Response.json({ id }, { status: 201 });
}

/**
 * DELETE /api/materiais — desanexa um material.
 *
 * Existia `deleteMaterial` no repositório e nenhuma rota chamando: quem
 * anexasse o arquivo errado não tinha como tirá-lo, e a única saída era anexar
 * o certo e conviver com os dois na lista da aula.
 *
 * O ARQUIVO SAI JUNTO, DEPOIS DA LINHA.
 *
 * A versão anterior deixava o objeto no bucket de propósito: removê-lo antes
 * arriscava o material reaparecer se a linha não saísse, e removê-lo depois
 * arriscava a requisição falhar com a linha já apagada. O dilema era real
 * enquanto a remoção podia falhar — `removeObject` não pode mais, e aí a ordem
 * certa é a óbvia. Sem isso, cada troca de PDF somava um órfão permanente que
 * ninguém sabia existir.
 */
export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.lessonId) || !isUuid(body.materialId)) {
    return Response.json({ error: "Material não informado." }, { status: 400 });
  }

  const lessonId = String(body.lessonId);

  /* Mesma autorização do POST: desanexar é editar o conteúdo do curso. */
  const courseId = await findLessonCourse(lessonId);
  if (!courseId) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  const ownership = await authorizeCourse(actorOf(user), courseId);
  if (!ownership) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  /* `lessonId` entra na cláusula da remoção, e não só na autorização: sem ele,
     um id de material de outra aula do mesmo curso seria removido por uma
     requisição que só tinha permissão sobre esta. */
  const chave = await deleteMaterial(lessonId, String(body.materialId));
  if (!chave) return Response.json({ error: "Material não encontrado." }, { status: 404 });

  await removeObject(chave);

  return Response.json({ ok: true });
}
