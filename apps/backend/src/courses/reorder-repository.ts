import type { PositionUpdate } from "@nerdlms/core/courses/reorder.ts";

import { query } from "../db/pool.ts";

/**
 * Gravação da ordem de módulos e aulas — F2-06.
 */

/**
 * Os ids dos módulos de um curso, na ordem atual.
 *
 * Serve para validar o que o cliente mandou: a nova ordem precisa ser uma
 * permutação exata desta lista. Sem essa conferência, um POST com um id de
 * outro curso reposicionaria conteúdo alheio.
 */
export async function findModuleIds(courseId: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM modules WHERE course_id = $1 ORDER BY position`,
    [courseId],
  );

  return rows.map((row) => row.id);
}

/** Idem para as aulas de um módulo. */
export async function findLessonIds(moduleId: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM lessons WHERE module_id = $1 ORDER BY position`,
    [moduleId],
  );

  return rows.map((row) => row.id);
}

/** O curso a que um módulo pertence — a permissão é sobre o curso. */
export async function findModuleCourse(moduleId: string): Promise<string | null> {
  const rows = await query<{ course_id: string }>(
    `SELECT course_id FROM modules WHERE id = $1 LIMIT 1`,
    [moduleId],
  );

  return rows[0]?.course_id ?? null;
}

/**
 * Grava as posições.
 *
 * Uma instrução só, com `unnest`: um UPDATE por item daria N viagens ao banco e
 * abriria uma janela em que a ordem está pela metade — se a segunda falhasse,
 * o curso ficaria com duas aulas na mesma posição.
 *
 * O `WHERE` amarra à tabela mãe (curso ou módulo) porque a validação de
 * pertinência acontece antes, mas repetir a condição aqui torna impossível
 * gravar posição em item de outro curso mesmo que a validação falhe.
 */
export async function saveModulePositions(
  courseId: string,
  updates: PositionUpdate[],
): Promise<void> {
  if (updates.length === 0) return;

  await query(
    `UPDATE modules m
        SET position = v.position
       FROM unnest($2::uuid[], $3::int[]) AS v(id, position)
      WHERE m.id = v.id AND m.course_id = $1`,
    [courseId, updates.map((u) => u.id), updates.map((u) => u.position)],
  );
}

export async function saveLessonPositions(
  moduleId: string,
  updates: PositionUpdate[],
): Promise<void> {
  if (updates.length === 0) return;

  await query(
    `UPDATE lessons l
        SET position = v.position
       FROM unnest($2::uuid[], $3::int[]) AS v(id, position)
      WHERE l.id = v.id AND l.module_id = $1`,
    [moduleId, updates.map((u) => u.id), updates.map((u) => u.position)],
  );
}
