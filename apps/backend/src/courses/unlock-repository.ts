import type { UnlockKind, UnlockRule } from "@nerdlms/core/courses/unlock.ts";

import { query } from "../db/pool.ts";

/**
 * Regras de liberação — F2-04 e F2-05.
 */

interface RuleRow {
  kind: UnlockKind;
  required_course_id: string | null;
  required_module_id: string | null;
  required_lesson_id: string | null;
  required_class_id: string | null;
  required_date: Date | null;
  required_grade: number | null;
  required_label: string | null;
}

function isoDate(value: Date | null): string | undefined {
  if (!value) return undefined;
  const mes = String(value.getMonth() + 1).padStart(2, "0");
  const dia = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${mes}-${dia}`;
}

function toRule(row: RuleRow): UnlockRule {
  return {
    kind: row.kind,
    ...(row.required_course_id ? { requiredCourseId: row.required_course_id } : {}),
    ...(row.required_module_id ? { requiredModuleId: row.required_module_id } : {}),
    ...(row.required_lesson_id ? { requiredLessonId: row.required_lesson_id } : {}),
    ...(row.required_class_id ? { requiredClassId: row.required_class_id } : {}),
    ...(isoDate(row.required_date) ? { requiredDate: isoDate(row.required_date)! } : {}),
    ...(row.required_grade !== null ? { requiredGrade: row.required_grade } : {}),
    ...(row.required_label ? { requiredLabel: row.required_label } : {}),
  };
}

/* As duas consultas abaixo repetem as junções de propósito: um SELECT
   compartilhado esconderia o recorte da verificação de isolamento, que lê cada
   template literal isoladamente. Ver o comentário em `class-repository`.

   O `COALESCE` traz o RÓTULO do que a regra exige, das três origens possíveis,
   numa consulta só: sem ele a tela diria "conclua o curso anterior" sem dizer
   qual, e a pessoa não teria como agir sobre a informação. */

/** As regras que governam uma aula. */
export async function findLessonRules(lessonId: string): Promise<UnlockRule[]> {
  const rows = await query<RuleRow>(
    `SELECT r.kind, r.required_course_id, r.required_module_id, r.required_lesson_id,
            r.required_class_id, r.required_date, r.required_grade,
            COALESCE(rc.title, rm.title, rl.title, rcl.name) AS required_label
       FROM unlock_rules r
       LEFT JOIN courses        rc  ON rc.id  = r.required_course_id
       LEFT JOIN modules        rm  ON rm.id  = r.required_module_id
       LEFT JOIN lessons        rl  ON rl.id  = r.required_lesson_id
       LEFT JOIN course_classes rcl ON rcl.id = r.required_class_id
      WHERE r.lesson_id = $1
      ORDER BY r.created_at`,
    [lessonId],
  );

  return rows.map(toRule);
}

/** As regras que governam um curso inteiro. */
export async function findCourseRules(courseId: string): Promise<UnlockRule[]> {
  const rows = await query<RuleRow>(
    `SELECT r.kind, r.required_course_id, r.required_module_id, r.required_lesson_id,
            r.required_class_id, r.required_date, r.required_grade,
            COALESCE(rc.title, rm.title, rl.title, rcl.name) AS required_label
       FROM unlock_rules r
       LEFT JOIN courses        rc  ON rc.id  = r.required_course_id
       LEFT JOIN modules        rm  ON rm.id  = r.required_module_id
       LEFT JOIN lessons        rl  ON rl.id  = r.required_lesson_id
       LEFT JOIN course_classes rcl ON rcl.id = r.required_class_id
      WHERE r.course_id = $1
      ORDER BY r.created_at`,
    [courseId],
  );

  return rows.map(toRule);
}

export interface NewRule {
  tenantId: string;
  /** Exatamente um destes. */
  courseId?: string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  kind: UnlockKind;
  requiredCourseId?: string | null;
  requiredModuleId?: string | null;
  requiredLessonId?: string | null;
  requiredClassId?: string | null;
  requiredDate?: string | null;
  requiredGrade?: number | null;
}

/**
 * Cria uma regra.
 *
 * Devolve `null` quando os CHECKs da 009 recusam — alvo ambíguo, ou referência
 * que não combina com o tipo. Converter em resposta é melhor que deixar a
 * exceção subir: são erros de preenchimento, não defeitos.
 */
export async function createRule(input: NewRule): Promise<string | null> {
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO unlock_rules
              (tenant_id, course_id, module_id, lesson_id, kind,
               required_course_id, required_module_id, required_lesson_id,
               required_class_id, required_date, required_grade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11)
       RETURNING id`,
      [
        input.tenantId,
        input.courseId ?? null,
        input.moduleId ?? null,
        input.lessonId ?? null,
        input.kind,
        input.requiredCourseId ?? null,
        input.requiredModuleId ?? null,
        input.requiredLessonId ?? null,
        input.requiredClassId ?? null,
        input.requiredDate ?? null,
        input.requiredGrade ?? null,
      ],
    );

    return rows[0]?.id ?? null;
  } catch (error) {
    /* 23514 é violação de CHECK. Qualquer outro erro sobe: engolir tudo
       esconderia defeito de verdade. */
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23514") {
      return null;
    }
    throw error;
  }
}

export async function deleteRule(ruleId: string, tenantId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM unlock_rules WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [ruleId, tenantId],
  );

  return rows.length > 0;
}

/** Define se o curso libera o conteúdo em sequência. */
export async function setContentRelease(
  courseId: string,
  release: "open" | "sequential",
): Promise<void> {
  await query(`UPDATE courses SET content_release = $2 WHERE id = $1`, [courseId, release]);
}

/**
 * Liga ou desliga a trava do player do curso.
 *
 * Fica junto de `setContentRelease` porque são a mesma natureza de ajuste: as
 * duas decidem como o conteúdo é consumido, e nenhuma altera o conteúdo.
 */
export async function setWatchGuard(courseId: string, ligada: boolean): Promise<void> {
  await query(`UPDATE courses SET watch_guard = $2 WHERE id = $1`, [courseId, ligada]);
}
