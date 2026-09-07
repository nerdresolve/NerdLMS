import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";

import { findCourseOwnership } from "../courses/course-editor-repository.ts";
import { buildKey, contentTypeOf, presignUpload } from "./object-storage.ts";

/**
 * Autorização de upload.
 *
 * O arquivo não passa por aqui: esta função só decide se a pessoa pode enviar
 * e devolve uma URL assinada de curta duração. O navegador fala direto com o
 * storage, então um vídeo de duas horas não ocupa o processo do Next.
 *
 * Só o autor do curso envia material para ele. A regra é a mesma de editar o
 * curso, e vive em `can` — reproduzi-la aqui criaria duas versões dela.
 */

export interface UploadCommand {
  actor: Actor;
  courseId: string;
  filename: string;
  scope: "aulas" | "materiais";
}

export type UploadOutcome =
  | { status: 200; url: string; key: string; contentType: string }
  | { status: 400 | 403 | 404; error: string };

/** Teto por arquivo, alinhado ao limite do proxy para a rota de upload. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export async function uploadUrlUseCase(command: UploadCommand): Promise<UploadOutcome> {
  const contentType = contentTypeOf(command.filename);
  if (!contentType) {
    return {
      status: 400,
      error: "Formato não aceito. Envie vídeo (MP4, WebM), PDF, planilha, documento ou imagem.",
    };
  }

  const ownership = await findCourseOwnership(command.courseId);
  /* Curso inexistente e curso alheio respondem igual: distinguir diria a quem
     tenta que aquele id existe. */
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  const allowed = can(command.actor, "update", {
    kind: "course",
    authorId: ownership.authorId,
    status: ownership.status,
  });
  if (!allowed) return { status: 404, error: "Curso não encontrado." };

  const key = buildKey(command.scope, command.courseId, command.filename);
  const url = await presignUpload(key, contentType);

  return { status: 200, url, key, contentType };
}
