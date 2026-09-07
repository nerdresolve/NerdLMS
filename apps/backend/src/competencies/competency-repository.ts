import type { Evidence } from "@nerdlms/core/competencies/proficiency.ts";

import { query, withTransaction } from "../db/pool.ts";

/**
 * Competências, evidências e planos — F6-02 (guia §20).
 *
 * A evidência é append-only no banco: aqui não existe função de alterar nível,
 * só de registrar outra. Uma função de UPDATE seria uma porta que o gatilho
 * fecha, e que alguém tentaria abrir.
 */

export interface FrameworkRow {
  id: string;
  name: string;
  description: string | null;
  levels: string[];
  active: boolean;
  competencyCount: number;
}

export async function findFrameworks(tenantId: string): Promise<FrameworkRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    levels: string[];
    active: boolean;
    n: string;
  }>(
    `SELECT f.id, f.name, f.description, f.levels, f.active,
            (SELECT count(*) FROM competencies c
              WHERE c.framework_id = f.id AND c.active) AS n
       FROM competency_frameworks f
      WHERE f.tenant_id = $1
      ORDER BY f.active DESC, f.name`,
    [tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    levels: row.levels,
    active: row.active,
    competencyCount: Number(row.n),
  }));
}

export interface CompetencyRow {
  id: string;
  frameworkId: string;
  frameworkName: string;
  levels: string[];
  parentId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  learningOutcome: string | null;
  active: boolean;
  /** Cursos que desenvolvem esta competência, para a tela mostrar o caminho. */
  courses: Array<{ id: string; title: string; grantsLevel: number }>;
}

export async function findCompetencies(tenantId: string): Promise<CompetencyRow[]> {
  const rows = await query<{
    id: string;
    framework_id: string;
    framework_name: string;
    levels: string[];
    parent_id: string | null;
    code: string | null;
    name: string;
    description: string | null;
    learning_outcome: string | null;
    active: boolean;
    courses: Array<{ id: string; title: string; grantsLevel: number }> | null;
  }>(
    `SELECT c.id, c.framework_id, f.name AS framework_name, f.levels,
            c.parent_id, c.code, c.name, c.description, c.learning_outcome, c.active,
            /* Os cursos como JSON: uma junção devolveria a competência
               repetida por curso, e a tela teria de reagrupar. */
            (SELECT jsonb_agg(jsonb_build_object(
                      'id', co.id, 'title', co.title, 'grantsLevel', l.grants_level)
                      ORDER BY co.title)
               FROM competency_links l
               JOIN courses co ON co.id = l.course_id
              WHERE l.competency_id = c.id) AS courses
       FROM competencies c
       JOIN competency_frameworks f ON f.id = c.framework_id
      WHERE c.tenant_id = $1
      ORDER BY f.name, c.name`,
    [tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    frameworkId: row.framework_id,
    frameworkName: row.framework_name,
    levels: row.levels,
    parentId: row.parent_id,
    code: row.code,
    name: row.name,
    description: row.description,
    learningOutcome: row.learning_outcome,
    active: row.active,
    courses: row.courses ?? [],
  }));
}

export interface NewFramework {
  tenantId: string;
  name: string;
  description: string | null;
  levels: string[];
}

export async function createFramework(input: NewFramework): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO competency_frameworks (tenant_id, name, description, levels)
     VALUES ($1, btrim($2), $3, $4)
     ON CONFLICT (tenant_id, lower(btrim(name))) DO NOTHING
     RETURNING id`,
    [input.tenantId, input.name, input.description, input.levels],
  );

  return rows[0]?.id ?? null;
}

export interface NewCompetency {
  tenantId: string;
  frameworkId: string;
  parentId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  learningOutcome: string | null;
}

export async function createCompetency(input: NewCompetency): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO competencies
            (tenant_id, framework_id, parent_id, code, name, description, learning_outcome)
     SELECT $1, f.id, $3, $4, btrim($5), $6, $7
       FROM competency_frameworks f
      WHERE f.id = $2 AND f.tenant_id = $1
     ON CONFLICT (framework_id, lower(btrim(name))) DO NOTHING
     RETURNING id`,
    [
      input.tenantId,
      input.frameworkId,
      input.parentId,
      input.code,
      input.name,
      input.description,
      input.learningOutcome,
    ],
  );

  return rows[0]?.id ?? null;
}

