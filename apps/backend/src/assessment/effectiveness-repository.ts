import type { GradeEntry } from "@nerdlms/core/assessment/gradebook.ts";
import type { Veredito } from "@nerdlms/core/assessment/eficacia.ts";

import { query } from "../db/pool.ts";

/**
 * Avaliação de eficácia do treinamento — leitura e registro.
 *
 * A FILA NÃO É UMA TABELA
 *
 * Não existe linha "fulano concluiu o curso X": concluir é ter visto todas as
 * aulas e, quando o curso exige, ter batido a nota mínima. A consulta daqui
 * traz os CANDIDATOS — quem já viu tudo e ainda não foi avaliado — e a regra da
 * nota fica no caso de uso, que chama `courseGrade` e `meetsCertificateGrade`,
 * as mesmas funções que o certificado usa. Reescrever a média ponderada em SQL
 * daria dois lugares para a mesma regra e um dia eles discordariam.
 */

export interface CandidatoAEficacia {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  /** Nulo quando o curso não exige nota. */
  minGradePercent: number | null;
  learnerId: string;
  learnerName: string;
  /** A área da pessoa, para o instrutor saber com quem falar. */
  learnerProject: string | null;
  /** A última aula concluída: é ela que inicia o prazo. */
  concluidoEm: Date;
}

interface CandidatoRow {
  enrollment_id: string;
  course_id: string;
  course_title: string;
  min_grade_percent: string | null;
  learner_id: string;
  learner_name: string;
  learner_project: string | null;
  concluido_em: Date;
}

/**
 * Quem terminou as aulas e ainda não tem avaliação valendo.
 *
 * `authorId` nulo é "sem recorte", para o administrador ver a fila inteira —
 * mesma convenção de `pedidosPendentes`.
 *
 * A condição de conclusão é escrita como "não falta nenhuma aula", e não como
 * "a contagem de concluídas é igual à de aulas": a segunda daria conclusão para
 * um curso sem nenhuma aula, onde 0 = 0. O `EXISTS` de fora garante que existe
 * ao menos uma.
 */
export async function candidatosAEficacia(
  tenantId: string,
  authorId: string | null,
): Promise<CandidatoAEficacia[]> {
  const rows = await query<CandidatoRow>(
    `SELECT e.id            AS enrollment_id,
            c.id            AS course_id,
            c.title         AS course_title,
            c.min_grade_percent,
            u.id            AS learner_id,
            u.full_name     AS learner_name,
            u.project       AS learner_project,
            (SELECT max(lp.completed_at)
               FROM lesson_progress lp
              WHERE lp.enrollment_id = e.id) AS concluido_em
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.learner_id
      WHERE c.tenant_id = $1
        AND ($2::uuid IS NULL OR c.author_id = $2)
        AND EXISTS (
              SELECT 1 FROM modules m JOIN lessons l ON l.module_id = m.id
               WHERE m.course_id = c.id
            )
        AND NOT EXISTS (
              SELECT 1
                FROM modules m
                JOIN lessons l ON l.module_id = m.id
               WHERE m.course_id = c.id
                 AND NOT EXISTS (
                       SELECT 1 FROM lesson_progress lp
                        WHERE lp.enrollment_id = e.id
                          AND lp.lesson_id = l.id
                          AND lp.completed_at IS NOT NULL
                     )
            )
        AND NOT EXISTS (
              SELECT 1 FROM effectiveness_reviews r
               WHERE r.enrollment_id = e.id
                 AND r.revoked_at IS NULL
            )
      ORDER BY concluido_em`,
    [tenantId, authorId],
  );

  return rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    minGradePercent: row.min_grade_percent === null ? null : Number(row.min_grade_percent),
    learnerId: row.learner_id,
    learnerName: row.learner_name,
    learnerProject: row.learner_project,
    concluidoEm: row.concluido_em,
  }));
}

/**
 * As notas de várias matrículas de uma vez.
 *
 * Uma consulta e não uma por matrícula: a fila de um instrutor com três turmas
 * pediria trinta consultas, e é o mesmo N+1 que `findUngradedSubmissions` já
 * evita na fila de correção.
 */
export async function notasDasMatriculas(
  tenantId: string,
  enrollmentIds: string[],
): Promise<Map<string, GradeEntry[]>> {
  const porMatricula = new Map<string, GradeEntry[]>();
  if (enrollmentIds.length === 0) return porMatricula;

  const rows = await query<{
    enrollment_id: string;
    id: string;
    quiz_id: string | null;
    assignment_id: string | null;
    points_earned: string;
    points_possible: string;
    weight: string;
    created_at: Date;
  }>(
    /* O `tenant_id` está aqui mesmo com os ids já vindo recortados de
       `candidatosAEficacia`: a consulta precisa se defender sozinha, porque
       quem a chamar amanhã pode não ter recortado. É o que o teste de
       isolamento cobra de toda leitura de tabela raiz. */
    `SELECT enrollment_id, id, quiz_id, assignment_id,
            points_earned, points_possible, weight, created_at
       FROM grade_entries
      WHERE tenant_id = $1
        AND enrollment_id = ANY($2::uuid[])
      ORDER BY created_at`,
    [tenantId, enrollmentIds],
  );

  for (const row of rows) {
    const lista = porMatricula.get(row.enrollment_id) ?? [];

    lista.push({
      id: row.id,
      activityId: row.quiz_id ?? row.assignment_id ?? row.id,
      activityKind: row.quiz_id ? "quiz" : "assignment",
      pointsEarned: Number(row.points_earned),
      pointsPossible: Number(row.points_possible),
      weight: Number(row.weight),
      createdAt: row.created_at.toISOString(),
    });

    porMatricula.set(row.enrollment_id, lista);
  }

  return porMatricula;
}

