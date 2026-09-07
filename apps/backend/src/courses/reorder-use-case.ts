import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { reorderPositions } from "@nerdlms/core/courses/reorder.ts";

import { authorizeCourse } from "./course-editor-use-case.ts";
import {
  findLessonIds,
  findModuleCourse,
  findModuleIds,
  saveLessonPositions,
  saveModulePositions,
} from "./reorder-repository.ts";

/**
 * Reordenar módulos e aulas — F2-06.
 *
 * O cliente manda a lista inteira na ordem nova, não "mova o item X para a
 * posição 3". Duas razões:
 *
 * - a ordem final é o que se quer gravar, e descrevê-la inteira elimina a
 *   ambiguidade de "antes ou depois do item que estava lá";
 * - permite validar por comparação: a lista recebida precisa ser uma
 *   PERMUTAÇÃO EXATA da atual. Sem isso, um POST com um id de outro curso
 *   reposicionaria conteúdo alheio, e um id repetido gravaria duas aulas na
 *   mesma posição.
 */

export interface ReorderCommand {
  actor: Actor;
  /** Curso, quando reordena módulos; módulo, quando reordena aulas. */
  parentId: string;
  /** Ids na ordem desejada. */
  orderedIds: string[];
  kind: "modules" | "lessons";
}

export type ReorderOutcome = { status: 200 } | { status: 400 | 404; error: string };

/** As duas listas têm os mesmos elementos, sem falta, sobra nem repetição? */
function mesmaColecao(atual: string[], recebida: string[]): boolean {
  if (atual.length !== recebida.length) return false;

  const conjunto = new Set(recebida);
  /* O Set também pega repetição: dois ids iguais encolhem o conjunto. */
  if (conjunto.size !== recebida.length) return false;

  return atual.every((id) => conjunto.has(id));
}

export async function reorderUseCase(command: ReorderCommand): Promise<ReorderOutcome> {
  /* A permissão é sempre sobre o CURSO — reordenar aula é editar o curso dela.
     Para aulas, o módulo é traduzido no curso a que pertence. */
  const courseId =
    command.kind === "modules" ? command.parentId : await findModuleCourse(command.parentId);

  if (!courseId) return { status: 404, error: "Não encontrado." };

  const ownership = await authorizeCourse(command.actor, courseId);
  if (!ownership) return { status: 404, error: "Não encontrado." };

  const atual =
    command.kind === "modules"
      ? await findModuleIds(courseId)
      : await findLessonIds(command.parentId);

  if (!mesmaColecao(atual, command.orderedIds)) {
    return { status: 400, error: "A ordem enviada não corresponde ao conteúdo atual." };
  }

  const posicoes = reorderPositions(command.orderedIds);

  if (command.kind === "modules") {
    await saveModulePositions(courseId, posicoes);
  } else {
    await saveLessonPositions(command.parentId, posicoes);
  }

  return { status: 200 };
}
