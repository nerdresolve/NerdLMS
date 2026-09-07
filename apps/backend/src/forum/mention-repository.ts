import { query } from "../db/pool.ts";

/**
 * Menções e navegação do fórum — F4-02.
 */

/**
 * Resolve `@nome` em ids de pessoas.
 *
 * A busca é pelo LOGIN — a parte do e-mail antes do `@` —, que é como as
 * pessoas se identificam entre si. Buscar pelo nome completo daria ambiguidade
 * ("@ana" com três Anas) e obrigaria a escrever "@ana.paula.silva" para
 * mencionar alguém.
 *
 * O `tenantId` é obrigatório: sem ele, um `@ana` encontraria a Ana de outro
 * cliente, e a notificação atravessaria a fronteira que todo o resto do produto
 * respeita.
 */
export async function findUsersByLogin(logins: string[], tenantId: string): Promise<string[]> {
  if (logins.length === 0) return [];

  const rows = await query<{ id: string }>(
    `SELECT id
       FROM users
      WHERE tenant_id = $1
        AND status <> 'inactive'
        -- split_part corta o e-mail no arroba: "ana.silva@exemplo.com.br" casa
        -- com a menção "@ana.silva".
        --
        -- O lower() é necessário: email é citext e compara sem caixa, mas
        -- split_part devolve text e PERDE essa propriedade. Sem ele, um
        -- e-mail cadastrado como "Ana.Silva@..." não casaria com "@ana.silva"
        -- — verificado no banco antes de corrigir.
        AND lower(split_part(email::text, '@', 1)) = ANY($2::text[])`,
    [tenantId, logins],
  );

  return rows.map((row) => row.id);
}

/** O curso a que uma mensagem pertence, via tópico. */
export async function findCourseOfPost(postId: string): Promise<string | null> {
  const rows = await query<{ course_id: string }>(
    `SELECT t.course_id
       FROM forum_posts p
       JOIN forum_topics t ON t.id = p.topic_id
      WHERE p.id = $1
      LIMIT 1`,
    [postId],
  );

  return rows[0]?.course_id ?? null;
}

/** O tenant de um curso — as menções não atravessam clientes. */
export async function findTenantOfCourse(courseId: string): Promise<string | null> {
  const rows = await query<{ tenant_id: string }>(
    `SELECT tenant_id FROM courses WHERE id = $1 LIMIT 1`,
    [courseId],
  );

  return rows[0]?.tenant_id ?? null;
}
