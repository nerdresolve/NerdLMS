import { createHash, randomBytes } from "node:crypto";

import type { BadgeDefinition } from "@nerdlms/core/badges/criteria.ts";

import { query, withTransaction } from "../db/pool.ts";

/**
 * Badges configuráveis — F6-01 (guia §19).
 *
 * Diferente das medalhas de `courses/gamification.ts`, que são calculadas: aqui
 * a emissão é uma LINHA, com data, validade e código de verificação.
 */

export interface BadgeRow extends BadgeDefinition {
  /** Nome do curso ou da trilha do critério, para a tela e para o texto público. */
  courseName: string | null;
  trackName: string | null;
  createdAt: string;
  /** Quantas pessoas já receberam — a tela avisa antes de desativar. */
  awardCount: number;
}

function toBadge(row: {
  id: string;
  name: string;
  description: string;
  icon: string;
  criterion: string;
  course_id: string | null;
  track_id: string | null;
  threshold: string | null;
  validity_months: number | null;
  active: boolean;
  created_at: Date;
  course_name: string | null;
  track_name: string | null;
  award_count: string;
}): BadgeRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    criterion: row.criterion as BadgeDefinition["criterion"],
    courseId: row.course_id,
    trackId: row.track_id,
    /* `numeric` chega como texto no driver. */
    threshold: row.threshold === null ? null : Number(row.threshold),
    validityMonths: row.validity_months,
    active: row.active,
    courseName: row.course_name,
    trackName: row.track_name,
    createdAt: row.created_at.toISOString(),
    awardCount: Number(row.award_count),
  };
}

/* O RECORTE VIVE DENTRO DO FRAGMENTO, não em quem o usa.
 *
 * `${SELECT_BADGE} WHERE b.tenant_id = $1` funcionaria igual, mas o recorte
 * ficaria a um esquecimento de distância — e um `SELECT_BADGE` sem WHERE
 * devolve os badges de todos os clientes. Aqui `$1` é sempre o tenant, e quem
 * usa o fragmento só pode ACRESCENTAR condição.
 *
 * De quebra, o guarda estático de isolamento consegue enxergar o recorte: uma
 * consulta montada por pedaços é invisível para ele. */
const SELECT_BADGE = `
  SELECT b.id, b.name, b.description, b.icon, b.criterion,
         b.course_id, b.track_id, b.threshold, b.validity_months, b.active, b.created_at,
         c.title AS course_name,
         t.title AS track_name,
         (SELECT count(*) FROM badge_awards a
           WHERE a.badge_id = b.id AND a.revoked_at IS NULL) AS award_count
    FROM badges b
    LEFT JOIN courses c ON c.id = b.course_id
    LEFT JOIN tracks  t ON t.id = b.track_id
   WHERE b.tenant_id = $1`;

export async function findBadges(tenantId: string): Promise<BadgeRow[]> {
  const rows = await query<Parameters<typeof toBadge>[0]>(
    `${SELECT_BADGE} ORDER BY b.active DESC, b.name`,
    [tenantId],
  );

  return rows.map(toBadge);
}

/** Só os ativos, para a avaliação automática não gastar tempo com os desligados. */
export async function findActiveBadges(tenantId: string): Promise<BadgeRow[]> {
  const rows = await query<Parameters<typeof toBadge>[0]>(
    `${SELECT_BADGE} AND b.active ORDER BY b.name`,
    [tenantId],
  );

  return rows.map(toBadge);
}

export interface NewBadge {
  tenantId: string;
  name: string;
  description: string;
  icon: string;
  criterion: string;
  courseId: string | null;
  trackId: string | null;
  threshold: number | null;
  validityMonths: number | null;
  createdBy: string;
}

export type CreateBadgeResult =
  | { ok: true; id: string }
  | { ok: false; reason: "name_taken" | "invalid" };

