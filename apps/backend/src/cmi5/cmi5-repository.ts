import { randomBytes } from "node:crypto";

import {
  estadoDaSessao,
  moveOnSatisfeito,
  validarSequencia,
  type Cmi5Verb,
  type MoveOn,
} from "@nerdlms/core/cmi5/cmi5.ts";

import { query } from "../db/pool.ts";

/**
 * Unidades e sessões cmi5.
 *
 * A sessão é o que distingue cmi5 de xAPI cru: sem ela, um `completed` solto no
 * LRS não diz de qual tentativa é. Com ela, a plataforma sabe que aquele
 * statement pertence à sessão que ela mesma abriu — e pode recusar o que não
 * pertence.
 */

/** Quanto tempo o token de uma sessão vale. */
const SESSION_TTL_HOURS = 12;

export interface Cmi5Unit {
  id: string;
  lessonId: string;
  publisherId: string;
  title: string;
  launchUrl: string;
  moveOn: MoveOn;
  masteryScore: number | null;
}

interface UnitRow {
  id: string;
  lesson_id: string;
  publisher_id: string;
  title: string;
  launch_url: string;
  move_on: MoveOn;
  mastery_score: string | null;
}

function toUnit(row: UnitRow): Cmi5Unit {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    publisherId: row.publisher_id,
    title: row.title,
    launchUrl: row.launch_url,
    moveOn: row.move_on,
    masteryScore: row.mastery_score === null ? null : Number(row.mastery_score),
  };
}

export async function findUnitByLesson(
  tenantId: string,
  lessonId: string,
): Promise<Cmi5Unit | null> {
  const rows = await query<UnitRow>(
    `SELECT id, lesson_id, publisher_id, title, launch_url, move_on, mastery_score
       FROM cmi5_units
      WHERE tenant_id = $1 AND lesson_id = $2`,
    [tenantId, lessonId],
  );

  const row = rows[0];
  return row ? toUnit(row) : null;
}

export interface Cmi5Session {
  id: string;
  unitId: string;
  userId: string;
  enrollmentId: string | null;
  authToken: string;
  verbs: Cmi5Verb[];
  satisfied: boolean;
  waived: boolean;
}

/**
 * Abre uma sessão — o `launched` do cmi5.
 *
 * O token é POR SESSÃO, não por pessoa: um token vazado dá acesso a uma
 * tentativa de uma unidade, e não à conta inteira. Mesmo raciocínio da URL
 * assinada do storage.
 *
 * `launched` já entra na lista de verbos porque foi a plataforma que abriu — e
 * é a existência dele que autoriza o `initialized` que o conteúdo mandará.
 */
export async function openSession(input: {
  tenantId: string;
  unitId: string;
  userId: string;
  enrollmentId: string | null;
}): Promise<Cmi5Session> {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);

  const rows = await query<{ id: string }>(
    `INSERT INTO cmi5_sessions
            (tenant_id, unit_id, user_id, enrollment_id, auth_token, verbs, expires_at)
     VALUES ($1, $2, $3, $4, $5, ARRAY['launched'], $6)
     RETURNING id`,
    [input.tenantId, input.unitId, input.userId, input.enrollmentId, token, expira],
  );

  return {
    id: rows[0]!.id,
    unitId: input.unitId,
    userId: input.userId,
    enrollmentId: input.enrollmentId,
    authToken: token,
    verbs: ["launched"],
    satisfied: false,
    waived: false,
  };
}

/**
 * A sessão de um token.
 *
 * `expires_at` na consulta e não depois: uma sessão vencida não é sessão, e
 * carregá-la para conferir a validade em código deixaria a checagem à mercê de
 * quem esquecesse de fazê-la.
 */
export async function sessionByToken(token: string): Promise<
  (Cmi5Session & { tenantId: string; moveOn: MoveOn; lessonId: string; courseId: string }) | null
> {
  const rows = await query<{
    id: string;
    tenant_id: string;
    unit_id: string;
    user_id: string;
    enrollment_id: string | null;
    verbs: string[];
    satisfied_at: string | null;
    waived_at: string | null;
    move_on: MoveOn;
    lesson_id: string;
    course_id: string;
  }>(
    `SELECT s.id, s.tenant_id, s.unit_id, s.user_id, s.enrollment_id, s.verbs,
            s.satisfied_at, s.waived_at, u.move_on, u.lesson_id,
            m.course_id
       FROM cmi5_sessions s
       JOIN cmi5_units u ON u.id = s.unit_id
       JOIN lessons l ON l.id = u.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE s.auth_token = $1
        AND s.expires_at > now()`,
    [token],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    unitId: row.unit_id,
    userId: row.user_id,
    enrollmentId: row.enrollment_id,
    authToken: token,
    verbs: row.verbs as Cmi5Verb[],
    satisfied: row.satisfied_at !== null,
    waived: row.waived_at !== null,
    moveOn: row.move_on,
    lessonId: row.lesson_id,
    courseId: row.course_id,
  };
}