/**
 * Liga uma competência a um curso.
 *
 * O `tenant_id` da competência é conferido na própria instrução: sem isto, um
 * id copiado de outro cliente ligaria o curso daqui à competência de lá.
 */
export async function linkCompetencyToCourse(
  tenantId: string,
  competencyId: string,
  courseId: string,
  grantsLevel: number,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `INSERT INTO competency_links (competency_id, course_id, grants_level)
     SELECT c.id, co.id, $4
       FROM competencies c, courses co
      WHERE c.id = $2 AND c.tenant_id = $1
        AND co.id = $3 AND co.tenant_id = $1
     ON CONFLICT (competency_id, course_id) WHERE course_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [tenantId, competencyId, courseId, grantsLevel],
  );

  return rows.length > 0;
}

export async function unlinkCompetencyFromCourse(
  tenantId: string,
  competencyId: string,
  courseId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM competency_links l
      USING competencies c
      WHERE l.competency_id = c.id
        AND c.tenant_id = $1
        AND l.competency_id = $2
        AND l.course_id = $3
      RETURNING l.id`,
    [tenantId, competencyId, courseId],
  );

  return rows.length > 0;
}

export interface EvidenceRow extends Evidence {
  competencyName: string;
  frameworkName: string;
  levels: string[];
  userId: string;
  userName: string;
  courseTitle: string | null;
  attestedByName: string | null;
}

const SELECT_EVIDENCE = `
  SELECT e.id, e.competency_id, e.user_id, e.level, e.source,
         e.created_at, e.expires_at, e.revoked_at, e.note,
         c.name AS competency_name, f.name AS framework_name, f.levels,
         u.full_name AS user_name,
         co.title AS course_title,
         atestador.full_name AS attested_by_name
    FROM competency_evidence e
    JOIN competencies c ON c.id = e.competency_id
    JOIN competency_frameworks f ON f.id = c.framework_id
    JOIN users u ON u.id = e.user_id
    LEFT JOIN courses co ON co.id = e.course_id
    LEFT JOIN users atestador ON atestador.id = e.attested_by
   WHERE e.tenant_id = $1`;

interface EvidenceDbRow {
  id: string;
  competency_id: string;
  user_id: string;
  level: number;
  source: string;
  created_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
  note: string | null;
  competency_name: string;
  framework_name: string;
  levels: string[];
  user_name: string;
  course_title: string | null;
  attested_by_name: string | null;
}

function toEvidence(row: EvidenceDbRow): EvidenceRow {
  return {
    id: row.id,
    competencyId: row.competency_id,
    level: row.level,
    source: row.source as Evidence["source"],
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    note: row.note,
    competencyName: row.competency_name,
    frameworkName: row.framework_name,
    levels: row.levels,
    userId: row.user_id,
    userName: row.user_name,
    courseTitle: row.course_title,
    attestedByName: row.attested_by_name,
  };
}

/** As evidências de uma pessoa — inclusive revogadas e vencidas. */
export async function findEvidenceOf(
  tenantId: string,
  userId: string,
): Promise<EvidenceRow[]> {
  const rows = await query<EvidenceDbRow>(
    `${SELECT_EVIDENCE} AND e.user_id = $2 ORDER BY e.created_at DESC`,
    [tenantId, userId],
  );

  return rows.map(toEvidence);
}

export interface NewEvidence {
  tenantId: string;
  competencyId: string;
  userId: string;
  level: number;
  source: Evidence["source"];
  courseId?: string | null;
  note?: string | null;
  attestedBy?: string | null;
  expiresAt?: Date | null;
}

