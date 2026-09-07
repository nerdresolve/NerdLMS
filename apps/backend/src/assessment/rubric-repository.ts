import { query } from "../db/pool.ts";

/**
 * Rubricas — F3-07.
 *
 * Uma rubrica é um conjunto de critérios, cada um com sua pontuação máxima. O
 * guia §8 pede "rubricas" e "critérios" como itens separados, e é isso: a
 * rubrica agrupa, o critério pontua.
 *
 * A nota do trabalho passa a ser a SOMA dos critérios em vez de um número
 * solto. A diferença para quem recebe é grande: "7 de 10" não diz o que
 * melhorar, "clareza 3/4, profundidade 2/4, referências 2/2" diz.
 */

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  position: number;
}

export interface Rubric {
  id: string;
  name: string;
  assignmentId?: string;
  criteria: RubricCriterion[];
  /** Soma dos máximos — quanto a rubrica inteira vale. */
  totalPoints: number;
}

/** A rubrica de um trabalho, com os critérios. */
export async function findRubric(assignmentId: string): Promise<Rubric | null> {
  const rows = await query<{ id: string; name: string; assignment_id: string | null }>(
    `SELECT id, name, assignment_id
       FROM rubrics
      WHERE assignment_id = $1
      ORDER BY created_at
      LIMIT 1`,
    [assignmentId],
  );

  const rubrica = rows[0];
  if (!rubrica) return null;

  const criterios = await query<{
    id: string;
    name: string;
    description: string | null;
    max_points: string;
    position: number;
  }>(
    `SELECT id, name, description, max_points, position
       FROM rubric_criteria
      WHERE rubric_id = $1
      ORDER BY position`,
    [rubrica.id],
  );

  const criteria = criterios.map((row) => ({
    id: row.id,
    name: row.name,
    maxPoints: Number(row.max_points),
    position: row.position,
    ...(row.description ? { description: row.description } : {}),
  }));

  return {
    id: rubrica.id,
    name: rubrica.name,
    criteria,
    totalPoints: criteria.reduce((soma, c) => soma + c.maxPoints, 0),
    ...(rubrica.assignment_id ? { assignmentId: rubrica.assignment_id } : {}),
  };
}

export interface NewRubric {
  tenantId: string;
  assignmentId: string;
  name: string;
  criteria: { name: string; description?: string | null; maxPoints: number }[];
}

/**
 * Cria a rubrica com os critérios.
 *
 * Substitui a anterior do mesmo trabalho: um trabalho tem UMA rubrica, e
 * acumular versões deixaria a correção sem saber qual usar. As notas já
 * lançadas ficam — elas vivem em `grade_entries`, que é append-only.
 */
export async function createRubric(input: NewRubric): Promise<string> {
  /* A antiga sai por cascata: `rubric_criteria` e `rubric_scores` referenciam
     com ON DELETE CASCADE. As notas já lançadas não: `grade_entries` não
     aponta para a rubrica. */
  await query(`DELETE FROM rubrics WHERE assignment_id = $1`, [input.assignmentId]);

  const rows = await query<{ id: string }>(
    `INSERT INTO rubrics (tenant_id, assignment_id, name)
     VALUES ($1, $2, btrim($3))
     RETURNING id`,
    [input.tenantId, input.assignmentId, input.name],
  );

  const rubricId = rows[0]!.id;

  if (input.criteria.length > 0) {
    await query(
      `INSERT INTO rubric_criteria (rubric_id, name, description, max_points, position)
       SELECT $1, * FROM unnest($2::text[], $3::text[], $4::numeric[], $5::int[])`,
      [
        rubricId,
        input.criteria.map((c) => c.name),
        input.criteria.map((c) => c.description ?? null),
        input.criteria.map((c) => c.maxPoints),
        input.criteria.map((_, i) => i + 1),
      ],
    );
  }

  return rubricId;
}

/** As notas por critério de uma entrega. */
export async function findRubricScores(
  submissionId: string,
): Promise<{ criterionId: string; points: number; comment?: string }[]> {
  const rows = await query<{ criterion_id: string; points: string; comment: string | null }>(
    `SELECT criterion_id, points, comment
       FROM rubric_scores
      WHERE submission_id = $1`,
    [submissionId],
  );

  return rows.map((row) => ({
    criterionId: row.criterion_id,
    points: Number(row.points),
    ...(row.comment ? { comment: row.comment } : {}),
  }));
}

/**
 * Grava as notas por critério.
 *
 * Sobrescreve as anteriores: corrigir de novo é refazer a avaliação, e o
 * histórico do que mudou vive em `grade_entries` — que registra a nota final e
 * o motivo, não o detalhe por critério.
 */
export async function saveRubricScores(
  submissionId: string,
  notas: { criterionId: string; points: number; comment?: string | null }[],
): Promise<void> {
  if (notas.length === 0) return;

  await query(
    `INSERT INTO rubric_scores (submission_id, criterion_id, points, comment)
     SELECT $1, * FROM unnest($2::uuid[], $3::numeric[], $4::text[])
     ON CONFLICT (submission_id, criterion_id) DO UPDATE SET
       points = EXCLUDED.points, comment = EXCLUDED.comment`,
    [
      submissionId,
      notas.map((n) => n.criterionId),
      notas.map((n) => n.points),
      notas.map((n) => n.comment ?? null),
    ],
  );
}
