import { buildCategoryTree, normalizeTagName, slugify, type CategoryRow } from "@nerdlms/core/courses/metadata.ts";
import type { CourseCategory, Tag } from "@nerdlms/core/courses/types.ts";

import { query } from "../db/pool.ts";

/**
 * Categorias e tags — F2-01.
 *
 * A árvore é montada no domínio (`buildCategoryTree`); aqui só se lê o
 * necessário para montá-la. A contagem de cursos vem por subconsulta em vez de
 * uma segunda viagem: são dados que só fazem sentido juntos.
 */

interface CategoryDbRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  position: number;
  course_count: string;
}

/**
 * A árvore de categorias do tenant, com a contagem de cursos.
 *
 * Conta apenas curso PUBLICADO e visível no catálogo: a navegação é do aluno, e
 * uma categoria que promete cinco cursos e entrega dois — porque três eram
 * rascunho — é pior que uma categoria vazia.
 */
export async function findCategoryTree(tenantId: string): Promise<CourseCategory[]> {
  const rows = await query<CategoryDbRow>(
    `SELECT cat.id, cat.name, cat.slug, cat.parent_id, cat.position,
            (SELECT count(*)
               FROM courses c
              WHERE c.category_id = cat.id
                AND c.status = 'published'
                AND c.visibility = 'catalog') AS course_count
       FROM course_categories cat
      WHERE cat.tenant_id = $1
      ORDER BY cat.position, cat.name`,
    [tenantId],
  );

  const linhas: CategoryRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    position: row.position,
    /* `count(*)` volta como string: bigint não cabe em number com segurança, e
       o driver prefere não perder precisão. Aqui a conversão é segura. */
    courseCount: Number(row.course_count),
  }));

  return buildCategoryTree(linhas);
}

/** Lista rasa, para o editor escolher a categoria do curso. */
export async function findCategoryOptions(
  tenantId: string,
): Promise<{ id: string; name: string; parentName: string | null }[]> {
  const rows = await query<{ id: string; name: string; parent_name: string | null }>(
    `SELECT cat.id, cat.name, pai.name AS parent_name
       FROM course_categories cat
       LEFT JOIN course_categories pai ON pai.id = cat.parent_id
      WHERE cat.tenant_id = $1
      ORDER BY coalesce(pai.name, cat.name), cat.position, cat.name`,
    [tenantId],
  );

  return rows.map((row) => ({ id: row.id, name: row.name, parentName: row.parent_name }));
}

export interface NewCategory {
  tenantId: string;
  name: string;
  parentId?: string | null;
  position?: number;
}

/**
 * Cria uma categoria.
 *
 * Devolve `null` quando o nome não produz slug (só pontuação, por exemplo) ou
 * quando já existe uma irmã com o mesmo nome — os dois índices parciais da 007
 * garantem a unicidade, e `ON CONFLICT DO NOTHING` transforma a violação em
 * resposta em vez de erro 500.
 */
export async function createCategory(input: NewCategory): Promise<string | null> {
  const slug = slugify(input.name);
  if (!slug) return null;

  const rows = await query<{ id: string }>(
    `INSERT INTO course_categories (tenant_id, parent_id, name, slug, position)
     VALUES ($1, $2, btrim($3), $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [input.tenantId, input.parentId ?? null, input.name, slug, input.position ?? 0],
  );

  return rows[0]?.id ?? null;
}

/**
 * Resolve nomes de tag em ids, criando as que faltam.
 *
 * A colisão é decidida pela forma NORMALIZADA do nome (`normalizeTagName`), não
 * pelo texto cru: sem isso "NR-10", "NR10" e "nr 10" viram três tags, e o
 * filtro do catálogo passa a devolver um terço dos cursos em cada uma.
 *
 * O nome gravado é o que a pessoa digitou na primeira vez — normalizar para
 * comparar não significa exibir tudo em minúsculas.
 */
export async function resolveTags(tenantId: string, nomes: string[]): Promise<Tag[]> {
  const vistos = new Map<string, string>();

  for (const nome of nomes) {
    const limpo = nome.trim();
    if (limpo === "") continue;

    const chave = normalizeTagName(limpo);
    if (chave === "") continue;
    if (!vistos.has(chave)) vistos.set(chave, limpo);
  }

  if (vistos.size === 0) return [];

  const resolvidas: Tag[] = [];

  for (const [chave, nome] of vistos) {
    /* O slug É a forma normalizada: assim o índice único (tenant_id, slug) faz
       o trabalho de deduplicação no banco, e não numa checagem da aplicação
       que duas requisições simultâneas atravessariam. */
    const rows = await query<{ id: string; name: string; slug: string }>(
      `INSERT INTO tags (tenant_id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, slug) DO UPDATE SET name = tags.name
       RETURNING id, name, slug`,
      [tenantId, nome, chave],
    );

    const tag = rows[0];
    if (tag) resolvidas.push({ id: tag.id, name: tag.name, slug: tag.slug });
  }

  return resolvidas;
}

/** Substitui as tags de um curso pelas informadas. */
export async function setCourseTags(courseId: string, tagIds: string[]): Promise<void> {
  await query(`DELETE FROM course_tags WHERE course_id = $1`, [courseId]);

  if (tagIds.length === 0) return;

  await query(
    `INSERT INTO course_tags (course_id, tag_id)
     SELECT $1, unnest($2::uuid[])
     ON CONFLICT DO NOTHING`,
    [courseId, tagIds],
  );
}
