import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { validateMetadata } from "@nerdlms/core/courses/metadata.ts";
import type { CourseLevel, CourseVisibility } from "@nerdlms/core/courses/types.ts";

import { resolveTags, setCourseTags } from "./category-repository.ts";
import { authorizeCourse } from "./course-editor-use-case.ts";
import { updateCourseMetadata } from "./course-metadata-repository.ts";
import { setContentRelease, setWatchGuard } from "./unlock-repository.ts";

/**
 * Salvar os metadados do curso — F2-03.
 *
 * Separado de `updateCourseUseCase` (título e resumo) porque são gestos
 * diferentes na interface: título se edita no cabeçalho, metadados num painel
 * próprio. Juntar os dois obrigaria cada um a enviar os campos do outro para
 * não apagá-los.
 */

export interface CourseMetadataCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
  categoryId?: string | null;
  code?: string | null;
  workloadMinutes?: number | null;
  level?: CourseLevel | null;
  language?: string | null;
  objectives?: string | null;
  audience?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  visibility?: CourseVisibility;
  /** Política de liberação do conteúdo (F2-05). */
  contentRelease?: "open" | "sequential";
  /** Trava do player. Ausente não altera o que está gravado. */
  watchGuard?: boolean;
  /** Nomes digitados; a resolução em ids acontece aqui. */
  tags?: string[];
}

export type CourseMetadataOutcome =
  | { status: 200 }
  | { status: 400 | 403 | 404 | 409; error: string };

export async function courseMetadataUseCase(
  command: CourseMetadataCommand,
): Promise<CourseMetadataOutcome> {
  const ownership = await authorizeCourse(command.actor, command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  /* A validação espelha os CHECKs da 007 para dar mensagem em vez de erro de
     restrição. O banco continua sendo a garantia. */
  const erros = validateMetadata({
    ...(command.code ? { code: command.code } : {}),
    ...(command.workloadMinutes != null ? { workloadMinutes: command.workloadMinutes } : {}),
    ...(command.language ? { language: command.language } : {}),
    ...(command.startsOn ? { startsOn: command.startsOn } : {}),
    ...(command.endsOn ? { endsOn: command.endsOn } : {}),
  });

  if (erros.length > 0) return { status: 400, error: erros[0]! };

  const gravou = await updateCourseMetadata(command.courseId, {
    categoryId: command.categoryId ?? null,
    code: command.code?.trim() || null,
    workloadMinutes: command.workloadMinutes ?? null,
    level: command.level ?? null,
    language: command.language?.trim() || null,
    objectives: command.objectives?.trim() || null,
    audience: command.audience?.trim() || null,
    startsOn: command.startsOn || null,
    endsOn: command.endsOn || null,
    visibility: command.visibility ?? "catalog",
  });

  /* Código repetido é a única colisão possível aqui, e o índice único da 007 a
     detecta. 409 e não 400: o dado enviado é válido, o conflito é com outro
     curso que já usa aquele código. */
  if (!gravou) {
    return { status: 409, error: "Já existe um curso com este código." };
  }

  if (command.contentRelease) {
    await setContentRelease(command.courseId, command.contentRelease);
  }

  /* `!== undefined` e não truthy: `false` é um valor válido aqui, e a
     checagem por verdade nunca conseguiria desligar a trava. */
  if (command.watchGuard !== undefined) {
    await setWatchGuard(command.courseId, command.watchGuard);
  }

  if (command.tags) {
    const tags = await resolveTags(ownership.tenantId, command.tags);
    await setCourseTags(command.courseId, tags.map((tag) => tag.id));
  }

  return { status: 200 };
}
