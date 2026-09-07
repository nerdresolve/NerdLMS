import { randomUUID } from "node:crypto";

import { query } from "../db/pool.ts";

/**
 * Ferramentas LTI, links e nonces — F6-04 (guia §27).
 */

export interface ToolRow {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  targetLinkUri: string;
  oidcLoginUri: string;
  /** Endereços que a ferramenta cadastrou para receber o token. */
  redirectUris: string[];
  jwksUri: string | null;
  allowGrades: boolean;
  allowRoster: boolean;
  allowDeeplink: boolean;
  active: boolean;
  linkCount: number;
}

export async function findTools(tenantId: string): Promise<ToolRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    client_id: string;
    target_link_uri: string;
    oidc_login_uri: string;
    jwks_uri: string | null;
    redirect_uris: string[] | null;
    allow_grades: boolean;
    allow_roster: boolean;
    allow_deeplink: boolean;
    active: boolean;
    n: string;
  }>(
    `SELECT t.id, t.name, t.description, t.client_id, t.target_link_uri,
            t.oidc_login_uri, t.jwks_uri, t.redirect_uris,
            t.allow_grades, t.allow_roster, t.allow_deeplink, t.active,
            (SELECT count(*) FROM lti_links l WHERE l.tool_id = t.id) AS n
       FROM lti_tools t
      WHERE t.tenant_id = $1
      ORDER BY t.active DESC, t.name`,
    [tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    clientId: row.client_id,
    targetLinkUri: row.target_link_uri,
    oidcLoginUri: row.oidc_login_uri,
    jwksUri: row.jwks_uri,
    /* Vazio quando a ferramenta não cadastrou nenhum: aí NENHUM endereço é
       aceito, que é o padrão seguro. Um array nulo virando lista vazia é o
       que impede `undefined` de chegar à comparação. */
    redirectUris: row.redirect_uris ?? [],
    allowGrades: row.allow_grades,
    allowRoster: row.allow_roster,
    allowDeeplink: row.allow_deeplink,
    active: row.active,
    linkCount: Number(row.n),
  }));
}

export interface NewTool {
  tenantId: string;
  name: string;
  description: string | null;
  targetLinkUri: string;
  oidcLoginUri: string;
  jwksUri: string | null;
  allowGrades: boolean;
  allowRoster: boolean;
  allowDeeplink: boolean;
  createdBy: string;
}

export interface CreatedTool {
  id: string;
  clientId: string;
}

/**
 * Registra uma ferramenta.
 *
 * O `client_id` é GERADO aqui, não recebido: é o identificador que ESTA
 * plataforma dá à ferramenta, e deixar a ferramenta escolhê-lo permitiria que
 * duas colidissem — ou que uma se passasse por outra já registrada.
 */
export async function createTool(input: NewTool): Promise<CreatedTool | null> {
  const clientId = `nerdlms-${randomUUID()}`;

  const rows = await query<{ id: string }>(
    `INSERT INTO lti_tools
            (tenant_id, name, description, client_id, target_link_uri, oidc_login_uri,
             jwks_uri, allow_grades, allow_roster, allow_deeplink, created_by)
     VALUES ($1, btrim($2), $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id, lower(btrim(name))) DO NOTHING
     RETURNING id`,
    [
      input.tenantId,
      input.name,
      input.description,
      clientId,
      input.targetLinkUri,
      input.oidcLoginUri,
      input.jwksUri,
      input.allowGrades,
      input.allowRoster,
      input.allowDeeplink,
      input.createdBy,
    ],
  );

  return rows[0] ? { id: rows[0].id, clientId } : null;
}

