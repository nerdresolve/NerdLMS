import { query } from "../db/pool.ts";

/**
 * Leitura das notas para exportação — F5-05 (guia §24, "exportar notas").
 *
 * Separado de `assignment-repository.ts` porque a pergunta é outra: lá se lê o
 * histórico de UMA matrícula para a tela de notas; aqui se lê o livro inteiro
 * do cliente para virar planilha.
 */

export interface GradeRowForExport {
  learnerId: string;
  learnerName: string;
  learnerEmail: string | null;
  project: string | null;
  courseId: string;
  courseTitle: string;
  /** A prova ou o trabalho. */
  activityId: string;
  activityKind: "quiz" | "assignment";
  activityTitle: string;
  pointsEarned: number;
  pointsPossible: number;
  weight: number;
  /** ISO 8601 — decide qual lançamento vale. */
  createdAt: string;
  gradedByName: string | null;
  reason: string | null;
}

/**
 * Todos os lançamentos do cliente, com quem, em quê e quando.
 *
 * **Devolve o HISTÓRICO, não só a nota vigente.** Quem decide qual vale é
 * `currentGrades`, no core, que compara pela data — a mesma regra que a tela
 * usa. Filtrar aqui na consulta duplicaria essa regra em SQL, e as duas
 * divergiriam na primeira mudança.
 *
 * O `title` da atividade vem de duas tabelas diferentes conforme o tipo, daí o
 * COALESCE: prova e trabalho são coisas distintas no banco e a mesma coisa na
 * planilha de notas.
 */
export async function findGradesForExport(tenantId: string): Promise<GradeRowForExport[]> {
  const rows = await query<{
    learner_id: string;
    learner_name: string;
    learner_email: string | null;
    project: string | null;
    course_id: string;
    course_title: string;
    activity_id: string;
    activity_kind: "quiz" | "assignment";
    activity_title: string;
    points_earned: string;
    points_possible: string;
    weight: string;
    created_at: Date;
    graded_by_name: string | null;
    reason: string | null;
  }>(
    `SELECT u.id            AS learner_id,
            u.full_name     AS learner_name,
            u.email::text   AS learner_email,
            u.project,
            c.id            AS course_id,
            c.title         AS course_title,
            COALESCE(g.quiz_id, g.assignment_id)               AS activity_id,
            CASE WHEN g.quiz_id IS NOT NULL THEN 'quiz'
                 ELSE 'assignment' END                          AS activity_kind,
            COALESCE(qz.title, a.title, 'Atividade removida')   AS activity_title,
            g.points_earned,
            g.points_possible,
            g.weight,
            g.created_at,
            avaliador.full_name AS graded_by_name,
            g.reason
       FROM grade_entries g
       JOIN enrollments e ON e.id = g.enrollment_id
       JOIN users u       ON u.id = e.learner_id
       JOIN courses c     ON c.id = e.course_id
       LEFT JOIN quizzes qz     ON qz.id = g.quiz_id
       LEFT JOIN assignments a  ON a.id = g.assignment_id
       LEFT JOIN users avaliador ON avaliador.id = g.graded_by
      WHERE g.tenant_id = $1
        /* Um lançamento sem prova nem trabalho não tem o que exportar: viraria
           uma linha sem atividade nenhuma na planilha. */
        AND (g.quiz_id IS NOT NULL OR g.assignment_id IS NOT NULL)
      ORDER BY u.full_name, c.title, g.created_at`,
    [tenantId],
  );

  return rows.map((row) => ({
    learnerId: row.learner_id,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    project: row.project,
    courseId: row.course_id,
    courseTitle: row.course_title,
    activityId: row.activity_id,
    activityKind: row.activity_kind,
    activityTitle: row.activity_title,
    /* `numeric` chega como texto no driver: `Number` aqui, e não no SQL, para
       não perder a precisão que o tipo existe para garantir. */
    pointsEarned: Number(row.points_earned),
    pointsPossible: Number(row.points_possible),
    weight: Number(row.weight),
    createdAt: row.created_at.toISOString(),
    gradedByName: row.graded_by_name,
    reason: row.reason,
  }));
}