export async function createBadge(input: NewBadge): Promise<CreateBadgeResult> {
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO badges (tenant_id, name, description, icon, criterion,
                           course_id, track_id, threshold, validity_months, created_by)
       VALUES ($1, btrim($2), btrim($3), $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id, lower(btrim(name))) DO NOTHING
       RETURNING id`,
      [
        input.tenantId,
        input.name,
        input.description,
        input.icon,
        input.criterion,
        input.courseId,
        input.trackId,
        input.threshold,
        input.validityMonths,
        input.createdBy,
      ],
    );

    const id = rows[0]?.id;
    return id ? { ok: true, id } : { ok: false, reason: "name_taken" };
  } catch (erro) {
    /* O CHECK `badges_criterion_target` recusa critério sem alvo. Vira um
       "invalid" para a rota traduzir, em vez de subir como erro 500 — é erro de
       quem preencheu o formulário, não da plataforma. */
    if (erro instanceof Error && erro.message.includes("badges_criterion_target")) {
      return { ok: false, reason: "invalid" };
    }
    throw erro;
  }
}

/** Liga ou desliga. Não apaga: quem já recebeu continua tendo. */
export async function setBadgeActive(
  id: string,
  tenantId: string,
  active: boolean,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE badges SET active = $3, updated_at = now()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id`,
    [id, tenantId, active],
  );

  return rows.length > 0;
}

/**
 * Um código de verificação novo.
 *
 * 12 caracteres de A-Z0-9 aleatórios — mesma forma do código de certificado,
 * para quem confere reconhecer o formato. `randomBytes` e não `Math.random`: um
 * código previsível deixaria alguém enumerar emissões.
 */
export function generateBadgeCode(): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(12);

  let codigo = "";
  for (let i = 0; i < 12; i += 1) codigo += alfabeto[bytes[i]! % alfabeto.length];

  return codigo;
}

/** O hash do e-mail como o Open Badges 2.0 o define. */
export function hashRecipientEmail(email: string, salt: string): string {
  return `sha256$${createHash("sha256").update(email.toLowerCase() + salt).digest("hex")}`;
}

export interface AwardRow {
  id: string;
  code: string;
  badgeId: string;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
  criterion: string;
  courseName: string | null;
  trackName: string | null;
  threshold: number | null;
  userId: string;
  userName: string;
  userEmail: string | null;
  salt: string;
  awardedAt: string;
  expiresAt: string | null;
  awardedByName: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  tenantId: string;
  tenantName: string;
}

const SELECT_AWARD = `
  SELECT a.id, a.code, a.badge_id, a.user_id, a.awarded_at, a.expires_at,
         a.revoked_at, a.revoked_reason,
         b.name AS badge_name, b.description AS badge_description, b.icon AS badge_icon,
         b.criterion, b.threshold,
         c.title AS course_name, t.title AS track_name,
         u.full_name AS user_name, u.email::text AS user_email,
         emissor.full_name AS awarded_by_name,
         b.tenant_id, tn.name AS tenant_name
    FROM badge_awards a
    JOIN badges b ON b.id = a.badge_id
    JOIN users  u ON u.id = a.user_id
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN courses c ON c.id = b.course_id
    LEFT JOIN tracks  t ON t.id = b.track_id
    LEFT JOIN users emissor ON emissor.id = a.awarded_by`;

interface AwardDbRow {
  id: string;
  code: string;
  badge_id: string;
  user_id: string;
  awarded_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  badge_name: string;
  badge_description: string;
  badge_icon: string;
  criterion: string;
  threshold: string | null;
  course_name: string | null;
  track_name: string | null;
  user_name: string;
  user_email: string | null;
  awarded_by_name: string | null;
  tenant_id: string;
  tenant_name: string;
}

function toAward(row: AwardDbRow): AwardRow {
  return {
    id: row.id,
    code: row.code,
    badgeId: row.badge_id,
    badgeName: row.badge_name,
    badgeDescription: row.badge_description,
    badgeIcon: row.badge_icon,
    criterion: row.criterion,
    courseName: row.course_name,
    trackName: row.track_name,
    threshold: row.threshold === null ? null : Number(row.threshold),
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    /* O sal é derivado do código: determinístico, único por emissão, e não
       exige uma coluna a mais. O código já é aleatório e único. */
    salt: row.code.toLowerCase(),
    awardedAt: row.awarded_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null,
    awardedByName: row.awarded_by_name,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    revokedReason: row.revoked_reason,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
  };
}

