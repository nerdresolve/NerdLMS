import type { CourseClass } from "@nerdlms/core/courses/classes.ts";

import { query } from "../db/pool.ts";

/**
 * Turmas — F2-02.
 *
 * A contagem de matriculados vem por subconsulta, junto: turma e ocupação só
 * fazem sentido lidas ao mesmo tempo, e separá-las daria duas viagens para
 * montar uma linha de tabela.
 */

interface ClassRow {
  id: string;
  course_id: string;
  name: string;
  instructor_id: string | null;
  instructor_name: string | null;
  starts_on: Date | null;
  ends_on: Date | null;
  capacity: number | null;
  status: "open" | "closed";
  enrolled: string;
}

/** `date` do Postgres → "AAAA-MM-DD", sem passar por fuso. */
function isoDate(value: Date | null): string | undefined {
  if (!value) return undefined;
  const ano = value.getFullYear();
  const mes = String(value.getMonth() + 1).padStart(2, "0");
  const dia = String(value.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function toClass(row: ClassRow): CourseClass {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    status: row.status,
    enrolled: Number(row.enrolled),
    ...(row.instructor_id ? { instructorId: row.instructor_id } : {}),
    ...(row.instructor_name ? { instructorName: row.instructor_name } : {}),
    ...(isoDate(row.starts_on) ? { startsOn: isoDate(row.starts_on)! } : {}),
    ...(isoDate(row.ends_on) ? { endsOn: isoDate(row.ends_on)! } : {}),
    ...(row.capacity !== null ? { capacity: row.capacity } : {}),
  };
}

/* As duas consultas abaixo repetem a lista de colunas de propósito.
   
   Extrair um `SELECT_CLASS` compartilhado era mais enxuto e escondia o recorte:
   a verificação de isolamento (`query-isolation.test.ts`) lê cada template
   literal isoladamente, e via um `FROM course_classes` sem WHERE nenhum. Ela
   estava certa em reprovar — uma consulta cujo recorte mora noutro lugar é
   exatamente o que ninguém consegue auditar de relance. */

/** As turmas de um curso, da mais recente para a mais antiga. */
export async function findClasses(courseId: string): Promise<CourseClass[]> {
  const rows = await query<ClassRow>(
    `SELECT cl.id, cl.course_id, cl.name, cl.instructor_id, u.full_name AS instructor_name,
            cl.starts_on, cl.ends_on, cl.capacity, cl.status,
            (SELECT count(*) FROM enrollments e WHERE e.class_id = cl.id) AS enrolled
       FROM course_classes cl
       LEFT JOIN users u ON u.id = cl.instructor_id
      WHERE cl.course_id = $1
      ORDER BY cl.starts_on DESC NULLS LAST, cl.name`,
    [courseId],
  );

  return rows.map(toClass);
}

/** Uma turma, para decidir matrícula. */
export async function findClass(classId: string): Promise<CourseClass | null> {
  const rows = await query<ClassRow>(
    `SELECT cl.id, cl.course_id, cl.name, cl.instructor_id, u.full_name AS instructor_name,
            cl.starts_on, cl.ends_on, cl.capacity, cl.status,
            (SELECT count(*) FROM enrollments e WHERE e.class_id = cl.id) AS enrolled
       FROM course_classes cl
       LEFT JOIN users u ON u.id = cl.instructor_id
      WHERE cl.id = $1
      LIMIT 1`,
    [classId],
  );

  const row = rows[0];
  return row ? toClass(row) : null;
}

export interface NewClass {
  tenantId: string;
  courseId: string;
  name: string;
  instructorId?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  capacity?: number | null;
}

/**
 * Cria uma turma.
 *
 * Devolve `null` quando já existe outra com o mesmo nome no curso — o índice
 * único da 008 detecta, e `ON CONFLICT DO NOTHING` transforma a violação em
 * resposta em vez de erro 500. Duas "Turma de março" no mesmo curso tornariam
 * o relatório ambíguo para quem o lê.
 */
export async function createClass(input: NewClass): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO course_classes
            (tenant_id, course_id, name, instructor_id, starts_on, ends_on, capacity)
     VALUES ($1, $2, btrim($3), $4, $5::date, $6::date, $7)
     ON CONFLICT (course_id, name) DO NOTHING
     RETURNING id`,
    [
      input.tenantId,
      input.courseId,
      input.name,
      input.instructorId ?? null,
      input.startsOn ?? null,
      input.endsOn ?? null,
      input.capacity ?? null,
    ],
  );

  return rows[0]?.id ?? null;
}

/** Abre ou fecha a turma para novas matrículas. */
export async function setClassStatus(classId: string, status: "open" | "closed"): Promise<void> {
  await query(`UPDATE course_classes SET status = $2 WHERE id = $1`, [classId, status]);
}

/**
 * Move as matrículas informadas para uma turma.
 *
 * O gatilho da 008 recusa turma de outro curso; aqui a condição `course_id`
 * repete a regra para a operação simplesmente não afetar linha nenhuma em vez
 * de estourar exceção no meio de um lote.
 */
export async function assignToClass(
  classId: string,
  courseId: string,
  learnerIds: string[],
): Promise<number> {
  if (learnerIds.length === 0) return 0;

  const rows = await query<{ id: string }>(
    `UPDATE enrollments
        SET class_id = $1
      WHERE course_id = $2 AND learner_id = ANY($3::uuid[])
      RETURNING id`,
    [classId, courseId, learnerIds],
  );

  return rows.length;
}