export interface NovaAvaliacao {
  tenantId: string;
  enrollmentId: string;
  concluidoEm: Date;
  veredito: Veredito;
  observacao: string;
  avaliadoPor: string;
}

/**
 * Grava a avaliação.
 *
 * Devolve `null` quando já existe uma valendo para a mesma matrícula: é o
 * índice único parcial recusando, e acontece quando dois instrutores avaliam a
 * mesma conclusão ao mesmo tempo, ou quando alguém clica duas vezes. Não é
 * erro — a avaliação está lá.
 */
export async function registrarAvaliacao(nova: NovaAvaliacao): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO effectiveness_reviews
       (tenant_id, enrollment_id, completed_at, verdict, observation, reviewed_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      nova.tenantId,
      nova.enrollmentId,
      nova.concluidoEm,
      nova.veredito,
      nova.observacao,
      nova.avaliadoPor,
    ],
  );

  return rows[0]?.id ?? null;
}

export interface AvaliacaoRegistrada {
  id: string;
  enrollmentId: string;
  courseTitle: string;
  learnerName: string;
  veredito: Veredito;
  observacao: string;
  avaliadoPor: string | null;
  avaliadoEm: Date;
  concluidoEm: Date;
}

/** O que já foi avaliado, para a fila mostrar o histórico junto do que falta. */
export async function avaliacoesRegistradas(
  tenantId: string,
  authorId: string | null,
  limite = 20,
): Promise<AvaliacaoRegistrada[]> {
  const rows = await query<{
    id: string;
    enrollment_id: string;
    course_title: string;
    learner_name: string;
    verdict: Veredito;
    observation: string;
    reviewer_name: string | null;
    reviewed_at: Date;
    completed_at: Date;
  }>(
    `SELECT r.id, r.enrollment_id, c.title AS course_title, u.full_name AS learner_name,
            r.verdict, r.observation, a.full_name AS reviewer_name,
            r.reviewed_at, r.completed_at
       FROM effectiveness_reviews r
       JOIN enrollments e ON e.id = r.enrollment_id
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.learner_id
       LEFT JOIN users a ON a.id = r.reviewed_by
      WHERE r.tenant_id = $1
        AND r.revoked_at IS NULL
        AND ($2::uuid IS NULL OR c.author_id = $2)
      ORDER BY r.reviewed_at DESC
      LIMIT $3`,
    [tenantId, authorId, limite],
  );

  return rows.map((row) => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    courseTitle: row.course_title,
    learnerName: row.learner_name,
    veredito: row.verdict,
    observacao: row.observation,
    avaliadoPor: row.reviewer_name,
    avaliadoEm: row.reviewed_at,
    concluidoEm: row.completed_at,
  }));
}

export interface MatriculaParaAvaliar {
  tenantId: string;
  courseId: string;
  courseTitle: string;
  authorId: string;
  learnerName: string;
  concluidoEm: Date | null;
}

/**
 * O curso e o dono da matrícula, para conferir a permissão antes de gravar.
 *
 * Traz também os nomes porque a trilha de auditoria pede alvo LEGÍVEL: um uuid
 * de matrícula não diz nada a quem abrir o registro depois.
 *
 * `concluidoEm` SÓ TEM VALOR QUANDO O CURSO INTEIRO FOI CONCLUÍDO
 *
 * Aqui estava `max(completed_at)` de qualquer aula — a data da última aula
 * concluída, e não a da conclusão do curso. `candidatosAEficacia` logo acima já
 * exige "não falta nenhuma aula" e por isso LISTA as pessoas certas; esta
 * consulta, que é a do caminho de ESCRITA, não exigia nada. A tela nunca
 * oferecia o botão, e mesmo assim quem chamasse a rota direto registrava a
 * validação de eficácia de alguém que fez uma aula de seis — um documento de
 * conformidade legal atestando o efeito de um treinamento que não aconteceu.
 *
 * O erro tinha um segundo lado, mais quieto: essa data também é o marco dos 90
 * dias. O prazo passava a correr na primeira aula.
 *
 * A condição é a mesma da listagem, palavra por palavra, e de propósito: se as
 * duas discordarem, uma tela mostra alguém que a outra recusa.
 */
export async function donoDaMatricula(
  enrollmentId: string,
): Promise<MatriculaParaAvaliar | null> {
  const rows = await query<{
    tenant_id: string;
    course_id: string;
    course_title: string;
    author_id: string;
    learner_name: string;
    concluido_em: Date | null;
  }>(
    `SELECT c.tenant_id, c.id AS course_id, c.title AS course_title, c.author_id,
            u.full_name AS learner_name,
            (SELECT max(lp.completed_at)
               FROM lesson_progress lp
              WHERE lp.enrollment_id = e.id
                AND lp.completed_at IS NOT NULL
                AND EXISTS (
                      SELECT 1 FROM modules m JOIN lessons l ON l.module_id = m.id
                       WHERE m.course_id = c.id
                    )
                AND NOT EXISTS (
                      SELECT 1
                        FROM modules m
                        JOIN lessons l ON l.module_id = m.id
                       WHERE m.course_id = c.id
                         AND NOT EXISTS (
                               SELECT 1 FROM lesson_progress p2
                                WHERE p2.enrollment_id = e.id
                                  AND p2.lesson_id = l.id
                                  AND p2.completed_at IS NOT NULL
                             )
                    )) AS concluido_em
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.learner_id
      WHERE e.id = $1`,
    [enrollmentId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    tenantId: row.tenant_id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    authorId: row.author_id,
    learnerName: row.learner_name,
    concluidoEm: row.concluido_em,
  };
}
