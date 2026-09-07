import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";

import { findCourseOwnership } from "../courses/course-editor-repository.ts";
import {
  buildKey,
  contentTypeOf,
  presignUpload,
  type EscopoDeUpload,
} from "./object-storage.ts";

/**
 * Autorização de upload (TASK-042).
 *
 * O arquivo não passa por aqui: esta função só decide se a pessoa pode enviar
 * e devolve uma URL assinada de curta duração. O navegador fala direto com o
 * storage, então um vídeo de duas horas não ocupa o processo do Next.
 *
 * Só o autor do curso envia material para ele. A regra é a mesma de editar o
 * curso, e vive em `can()` — reproduzi-la aqui criaria duas versões dela.
 */

export interface UploadCommand {
  actor: Actor;
  /** O curso dono do arquivo. Vazio para a biblioteca, que não tem curso. */
  courseId: string;
  filename: string;
  scope: EscopoDeUpload;
  /** Endereço que o navegador está usando; a assinatura do S3 cobre o host. */
  origem?: string;
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

  /* A BIBLIOTECA NÃO PASSA PELA AUTORIZAÇÃO DE CURSO.

     O documento não pertence a curso nenhum, e não há autoria a conferir. Quem
     publica é quem responde pelo acervo da organização: administrador, ou
     instrutor — os mesmos que já criam conteúdo. Um aluno com um `courseId`
     inventado não chegaria aqui de qualquer jeito, mas a checagem explícita é
     o que garante isso quando o caminho não tem curso para negar. */
  if (command.scope === "biblioteca") {
    const podePublicar =
      Boolean(command.actor.tenantId) &&
      (command.actor.role === "admin" || command.actor.role === "instructor");

    if (!podePublicar) {
      return { status: 403, error: "Só a administração publica na biblioteca." };
    }

    const chave = buildKey("biblioteca", command.actor.tenantId!, command.filename);
    const assinada = await presignUpload(chave, contentType, command.origem);

    return { status: 200, url: assinada, key: chave, contentType };
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
  const url = await presignUpload(key, contentType, command.origem);

  return { status: 200, url, key, contentType };
}
