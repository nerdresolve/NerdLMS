import type { GradableQuestion, QuestionKind, QuestionOption } from "@nerdlms/core/assessment/grading.ts";

import { query } from "../db/pool.ts";

/**
 * Banco de questões — F3-01.
 *
 * A questão é independente da prova: é o que a torna reutilizável. Ver o
 * comentário da migration 010.
 */

export interface Question extends GradableQuestion {
  prompt: string;
  explanation?: string;
  categoryId?: string;
  categoryName?: string;
  courseId?: string;
}

interface QuestionRow {
  id: string;
  kind: QuestionKind;
  prompt: string;
  points: string;
  explanation: string | null;
  tolerance: string | null;
  category_id: string | null;
  category_name: string | null;
  course_id: string | null;
}

interface OptionRow {
  id: string;
  question_id: string;
  text: string;
  match_text: string | null;
  is_correct: boolean;
  position: number;
  feedback: string | null;
}

function toOption(row: OptionRow): QuestionOption {
  return {
    id: row.id,
    text: row.text,
    isCorrect: row.is_correct,
    position: row.position,
    ...(row.match_text ? { matchText: row.match_text } : {}),
    ...(row.feedback ? { feedback: row.feedback } : {}),
  };
}

/**
 * As questões do banco, com as alternativas.
 *
 * Duas consultas e uma junção em memória, não uma consulta com JOIN: o JOIN
 * repetiria o enunciado em cada alternativa, e um enunciado longo multiplicado
 * por oito alternativas é tráfego que não serve para nada.
 */
export async function findQuestions(
  tenantId: string,
  filtro: { courseId?: string; categoryId?: string } = {},
): Promise<Question[]> {
  const rows = await query<QuestionRow>(
    `SELECT q.id, q.kind, q.prompt, q.points, q.explanation, q.tolerance,
            q.category_id, c.name AS category_name, q.course_id
       FROM questions q
       LEFT JOIN question_categories c ON c.id = q.category_id
      WHERE q.tenant_id = $1
        /* Banco do curso MAIS o global: uma prova monta com as duas fontes, e
           esconder o global obrigaria a duplicar a questão em cada curso. */
        AND ($2::uuid IS NULL OR q.course_id = $2 OR q.course_id IS NULL)
        AND ($3::uuid IS NULL OR q.category_id = $3)
      ORDER BY q.created_at DESC`,
    [tenantId, filtro.courseId ?? null, filtro.categoryId ?? null],
  );

  if (rows.length === 0) return [];

  const options = await query<OptionRow>(
    `SELECT o.id, o.question_id, o.text, o.match_text, o.is_correct, o.position, o.feedback
       FROM question_options o
      WHERE o.question_id = ANY($1::uuid[])
      ORDER BY o.position`,
    [rows.map((r) => r.id)],
  );

  const porQuestao = new Map<string, QuestionOption[]>();
  for (const row of options) {
    const lista = porQuestao.get(row.question_id) ?? [];
    lista.push(toOption(row));
    porQuestao.set(row.question_id, lista);
  }

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    prompt: row.prompt,
    /* `numeric` volta como string do driver, para não perder precisão. */
    points: Number(row.points),
    options: porQuestao.get(row.id) ?? [],
    ...(row.tolerance !== null ? { tolerance: Number(row.tolerance) } : {}),
    ...(row.explanation ? { explanation: row.explanation } : {}),
    ...(row.category_id ? { categoryId: row.category_id } : {}),
    ...(row.category_name ? { categoryName: row.category_name } : {}),
    ...(row.course_id ? { courseId: row.course_id } : {}),
  }));
}

/** As questões de uma prova, na ordem, com o peso que vale ALI. */
export async function findQuizQuestions(quizId: string): Promise<Question[]> {
  const rows = await query<QuestionRow & { override_points: string | null }>(
    `SELECT q.id, q.kind, q.prompt, q.points, q.explanation, q.tolerance,
            q.category_id, NULL AS category_name, q.course_id,
            qq.points AS override_points
       FROM quiz_questions qq
       JOIN questions q ON q.id = qq.question_id
      WHERE qq.quiz_id = $1
      ORDER BY qq.position`,
    [quizId],
  );

  if (rows.length === 0) return [];

  const options = await query<OptionRow>(
    `SELECT o.id, o.question_id, o.text, o.match_text, o.is_correct, o.position, o.feedback
       FROM question_options o
      WHERE o.question_id = ANY($1::uuid[])
      ORDER BY o.position`,
    [rows.map((r) => r.id)],
  );

  const porQuestao = new Map<string, QuestionOption[]>();
  for (const row of options) {
    const lista = porQuestao.get(row.question_id) ?? [];
    lista.push(toOption(row));
    porQuestao.set(row.question_id, lista);
  }

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    prompt: row.prompt,
    /* O peso da prova ganha do peso próprio: a mesma questão vale 1 num quiz
       rápido e 5 na prova final. */
    points: Number(row.override_points ?? row.points),
    options: porQuestao.get(row.id) ?? [],
    ...(row.tolerance !== null ? { tolerance: Number(row.tolerance) } : {}),
    ...(row.explanation ? { explanation: row.explanation } : {}),
  }));
}

