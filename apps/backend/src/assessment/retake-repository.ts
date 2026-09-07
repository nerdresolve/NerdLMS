import type { StatusPedido } from "@nerdlms/core/assessment/retake.ts";

import { query } from "../db/pool.ts";

/**
 * Pedidos de reteste.
 *
 * O pedido pertence à MATRÍCULA, como a tentativa: quem sai do curso e volta
 * começa outro vínculo, e o pedido antigo não o acompanha.
 */

export interface PedidoDeReteste {
  id: string;
  quizId: string;
  quizTitle: string;
  courseId: string;
  courseTitle: string;
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
  learnerNote: string | null;
  status: StatusPedido;
  comment: string | null;
  decidedByName: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  /** Melhor percentual já obtido nesta prova, para o instrutor decidir com contexto. */
  melhorPercentual: number | null;
  tentativasUsadas: number;
}

const CAMPOS = `
  r.id, r.quiz_id, r.enrollment_id, r.learner_note, r.status, r.comment,
  r.created_at, r.decided_at,
  q.title AS quiz_title, q.course_id,
  c.title AS course_title,
  e.learner_id,
  u.full_name AS learner_name,
  d.full_name AS decided_by_name,
  (SELECT max(a.score_percent) FROM quiz_attempts a
    WHERE a.quiz_id = r.quiz_id AND a.enrollment_id = r.enrollment_id) AS melhor,
  (SELECT count(*) FROM quiz_attempts a
    WHERE a.quiz_id = r.quiz_id AND a.enrollment_id = r.enrollment_id
      AND a.submitted_at IS NOT NULL) AS tentativas`;

interface Row {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  learner_note: string | null;
  status: string;
  comment: string | null;
  created_at: Date;
  decided_at: Date | null;
  quiz_title: string;
  course_id: string;
  course_title: string;
  learner_id: string;
  learner_name: string;
  decided_by_name: string | null;
  melhor: string | null;
  tentativas: string;
}

function toPedido(row: Row): PedidoDeReteste {
  return {
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    courseId: row.course_id,
    courseTitle: row.course_title,
    enrollmentId: row.enrollment_id,
    learnerId: row.learner_id,
    learnerName: row.learner_name,
    learnerNote: row.learner_note,
    status: row.status as StatusPedido,
    comment: row.comment,
    decidedByName: row.decided_by_name,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    melhorPercentual: row.melhor === null ? null : Number(row.melhor),
    tentativasUsadas: Number(row.tentativas),
  };
}

/**
 * Quantos retestes já foram aprovados para esta prova e matrícula.
 *
 * É o que soma tentativas: uma de saída, mais uma por aprovação.
 */
export async function retestesAprovados(
  quizId: string,
  enrollmentId: string,
): Promise<number> {
  const rows = await query<{ total: string }>(
    `SELECT count(*) AS total FROM quiz_retake_requests
      WHERE quiz_id = $1 AND enrollment_id = $2 AND status = 'approved'`,
    [quizId, enrollmentId],
  );

  return Number(rows[0]?.total ?? 0);
}

/** Há pedido esperando decisão? */
export async function pedidoPendente(
  quizId: string,
  enrollmentId: string,
): Promise<PedidoDeReteste | null> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS}
       FROM quiz_retake_requests r
       JOIN quizzes q ON q.id = r.quiz_id
       JOIN courses c ON c.id = q.course_id
       JOIN enrollments e ON e.id = r.enrollment_id
       JOIN users u ON u.id = e.learner_id
       LEFT JOIN users d ON d.id = r.decided_by
      WHERE r.quiz_id = $1 AND r.enrollment_id = $2 AND r.status = 'pending'
      LIMIT 1`,
    [quizId, enrollmentId],
  );

  const row = rows[0];
  return row ? toPedido(row) : null;
}

/**
 * Cria o pedido.
 *
 * `ON CONFLICT DO NOTHING` sobre o índice parcial de pendentes: dois cliques no
 * botão não criam dois pedidos, e o instrutor não vê a mesma pessoa duas vezes
 * na fila. Devolve `null` quando já havia um — quem chamou trata como "já
 * pedido", que é a verdade.
 */
export async function criarPedido(input: {
  tenantId: string;
  quizId: string;
  enrollmentId: string;
  learnerNote: string | null;
}): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO quiz_retake_requests (tenant_id, quiz_id, enrollment_id, learner_note)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [input.tenantId, input.quizId, input.enrollmentId, input.learnerNote],
  );

  return rows[0]?.id ?? null;
}

/**
 * A fila de quem decide.
 *
 * Só as provas dos cursos deste instrutor — o recorte é por `author_id`, o
 * mesmo que decide quem pode editar o curso. Administrador vê tudo do cliente,
 * e é por isso que `authorId` é opcional.
 */
export async function pedidosPendentes(
  tenantId: string,
  authorId: string | null,
): Promise<PedidoDeReteste[]> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS}
       FROM quiz_retake_requests r
       JOIN quizzes q ON q.id = r.quiz_id
       JOIN courses c ON c.id = q.course_id
       JOIN enrollments e ON e.id = r.enrollment_id
       JOIN users u ON u.id = e.learner_id
       LEFT JOIN users d ON d.id = r.decided_by
      WHERE r.tenant_id = $1
        AND r.status = 'pending'
        AND ($2::uuid IS NULL OR c.author_id = $2)
      ORDER BY r.created_at`,
    [tenantId, authorId],
  );

  return rows.map(toPedido);
}

