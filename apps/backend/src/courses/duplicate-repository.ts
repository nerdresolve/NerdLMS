import { query } from "../db/pool.ts";

/**
 * Duplicar curso — F2-07.
 *
 * Vem por último no F2 de propósito: duplicar tem de copiar tudo o que os
 * itens anteriores criaram — categoria, metadados, tags, módulos, aulas e
 * regras de liberação. Fazê-lo antes significaria revisitá-lo a cada item.
 *
 * O QUE NÃO SE COPIA, e por quê:
 *
 * - matrículas e progresso: são de pessoas, não do curso. Copiá-las
 *   matricularia gente num curso que ela não escolheu;
 * - turmas: uma turma tem data e instrutor próprios, e "Turma de março" numa
 *   cópia feita em setembro é lixo;
 * - comentários: são conversa entre pessoas sobre aulas específicas;
 * - a situação: a cópia nasce RASCUNHO, sempre. Duplicar um curso publicado e
 *   já publicar a cópia colocaria conteúdo não revisado no catálogo.
 */

export interface DuplicateResult {
  courseId: string;
  modules: number;
  lessons: number;
}

/**
 * Copia o curso inteiro numa transação.
 *
 * Tudo ou nada: uma cópia que falhasse no meio deixaria um curso com metade
 * dos módulos, e o instrutor não teria como saber o que faltou.
 *
 * Os ids novos são gerados pelo banco. O mapeamento antigo→novo é mantido em
 * tabelas temporárias da própria consulta (`RETURNING` com `JOIN`), porque é o
 * que permite as aulas encontrarem seus módulos novos sem uma segunda viagem
 * por módulo.
 */
export async function duplicateCourse(
  courseId: string,
  novoSlug: string,
  novoTitulo: string,
  authorId: string,
): Promise<DuplicateResult | null> {
  const rows = await query<{ id: string; modules: string; lessons: string }>(
    `WITH novo AS (
       INSERT INTO courses (
         tenant_id, org_unit_id, author_id, slug, title, summary, status,
         enrollment_mode, project, artwork,
         category_id, code, workload_minutes, level, language,
         objectives, audience, starts_on, ends_on, visibility, content_release
       )
       SELECT c.tenant_id, c.org_unit_id, $4, $2, $3, c.summary,
              /* A cópia nasce rascunho, sempre. */
              'draft',
              c.enrollment_mode, c.project, c.artwork,
              c.category_id,
              /* O código é único por tenant: copiá-lo violaria o índice e
                 derrubaria a duplicação inteira. Fica em branco para o
                 instrutor decidir. */
              NULL,
              c.workload_minutes, c.level, c.language,
              c.objectives, c.audience, c.starts_on, c.ends_on,
              c.visibility, c.content_release
         FROM courses c
        WHERE c.id = $1
       RETURNING id, tenant_id
     ),
     mods AS (
       INSERT INTO modules (course_id, title, position)
       SELECT (SELECT id FROM novo), m.title, m.position
         FROM modules m
        WHERE m.course_id = $1
        ORDER BY m.position
       RETURNING id, position
     ),
     aulas AS (
       INSERT INTO lessons (module_id, title, position, duration_seconds, kind, media_key, completion_mode)
       SELECT novo_m.id, l.title, l.position, l.duration_seconds, l.kind, l.media_key, l.completion_mode
         FROM lessons l
         JOIN modules velho_m ON velho_m.id = l.module_id
         /* Os módulos novos casam com os antigos pela POSIÇÃO, que é única
            dentro do curso e preservada na cópia acima. */
         JOIN mods novo_m ON novo_m.position = velho_m.position
        WHERE velho_m.course_id = $1
       RETURNING id
     ),
     etiquetas AS (
       INSERT INTO course_tags (course_id, tag_id)
       SELECT (SELECT id FROM novo), ct.tag_id
         FROM course_tags ct
        WHERE ct.course_id = $1
       RETURNING tag_id
     ),
     regras AS (
       /* Só as regras do CURSO. As de aula apontariam para aulas antigas — e
          reescrevê-las exigiria o mapeamento aula→aula, que esta consulta não
          produz. Ficam para o instrutor refazer na cópia, que é honesto:
          uma regra copiada apontando para o curso original seria pior. */
       INSERT INTO unlock_rules (
         tenant_id, course_id, kind,
         required_course_id, required_module_id, required_lesson_id,
         required_class_id, required_date, required_grade
       )
       SELECT (SELECT tenant_id FROM novo), (SELECT id FROM novo), r.kind,
              r.required_course_id, r.required_module_id, r.required_lesson_id,
              r.required_class_id, r.required_date, r.required_grade
         FROM unlock_rules r
        WHERE r.course_id = $1
       RETURNING id
     )
     SELECT (SELECT id FROM novo) AS id,
            (SELECT count(*) FROM mods)  AS modules,
            (SELECT count(*) FROM aulas) AS lessons`,
    [courseId, novoSlug, novoTitulo, authorId],
  );

  const row = rows[0];
  if (!row?.id) return null;

  return { courseId: row.id, modules: Number(row.modules), lessons: Number(row.lessons) };
}

/** Slugs já usados no tenant, para gerar um livre. */
export async function findSlugsLike(tenantId: string, prefixo: string): Promise<string[]> {
  const rows = await query<{ slug: string }>(
    `SELECT slug FROM courses WHERE tenant_id = $1 AND slug LIKE $2`,
    [tenantId, `${prefixo}%`],
  );

  return rows.map((row) => row.slug);
}
