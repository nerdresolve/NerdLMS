import type { CourseLevel, CourseVisibility } from "@nerdlms/core/courses/types.ts";

import { query } from "../db/pool.ts";

/**
 * Gravação dos metadados do curso — F2-03.
 */

export interface CourseMetadataFields {
  categoryId: string | null;
  code: string | null;
  workloadMinutes: number | null;
  level: CourseLevel | null;
  language: string | null;
  objectives: string | null;
  audience: string | null;
  startsOn: string | null;
  endsOn: string | null;
  visibility: CourseVisibility;
}

/**
 * Substitui os metadados.
 *
 * Devolve `false` quando o código já pertence a outro curso — o índice único
 * parcial da 007 (`courses_code_idx`) detecta, e o erro é convertido em
 * resposta. Deixar a exceção subir daria 500 para um conflito que o instrutor
 * resolve trocando três caracteres.
 *
 * A categoria é conferida contra o MESMO tenant do curso: sem isso, um id de
 * categoria de outro cliente entraria por aqui e o curso apareceria numa
 * árvore que não é a dele. A FK só garante que a categoria existe, não de quem
 * ela é.
 */
export async function updateCourseMetadata(
  courseId: string,
  fields: CourseMetadataFields,
): Promise<boolean> {
  try {
    await query(
      `UPDATE courses SET
         category_id = (
           SELECT cat.id FROM course_categories cat
            WHERE cat.id = $2 AND cat.tenant_id = courses.tenant_id
         ),
         code             = $3,
         workload_minutes = $4,
         level            = $5,
         language         = $6,
         objectives       = $7,
         audience         = $8,
         starts_on        = $9::date,
         ends_on          = $10::date,
         visibility       = $11,
         updated_at       = now()
       WHERE id = $1`,
      [
        courseId,
        fields.categoryId,
        fields.code,
        fields.workloadMinutes,
        fields.level,
        fields.language,
        fields.objectives,
        fields.audience,
        fields.startsOn,
        fields.endsOn,
        fields.visibility,
      ],
    );

    return true;
  } catch (error) {
    /* 23505 é violação de unicidade. Só o código pode colidir aqui, então não
       há ambiguidade sobre o que aconteceu. Qualquer outro erro sobe: engolir
       tudo esconderia defeito de verdade. */
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return false;
    }
    throw error;
  }
}