/** Um pedido, para conferir a permissão antes de decidir. */
export async function pedidoPorId(id: string): Promise<PedidoDeReteste | null> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS}
       FROM quiz_retake_requests r
       JOIN quizzes q ON q.id = r.quiz_id
       JOIN courses c ON c.id = q.course_id
       JOIN enrollments e ON e.id = r.enrollment_id
       JOIN users u ON u.id = e.learner_id
       LEFT JOIN users d ON d.id = r.decided_by
      WHERE r.id = $1`,
    [id],
  );

  const row = rows[0];
  return row ? toPedido(row) : null;
}

/**
 * Registra a decisão.
 *
 * `WHERE status = 'pending'` torna a operação idempotente: dois instrutores
 * decidindo ao mesmo tempo, ou dois cliques, e só o primeiro vale. Devolve
 * `false` no segundo — quem chamou responde "já decidido" em vez de
 * sobrescrever o comentário de outra pessoa.
 */
export async function decidirPedido(input: {
  id: string;
  status: "approved" | "denied";
  comentario: string;
  decidedBy: string;
}): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE quiz_retake_requests
        SET status = $2, comment = $3, decided_by = $4, decided_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING id`,
    [input.id, input.status, input.comentario, input.decidedBy],
  );

  return rows.length > 0;
}

/** O histórico de um aluno numa prova, para a tela mostrar o que foi decidido. */
export async function historicoDoAluno(
  quizId: string,
  enrollmentId: string,
): Promise<PedidoDeReteste[]> {
  const rows = await query<Row>(
    `SELECT ${CAMPOS}
       FROM quiz_retake_requests r
       JOIN quizzes q ON q.id = r.quiz_id
       JOIN courses c ON c.id = q.course_id
       JOIN enrollments e ON e.id = r.enrollment_id
       JOIN users u ON u.id = e.learner_id
       LEFT JOIN users d ON d.id = r.decided_by
      WHERE r.quiz_id = $1 AND r.enrollment_id = $2
      ORDER BY r.created_at DESC`,
    [quizId, enrollmentId],
  );

  return rows.map(toPedido);
}

export interface EstadoDaProvaNoCurso {
  quizId: string;
  quizTitle: string;
  questionCount: number;
  /** Percentual mínimo exigido pela prova. */
  passingScore: number;
  melhorPercentual: number | null;
  tentativasUsadas: number;
  retestesAprovados: number;
  pedidoPendente: boolean;
}

/**
 * O estado da prova de cada curso, para UM aluno.
 *
 * Uma consulta só, indexada por curso. As telas precisam disso para três
 * decisões que hoje elas tomam no escuro: se o curso está mesmo concluído, se o
 * botão de fazer a prova deve aparecer, e se o de pedir reteste deve.
 *
 * Buscar por curso, dentro de um laço, daria uma ida ao banco por cartão do
 * catálogo — e a lista de cursos é a tela mais aberta do produto.
 */
export async function estadoDasProvas(
  learnerId: string,
): Promise<Map<string, EstadoDaProvaNoCurso>> {
  const rows = await query<{
    course_id: string;
    quiz_id: string;
    quiz_title: string;
    passing_score: string;
    questoes: string;
    melhor: string | null;
    tentativas: string;
    aprovados: string;
    pendentes: string;
  }>(
    `SELECT q.course_id, q.id AS quiz_id, q.title AS quiz_title, q.passing_score,
            (SELECT count(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS questoes,
            (SELECT max(a.score_percent) FROM quiz_attempts a
              WHERE a.quiz_id = q.id AND a.enrollment_id = e.id) AS melhor,
            (SELECT count(*) FROM quiz_attempts a
              WHERE a.quiz_id = q.id AND a.enrollment_id = e.id
                AND a.submitted_at IS NOT NULL) AS tentativas,
            (SELECT count(*) FROM quiz_retake_requests r
              WHERE r.quiz_id = q.id AND r.enrollment_id = e.id
                AND r.status = 'approved') AS aprovados,
            (SELECT count(*) FROM quiz_retake_requests r
              WHERE r.quiz_id = q.id AND r.enrollment_id = e.id
                AND r.status = 'pending') AS pendentes
       FROM enrollments e
       JOIN quizzes q ON q.course_id = e.course_id
      WHERE e.learner_id = $1`,
    [learnerId],
  );

  return new Map(
    rows.map((row) => [
      row.course_id,
      {
        quizId: row.quiz_id,
        quizTitle: row.quiz_title,
        questionCount: Number(row.questoes),
        passingScore: Number(row.passing_score),
        melhorPercentual: row.melhor === null ? null : Number(row.melhor),
        tentativasUsadas: Number(row.tentativas),
        retestesAprovados: Number(row.aprovados),
        pedidoPendente: Number(row.pendentes) > 0,
      },
    ]),
  );
}