/** Uma emissão pelo código — é o que a página pública de verificação usa. */
export async function findAwardByCode(code: string): Promise<AwardRow | null> {
  const rows = await query<AwardDbRow>(`${SELECT_AWARD} WHERE a.code = $1 LIMIT 1`, [code]);
  return rows[0] ? toAward(rows[0]) : null;
}

/** Os badges de uma pessoa, inclusive os revogados — o perfil os distingue. */
export async function findAwardsOf(userId: string): Promise<AwardRow[]> {
  const rows = await query<AwardDbRow>(
    `${SELECT_AWARD} WHERE a.user_id = $1 ORDER BY a.awarded_at DESC`,
    [userId],
  );

  return rows.map(toAward);
}

/** Quem já tem cada badge, para a avaliação não emitir duas vezes. */
export async function findAwardedBadgeIds(userId: string): Promise<Set<string>> {
  const rows = await query<{ badge_id: string }>(
    `SELECT badge_id FROM badge_awards WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );

  return new Set(rows.map((row) => row.badge_id));
}

export interface AwardInput {
  badgeId: string;
  userId: string;
  expiresAt: Date | null;
  /** Nulo quando foi o critério automático. */
  awardedBy: string | null;
}

/**
 * Emite. Devolve o código, ou `null` quando a pessoa já tem.
 *
 * `ON CONFLICT DO NOTHING` sobre a restrição de exclusão: duas avaliações
 * simultâneas — uma por concluir a aula, outra por concluir o curso — chegariam
 * aqui juntas, e a segunda não pode virar erro.
 */
export async function awardBadge(input: AwardInput): Promise<string | null> {
  const code = generateBadgeCode();

  const rows = await query<{ code: string }>(
    `INSERT INTO badge_awards (badge_id, user_id, code, expires_at, awarded_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT badge_awards_no_duplicate DO NOTHING
     RETURNING code`,
    [input.badgeId, input.userId, code, input.expiresAt, input.awardedBy],
  );

  return rows[0]?.code ?? null;
}

export async function revokeAward(
  code: string,
  tenantId: string,
  reason: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE badge_awards a
        SET revoked_at = now(), revoked_reason = btrim($3)
       FROM badges b
      WHERE b.id = a.badge_id
        AND a.code = $1
        AND b.tenant_id = $2
        AND a.revoked_at IS NULL
      RETURNING a.id`,
    [code, tenantId, reason],
  );

  return rows.length > 0;
}

/**
 * O que a pessoa fez, para os critérios avaliarem.
 *
 * Uma consulta só, e não uma por critério: avaliar dez badges faria dez idas ao
 * banco para as mesmas três perguntas.
 */
export async function learnerRecordOf(
  userId: string,
  tenantId: string,
): Promise<{
  completedCourses: Set<string>;
  completedTracks: Set<string>;
  lessonsCompleted: number;
  gradesByCourse: Map<string, number>;
}> {
  return withTransaction(async (exec) => {
    /* Curso concluído = todas as aulas dele concluídas. É a mesma definição de
       `courseProgress` no core; aqui em SQL porque a pergunta é "quais cursos",
       e trazer todo o progresso para o Node para responder isso seria carregar
       o histórico inteiro por badge avaliado. */
    const cursos = await exec<{ course_id: string }>(
      `SELECT e.course_id
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
        WHERE e.learner_id = $1 AND c.tenant_id = $2
          AND (SELECT count(*) FROM lessons l
                 JOIN modules m ON m.id = l.module_id
                WHERE m.course_id = c.id) > 0
          AND (SELECT count(*) FROM lessons l
                 JOIN modules m ON m.id = l.module_id
                WHERE m.course_id = c.id)
              = (SELECT count(*) FROM lesson_progress p
                   JOIN lessons l ON l.id = p.lesson_id
                   JOIN modules m ON m.id = l.module_id
                  WHERE p.enrollment_id = e.id AND m.course_id = c.id
                    AND p.completed_at IS NOT NULL)`,
      [userId, tenantId],
    );

    const completedCourses = new Set(cursos.map((row) => row.course_id));

    /* Trilha concluída = todos os cursos dela concluídos. */
    const trilhas = await exec<{ track_id: string }>(
      `SELECT t.id AS track_id
         FROM tracks t
        WHERE t.tenant_id = $2
          AND (SELECT count(*) FROM track_courses tc WHERE tc.track_id = t.id) > 0
          AND NOT EXISTS (
            SELECT 1 FROM track_courses tc
             WHERE tc.track_id = t.id AND tc.course_id <> ALL($1::uuid[]))`,
      [[...completedCourses], tenantId],
    );

    const aulas = await exec<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM lesson_progress p
         JOIN enrollments e ON e.id = p.enrollment_id
         JOIN courses c ON c.id = e.course_id
        WHERE e.learner_id = $1 AND c.tenant_id = $2 AND p.completed_at IS NOT NULL`,
      [userId, tenantId],
    );

    /* A nota vigente por curso: o ÚLTIMO lançamento de cada atividade,
       ponderado. `grade_entries` é append-only — somar tudo contaria a nota
       antes e depois de uma revisão. */
    const notas = await exec<{ course_id: string; percentual: string }>(
      `WITH vigentes AS (
         SELECT DISTINCT ON (e.course_id, COALESCE(g.quiz_id, g.assignment_id))
                e.course_id,
                g.points_earned,
                g.points_possible,
                g.weight
           FROM grade_entries g
           JOIN enrollments e ON e.id = g.enrollment_id
           JOIN courses c ON c.id = e.course_id
          WHERE e.learner_id = $1 AND c.tenant_id = $2
            AND g.points_possible > 0
          ORDER BY e.course_id, COALESCE(g.quiz_id, g.assignment_id), g.created_at DESC
       )
       SELECT course_id,
              (sum(points_earned / points_possible * 100 * weight) / NULLIF(sum(weight), 0))::text
                AS percentual
         FROM vigentes
        GROUP BY course_id`,
      [userId, tenantId],
    );

    return {
      completedCourses,
      completedTracks: new Set(trilhas.map((row) => row.track_id)),
      lessonsCompleted: Number(aulas[0]?.n ?? 0),
      gradesByCourse: new Map(
        notas
          .filter((row) => row.percentual !== null)
          .map((row) => [row.course_id, Number(row.percentual)]),
      ),
    };
  });
}

/**
 * O e-mail de contato do cliente, para o documento Issuer.
 *
 * Consulta própria e mínima: `TenantContext` viaja em toda requisição, e
 * carregar este campo lá custaria em todas as telas para servir um endereço só.
 */
export async function findIssuerContact(tenantId: string): Promise<string | null> {
  const rows = await query<{ mail_from_email: string | null }>(
    `SELECT mail_from_email FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId],
  );

  return rows[0]?.mail_from_email ?? null;
}

export interface PublicBadge {
  id: string;
  name: string;
  description: string;
  criterion: string;
  courseName: string | null;
  trackName: string | null;
  threshold: number | null;
}

/**
 * Um badge pelo id, para os documentos públicos.
 *
 * SEM recorte de tenant — de propósito, e é a única consulta do produto assim.
 * O documento Open Badges é público por definição: quem verifica não tem conta,
 * e o id vem da assertion que a própria plataforma publicou.
 *
 * O que sai daqui é só o que já aparece na página de verificação: nome,
 * descrição e critério. Nada sobre quem recebeu, nada sobre o cliente além do
 * que o Issuer já diz.
 */
export async function findBadgePublic(badgeId: string): Promise<PublicBadge | null> {
  const rows = await query<{
    id: string;
    name: string;
    description: string;
    criterion: string;
    course_name: string | null;
    track_name: string | null;
    threshold: string | null;
  }>(
    `SELECT b.id, b.name, b.description, b.criterion, b.threshold,
            c.title AS course_name, t.title AS track_name
       FROM badges b
       LEFT JOIN courses c ON c.id = b.course_id
       LEFT JOIN tracks  t ON t.id = b.track_id
      WHERE b.id = $1
      LIMIT 1`,
    [badgeId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    criterion: row.criterion,
    courseName: row.course_name,
    trackName: row.track_name,
    threshold: row.threshold === null ? null : Number(row.threshold),
  };
}