/**
 * Registra evidência. Devolve `null` quando já existe para a mesma origem.
 *
 * Não existe função de ALTERAR: o gatilho do banco recusa, e uma função que
 * tentasse seria uma porta que alguém acabaria usando. Para mudar o nível,
 * registre outra evidência — é o que o append-only significa.
 */
export async function recordEvidence(input: NewEvidence): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO competency_evidence
            (tenant_id, competency_id, user_id, level, source, course_id, note,
             attested_by, expires_at)
     SELECT $1, c.id, $3, $4, $5, $6, $7, $8, $9
       FROM competencies c
      WHERE c.id = $2 AND c.tenant_id = $1 AND c.active
     ON CONFLICT (user_id, competency_id, course_id)
       WHERE course_id IS NOT NULL AND revoked_at IS NULL
       DO NOTHING
     RETURNING id`,
    [
      input.tenantId,
      input.competencyId,
      input.userId,
      input.level,
      input.source,
      input.courseId ?? null,
      input.note ?? null,
      input.attestedBy ?? null,
      input.expiresAt ?? null,
    ],
  );

  return rows[0]?.id ?? null;
}

export async function revokeEvidence(
  tenantId: string,
  evidenceId: string,
  reason: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE competency_evidence
        SET revoked_at = now(), revoked_reason = btrim($3)
      WHERE id = $2 AND tenant_id = $1 AND revoked_at IS NULL
      RETURNING id`,
    [tenantId, evidenceId, reason],
  );

  return rows.length > 0;
}

/**
 * As competências que concluir este curso desenvolve.
 *
 * Chamada quando alguém conclui um curso, então precisa ser barata: um índice
 * em `competency_links (course_id)` cobre.
 */
export async function competenciesGrantedByCourse(
  tenantId: string,
  courseId: string,
): Promise<Array<{ competencyId: string; grantsLevel: number }>> {
  const rows = await query<{ competency_id: string; grants_level: number }>(
    `SELECT l.competency_id, l.grants_level
       FROM competency_links l
       JOIN competencies c ON c.id = l.competency_id
      WHERE c.tenant_id = $1 AND l.course_id = $2 AND c.active`,
    [tenantId, courseId],
  );

  return rows.map((row) => ({
    competencyId: row.competency_id,
    grantsLevel: row.grants_level,
  }));
}

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  active: boolean;
  items: Array<{
    competencyId: string;
    competencyName: string;
    requiredLevel: number;
    /**
     * A escala do framework DESTA competência.
     *
     * Vem daqui e não da evidência: um gap significa que NÃO HÁ evidência, e
     * era exatamente aí que o rótulo se perdia — a tela mostrava "Nível 2" em
     * vez de "Intermediário" justamente na linha que a pessoa precisa ler.
     *
     * Por item e não por plano: um plano pode misturar competências de
     * frameworks diferentes, com escalas diferentes.
     */
    levels: string[];
  }>;
  assignedCount: number;
}

export async function findPlans(tenantId: string): Promise<PlanRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    due_date: Date | null;
    active: boolean;
    items: Array<PlanRow["items"][number]> | null;
    assigned: string;
  }>(
    `SELECT p.id, p.name, p.description, p.due_date, p.active,
            (SELECT jsonb_agg(jsonb_build_object(
                      'competencyId', i.competency_id,
                      'competencyName', c.name,
                      'requiredLevel', i.required_level,
                      'levels', f.levels) ORDER BY c.name)
               FROM learning_plan_items i
               JOIN competencies c ON c.id = i.competency_id
               JOIN competency_frameworks f ON f.id = c.framework_id
              WHERE i.plan_id = p.id) AS items,
            (SELECT count(*) FROM learning_plan_assignments a
              WHERE a.plan_id = p.id) AS assigned
       FROM learning_plans p
      WHERE p.tenant_id = $1
      ORDER BY p.active DESC, p.name`,
    [tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    /* `date` sem hora: `toISOString` daria fuso a uma data civil, e o prazo
       "31/12" viraria "30/12" para quem lê em fuso negativo. */
    dueDate: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
    active: row.active,
    items: row.items ?? [],
    assignedCount: Number(row.assigned),
  }));
}

