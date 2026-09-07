import { query } from "../db/pool.ts";

/**
 * O mínimo do curso para decidir permissão: quem é o autor e em que estado ele
 * está.
 *
 * Existe separado de `findAllCourses` porque aquela consulta traz módulos,
 * aulas e metadados — carregar tudo isso para responder "esta pessoa pode
 * decidir?" é caro e diz mais do que a pergunta precisa.
 */
export async function findCourseForPermission(
  courseId: string,
): Promise<{ authorId: string; status: "draft" | "published" | "archived" } | null> {
  const rows = await query<{ author_id: string; status: string }>(
    `SELECT author_id, status FROM courses WHERE id = $1`,
    [courseId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    authorId: row.author_id,
    status: row.status as "draft" | "published" | "archived",
  };
}