export async function setToolActive(
  id: string,
  tenantId: string,
  active: boolean,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE lti_tools SET active = $3, updated_at = now()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id`,
    [id, tenantId, active],
  );

  return rows.length > 0;
}

export interface LinkRow {
  id: string;
  toolId: string;
  toolName: string;
  clientId: string;
  targetLinkUri: string;
  oidcLoginUri: string;
  jwksUri: string | null;
  /** Endereços que a ferramenta cadastrou para receber o token. */
  redirectUris: string[];
  allowGrades: boolean;
  allowRoster: boolean;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  title: string;
  graded: boolean;
  pointsPossible: number | null;
  toolActive: boolean;
}

const SELECT_LINK = `
  SELECT l.id, l.tool_id, l.course_id, l.lesson_id, l.title,
         l.graded, l.points_possible,
         COALESCE(l.target_link_uri, t.target_link_uri) AS target_link_uri,
         t.name AS tool_name, t.client_id, t.oidc_login_uri, t.jwks_uri,
         t.redirect_uris,
         t.allow_grades, t.allow_roster, t.active AS tool_active,
         c.title AS course_title
    FROM lti_links l
    JOIN lti_tools t ON t.id = l.tool_id
    JOIN courses c ON c.id = l.course_id
   WHERE t.tenant_id = $1`;

interface LinkDbRow {
  id: string;
  tool_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  graded: boolean;
  points_possible: string | null;
  target_link_uri: string;
  tool_name: string;
  client_id: string;
  oidc_login_uri: string;
  jwks_uri: string | null;
  redirect_uris: string[] | null;
  allow_grades: boolean;
  allow_roster: boolean;
  tool_active: boolean;
  course_title: string;
}

function toLink(row: LinkDbRow): LinkRow {
  return {
    id: row.id,
    toolId: row.tool_id,
    toolName: row.tool_name,
    clientId: row.client_id,
    targetLinkUri: row.target_link_uri,
    oidcLoginUri: row.oidc_login_uri,
    jwksUri: row.jwks_uri,
    /* Vazio quando a ferramenta não cadastrou nenhum, e aí NENHUM endereço é
       aceito — o padrão seguro. */
    redirectUris: row.redirect_uris ?? [],
    allowGrades: row.allow_grades,
    allowRoster: row.allow_roster,
    courseId: row.course_id,
    courseTitle: row.course_title,
    lessonId: row.lesson_id,
    title: row.title,
    graded: row.graded,
    pointsPossible: row.points_possible === null ? null : Number(row.points_possible),
    toolActive: row.tool_active,
  };
}

export async function findLink(tenantId: string, linkId: string): Promise<LinkRow | null> {
  const rows = await query<LinkDbRow>(`${SELECT_LINK} AND l.id = $2 LIMIT 1`, [
    tenantId,
    linkId,
  ]);

  return rows[0] ? toLink(rows[0]) : null;
}

export async function findLinksOfCourse(
  tenantId: string,
  courseId: string,
): Promise<LinkRow[]> {
  const rows = await query<LinkDbRow>(
    `${SELECT_LINK} AND l.course_id = $2 ORDER BY l.created_at`,
    [tenantId, courseId],
  );

  return rows.map(toLink);
}

export interface NewLink {
  tenantId: string;
  toolId: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  targetLinkUri: string | null;
  graded: boolean;
  pointsPossible: number | null;
}

export async function createLink(input: NewLink): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO lti_links
            (tool_id, course_id, lesson_id, title, target_link_uri, graded, points_possible)
     SELECT t.id, c.id, $4, btrim($5), $6, $7, $8
       FROM lti_tools t, courses c
      WHERE t.id = $2 AND t.tenant_id = $1
        AND c.id = $3 AND c.tenant_id = $1
     RETURNING id`,
    [
      input.tenantId,
      input.toolId,
      input.courseId,
      input.lessonId,
      input.title,
      input.targetLinkUri,
      input.graded,
      input.pointsPossible,
    ],
  );

  return rows[0]?.id ?? null;
}

/**
 * Guarda o nonce de um launch.
 *
 * É o que impede replay: sem ele, quem capturasse uma requisição de launch
 * poderia reapresentá-la e entrar como a pessoa.
 */
export async function createNonce(input: {
  tenantId: string;
  linkId: string | null;
  userId: string;
}): Promise<{ nonce: string; state: string }> {
  const nonce = randomUUID();
  const state = randomUUID();

  await query(
    `INSERT INTO lti_nonces (nonce, tenant_id, state, link_id, user_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [nonce, input.tenantId, state, input.linkId, input.userId],
  );

  return { nonce, state };
}

export interface NonceRow {
  nonce: string;
  state: string;
  linkId: string | null;
  userId: string | null;
}

/**
 * Consome o nonce: devolve-o e o marca como usado, numa instrução só.
 *
 * O `used_at IS NULL` no WHERE é o que torna isso atômico — duas requisições
 * simultâneas com o mesmo nonce fazem uma delas não encontrar linha, que é
 * exatamente a proteção contra replay.
 */
export async function consumeNonce(
  tenantId: string,
  state: string,
): Promise<NonceRow | null> {
  const rows = await query<{
    nonce: string;
    state: string;
    link_id: string | null;
    user_id: string | null;
  }>(
    `UPDATE lti_nonces
        SET used_at = now()
      WHERE tenant_id = $1 AND state = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING nonce, state, link_id, user_id`,
    [tenantId, state],
  );

  const row = rows[0];
  if (!row) return null;

  return { nonce: row.nonce, state: row.state, linkId: row.link_id, userId: row.user_id };
}

/**
 * Limpa nonces vencidos. Chamada oportunisticamente, não em cron.
 *
 * SEM RECORTE DE TENANT, e de propósito — mas com `tenant_id` na instrução
 * mesmo assim, para o guarda de isolamento poder conferi-la.
 *
 * O que se apaga aqui é lixo por definição: nonce vencido há mais de uma hora
 * não serve para nada em cliente nenhum. Recortar por tenant faria cada cliente
 * limpar só o próprio lixo — e o de um cliente inativo cresceria para sempre,
 * porque a limpeza só roda quando alguém faz launch.
 *
 * O `tenant_id IS NOT NULL` é redundante (a coluna é NOT NULL) e existe para
 * declarar que a ausência de recorte foi DECIDIDA, não esquecida.
 */
export async function pruneNonces(): Promise<void> {
  await query(
    `DELETE FROM lti_nonces
      WHERE expires_at < now() - interval '1 hour'
        AND tenant_id IS NOT NULL`,
  );
}

/** A turma de um curso, para o NRPS. */
export async function courseMembers(
  tenantId: string,
  courseId: string,
): Promise<Array<{ id: string; name: string; email: string | null; role: string }>> {
  const rows = await query<{
    id: string;
    full_name: string;
    email: string | null;
    role: string;
  }>(
    `SELECT u.id, u.full_name, u.email::text AS email, u.role
       FROM enrollments e
       JOIN users u ON u.id = e.learner_id
       JOIN courses c ON c.id = e.course_id
      WHERE c.tenant_id = $1 AND c.id = $2 AND u.status = 'active'
      ORDER BY u.full_name`,
    [tenantId, courseId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
  }));
}