export interface NewQuestion {
  tenantId: string;
  courseId?: string | null;
  categoryId?: string | null;
  kind: QuestionKind;
  prompt: string;
  points: number;
  explanation?: string | null;
  tolerance?: number | null;
  authorId: string;
  options: {
    text: string;
    matchText?: string | null;
    isCorrect: boolean;
    position: number;
    feedback?: string | null;
  }[];
}

/**
 * Cria a questão com as alternativas, numa transação implícita.
 *
 * As alternativas entram numa instrução só, com `unnest`: uma por INSERT daria
 * N viagens e abriria uma janela em que a questão existe sem gabarito — e uma
 * questão sem alternativa correta vale zero para todo mundo que responder.
 */
export async function createQuestion(input: NewQuestion): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO questions
            (tenant_id, course_id, category_id, kind, prompt, points, explanation, tolerance, author_id)
     VALUES ($1, $2, $3, $4, btrim($5), $6, $7, $8, $9)
     RETURNING id`,
    [
      input.tenantId,
      input.courseId ?? null,
      input.categoryId ?? null,
      input.kind,
      input.prompt,
      input.points,
      input.explanation ?? null,
      input.tolerance ?? null,
      input.authorId,
    ],
  );

  const id = rows[0]!.id;

  if (input.options.length > 0) {
    await query(
      `INSERT INTO question_options (question_id, text, match_text, is_correct, position, feedback)
       SELECT $1, * FROM unnest($2::text[], $3::text[], $4::bool[], $5::int[], $6::text[])`,
      [
        id,
        input.options.map((o) => o.text),
        input.options.map((o) => o.matchText ?? null),
        input.options.map((o) => o.isCorrect),
        input.options.map((o) => o.position),
        input.options.map((o) => o.feedback ?? null),
      ],
    );
  }

  return id;
}

/** Remove a questão. As alternativas caem por cascata. */
export async function deleteQuestion(questionId: string, tenantId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM questions WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [questionId, tenantId],
  );

  return rows.length > 0;
}

/**
 * Duplica uma questão — o "duplicar" que o guia §7 pede no banco.
 *
 * Serve para variar um enunciado sem reescrever as oito alternativas.
 */
export async function duplicateQuestion(
  questionId: string,
  tenantId: string,
  authorId: string,
): Promise<string | null> {
  /* O id vem do INSERT da QUESTÃO, não do das alternativas.
     
     A primeira versão devolvia o `RETURNING` do insert de alternativas, e uma
     questão sem alternativas — toda dissertativa — copiava a questão e
     devolvia zero linhas. Quem chamou concluiria que falhou, e a cópia ficaria
     órfã no banco. Verificado antes de descobrir em produção. */
  const rows = await query<{ id: string }>(
    `WITH nova AS (
       INSERT INTO questions
              (tenant_id, course_id, category_id, kind, prompt, points, explanation, tolerance, author_id)
       SELECT q.tenant_id, q.course_id, q.category_id, q.kind,
              q.prompt || ' (cópia)', q.points, q.explanation, q.tolerance, $3
         FROM questions q
        WHERE q.id = $1 AND q.tenant_id = $2
       RETURNING id
     ),
     copiadas AS (
       INSERT INTO question_options (question_id, text, match_text, is_correct, position, feedback)
       SELECT (SELECT id FROM nova), o.text, o.match_text, o.is_correct, o.position, o.feedback
         FROM question_options o
        WHERE o.question_id = $1
          /* Sem a cópia da questão não há onde pendurar alternativa. */
          AND EXISTS (SELECT 1 FROM nova)
       RETURNING 1
     )
     SELECT id FROM nova`,
    [questionId, tenantId, authorId],
  );

  return rows[0]?.id ?? null;
}