export interface NewPlan {
  tenantId: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  createdBy: string;
  items: Array<{ competencyId: string; requiredLevel: number }>;
}

/**
 * Cria o plano com os itens, numa transação.
 *
 * Um plano sem item não pede nada — e criado pela metade seria exatamente isso,
 * sem ninguém perceber até alguém abrir o relatório de gaps e ver 100%.
 */
export async function createPlan(input: NewPlan): Promise<string | null> {
  return withTransaction(async (exec) => {
    const criado = await exec<{ id: string }>(
      `INSERT INTO learning_plans (tenant_id, name, description, due_date, created_by)
       VALUES ($1, btrim($2), $3, $4, $5)
       ON CONFLICT (tenant_id, lower(btrim(name))) DO NOTHING
       RETURNING id`,
      [input.tenantId, input.name, input.description, input.dueDate, input.createdBy],
    );

    const planId = criado[0]?.id;
    if (!planId) return null;

    if (input.items.length > 0) {
      /* `unnest` para uma instrução só: uma por item daria N viagens e abriria
         uma janela em que o plano existe sem exigir nada. */
      await exec(
        `INSERT INTO learning_plan_items (plan_id, competency_id, required_level)
         SELECT $1, c.id, t.nivel
           FROM unnest($2::uuid[], $3::int[]) AS t(competencia, nivel)
           JOIN competencies c ON c.id = t.competencia AND c.tenant_id = $4
         ON CONFLICT DO NOTHING`,
        [
          planId,
          input.items.map((i) => i.competencyId),
          input.items.map((i) => i.requiredLevel),
          input.tenantId,
        ],
      );
    }

    return planId;
  });
}

/** Atribui o plano a várias pessoas de uma vez. Devolve quantas entraram. */
export async function assignPlan(
  tenantId: string,
  planId: string,
  userIds: string[],
  assignedBy: string,
): Promise<number> {
  if (userIds.length === 0) return 0;

  const rows = await query<{ user_id: string }>(
    `INSERT INTO learning_plan_assignments (plan_id, user_id, assigned_by)
     SELECT p.id, u.id, $4
       FROM learning_plans p, users u
      WHERE p.id = $2 AND p.tenant_id = $1
        AND u.id = ANY($3::uuid[]) AND u.tenant_id = $1
     ON CONFLICT DO NOTHING
     RETURNING user_id`,
    [tenantId, planId, userIds, assignedBy],
  );

  return rows.length;
}

/** Os planos de uma pessoa, com os itens — a base do relatório de gaps. */
export async function plansOfUser(
  tenantId: string,
  userId: string,
): Promise<PlanRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    due_date: Date | null;
    active: boolean;
    items: Array<PlanRow["items"][number]> | null;
  }>(
    `SELECT p.id, p.name, p.description, p.due_date, p.active,
            (SELECT jsonb_agg(jsonb_build_object(
                      'competencyId', i.competency_id,
                      'competencyName', c.name,
                      'requiredLevel', i.required_level,
                      'levels', f.levels) ORDER BY c.name)
               FROM learning_plan_items i
               JOIN competencies c ON c.id = i.competency_id
               JOIN competency_frameworks f ON f.id = c.framework_id
              WHERE i.plan_id = p.id) AS items
       FROM learning_plans p
       JOIN learning_plan_assignments a ON a.plan_id = p.id
      WHERE p.tenant_id = $1 AND a.user_id = $2 AND p.active
      ORDER BY p.due_date NULLS LAST, p.name`,
    [tenantId, userId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    dueDate: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
    active: row.active,
    items: row.items ?? [],
    assignedCount: 0,
  }));
}