export type RegistroResultado =
  | { ok: true; satisfied: boolean; encerrada: boolean }
  | { ok: false; erro: string };

/**
 * Registra um verbo na sessão e recalcula o `moveOn`.
 *
 * O `array_append` condicionado ao estado atual faz a leitura e a escrita numa
 * instrução: dois statements simultâneos do mesmo conteúdo — que acontece, o
 * conteúdo manda `completed` e `passed` juntos — não podem ler a mesma lista e
 * gravar por cima um do outro.
 */
export async function registrarVerbo(
  token: string,
  verbo: Cmi5Verb,
  mensagemDeErro: (erro: string) => string,
): Promise<RegistroResultado> {
  const sessao = await sessionByToken(token);
  if (!sessao) return { ok: false, erro: "Sessão não encontrada ou expirada." };

  const sequencia = validarSequencia(verbo, { verbos: sessao.verbs });
  if (!sequencia.ok) return { ok: false, erro: mensagemDeErro(sequencia.erro) };

  const verbos = [...sessao.verbs, verbo];
  const estado = estadoDaSessao({ verbos }, sessao.waived);
  const satisfeito = moveOnSatisfeito(sessao.moveOn, estado);

  await query(
    `UPDATE cmi5_sessions
        SET verbs = array_append(verbs, $2),
            /* satisfied_at só é escrito UMA vez: regravá-lo moveria a data
               de conclusão a cada statement seguinte, e o relatório mostraria
               a pessoa concluindo o curso várias vezes. */
            satisfied_at = COALESCE(satisfied_at, CASE WHEN $3 THEN now() END),
            ended_at = COALESCE(ended_at, CASE WHEN $4 THEN now() END)
      WHERE auth_token = $1
        /* O tenant vem da sessão que acabamos de carregar. O token já é único
           e imprevisível, mas o recorte explícito custa uma comparação e
           dispensa o argumento de que "aqui não precisa" — que é o argumento
           que precede todo vazamento entre clientes. */
        AND tenant_id = $5`,
    [token, verbo, satisfeito, estado.encerrada, sessao.tenantId],
  );

  return { ok: true, satisfied: satisfeito, encerrada: estado.encerrada };
}

/**
 * Dispensa administrativa — o `waived` do cmi5.
 *
 * Existe para quem já tem a competência por fora: um operador com trinta anos
 * de casa não precisa refazer o treinamento introdutório. A dispensa satisfaz
 * qualquer `moveOn`, e é por isso que ela é um ato registrado e não uma
 * marcação silenciosa.
 */
export async function dispensarUnidade(
  tenantId: string,
  unitId: string,
  userId: string,
): Promise<void> {
  await query(
    `INSERT INTO cmi5_sessions
            (tenant_id, unit_id, user_id, auth_token, verbs, waived_at, satisfied_at,
             expires_at)
     VALUES ($1, $2, $3, $4, ARRAY['waived'], now(), now(), now())
     ON CONFLICT DO NOTHING`,
    [tenantId, unitId, userId, `waived-${randomBytes(16).toString("hex")}`],
  );
}

/**
 * A pessoa já cumpriu esta unidade, em qualquer tentativa?
 *
 * `tenant_id` na cláusula embora `user_id` e `unit_id` já sejam UUIDs de
 * escopo restrito: o recorte custa uma comparação e não depende de ninguém
 * lembrar por que ele seria dispensável aqui.
 */
export async function unidadeCumprida(
  tenantId: string,
  userId: string,
  unitId: string,
): Promise<boolean> {
  const rows = await query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM cmi5_sessions
        WHERE tenant_id = $1 AND user_id = $2 AND unit_id = $3
          AND satisfied_at IS NOT NULL
     ) AS existe`,
    [tenantId, userId, unitId],
  );

  return rows[0]?.existe ?? false;
}

/**
 * O identificador de uso único que o conteúdo troca pelo token.
 *
 * O cmi5 define que o AU BUSCA a credencial, em vez de recebê-la na URL. A
 * diferença importa: a URL do iframe aparece no histórico do navegador e no
 * `Referer` de tudo que o conteúdo carregar.
 *
 * Aqui o `fetch` carrega o id da sessão, e a troca só acontece uma vez —
 * `fetched_at` marca. Um segundo pedido com o mesmo identificador significa
 * que alguém copiou a URL, e a resposta é recusa.
 */
export async function trocarFetchPorToken(
  sessionId: string,
): Promise<{ ok: true; token: string } | { ok: false; erro: string }> {
  const rows = await query<{ auth_token: string }>(
    `UPDATE cmi5_sessions
        SET fetched_at = now()
      WHERE id = $1
        AND fetched_at IS NULL
        AND expires_at > now()
      RETURNING auth_token`,
    [sessionId],
  );

  const row = rows[0];
  if (!row) {
    /* Mensagem única para os três casos — não existe, já foi buscado,
       expirou. Distinguir diria a quem tenta adivinhar qual id existe. */
    return { ok: false, erro: "Credencial indisponível." };
  }

  return { ok: true, token: row.auth_token };
}
