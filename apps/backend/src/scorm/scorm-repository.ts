import type { LessonStatus, ScormState } from "@nerdlms/core/scorm/runtime.ts";
import type {
  CompletionStatus,
  ExitMode,
  Scorm2004State,
  SuccessStatus,
} from "@nerdlms/core/scorm/runtime-2004.ts";

import { query } from "../db/pool.ts";

/**
 * Pacotes SCORM e tracking — 1.2 e 2004.
 *
 * As duas versões guardam na mesma tabela, em colunas diferentes:
 * `lesson_status` para o 1.2, `completion_status` + `success_status` para o
 * 2004. `scorm_packages.version` diz qual ler.
 */

export interface ScormPackage {
  id: string;
  lessonId: string;
  storagePrefix: string;
  entryPoint: string;
  version: "1.2" | "2004";
  title?: string;
  /** Nota de corte do 1.2, na escala bruta do pacote. */
  masteryScore?: number;
  /** Nota de corte do 2004, normalizada de -1 a 1. */
  scaledPassingScore?: number;
}

export async function findPackageByLesson(lessonId: string): Promise<ScormPackage | null> {
  const rows = await query<{
    id: string;
    lesson_id: string;
    storage_prefix: string;
    entry_point: string;
    version: "1.2" | "2004";
    title: string | null;
    mastery_score: string | null;
    scaled_passing_score: string | null;
  }>(
    `SELECT id, lesson_id, storage_prefix, entry_point, version, title,
            mastery_score, scaled_passing_score
       FROM scorm_packages
      WHERE lesson_id = $1
      LIMIT 1`,
    [lessonId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    lessonId: row.lesson_id,
    storagePrefix: row.storage_prefix,
    entryPoint: row.entry_point,
    version: row.version,
    ...(row.title ? { title: row.title } : {}),
    ...(row.mastery_score !== null ? { masteryScore: Number(row.mastery_score) } : {}),
    ...(row.scaled_passing_score !== null
      ? { scaledPassingScore: Number(row.scaled_passing_score) }
      : {}),
  };
}

export async function createPackage(input: {
  tenantId: string;
  lessonId: string;
  storagePrefix: string;
  entryPoint: string;
  version: "1.2" | "2004";
  title?: string | null;
  masteryScore?: number | null;
  /** Nota de corte do 2004, normalizada. Nula em pacote 1.2. */
  scaledPassingScore?: number | null;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO scorm_packages
            (tenant_id, lesson_id, storage_prefix, entry_point, version, title,
             mastery_score, scaled_passing_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (lesson_id) DO UPDATE SET
       storage_prefix = EXCLUDED.storage_prefix,
       entry_point = EXCLUDED.entry_point,
       version = EXCLUDED.version,
       title = EXCLUDED.title,
       mastery_score = EXCLUDED.mastery_score,
       scaled_passing_score = EXCLUDED.scaled_passing_score
     RETURNING id`,
    [
      input.tenantId,
      input.lessonId,
      input.storagePrefix,
      input.entryPoint,
      input.version,
      input.title ?? null,
      input.masteryScore ?? null,
      input.scaledPassingScore ?? null,
    ],
  );

  /* A aula passa a ser do tipo `scorm`: é o que faz o player certo abrir.
     Sem isto o pacote existiria no storage, o registro existiria no banco, e a
     aula continuaria mostrando o player de vídeo — o conteúdo publicado e
     ninguém o veria. Mesma decisão do conteúdo interativo. */
  await query(`UPDATE lessons SET kind = 'scorm' WHERE id = $1`, [input.lessonId]);

  return rows[0]!.id;
}

/**
 * O estado desta pessoa neste pacote.
 *
 * Devolve o estado inicial quando não há linha: um SCORM nunca aberto tem
 * `not attempted`, e é isso que o conteúdo espera ler na primeira vez.
 */
export async function findTracking(
  packageId: string,
  enrollmentId: string,
): Promise<ScormState> {
  const rows = await query<{
    lesson_status: LessonStatus | null;
    score_raw: string | null;
    score_min: string | null;
    score_max: string | null;
    total_time_seconds: number;
    suspend_data: string | null;
    lesson_location: string | null;
  }>(
    `SELECT lesson_status, score_raw, score_min, score_max,
            total_time_seconds, suspend_data, lesson_location
       FROM scorm_tracking
      WHERE package_id = $1 AND enrollment_id = $2
      LIMIT 1`,
    [packageId, enrollmentId],
  );

  const row = rows[0];
  if (!row) return { lessonStatus: "not attempted", totalTimeSeconds: 0 };

  return {
    /* Nulo aqui significa linha de pacote 2004 lida pelo caminho do 1.2 — um
       erro de programação, não um dado ausente. Cair para "not attempted" faz
       o conteúdo recomeçar do zero em vez de quebrar, e é o que menos custa a
       quem está estudando. */
    lessonStatus: row.lesson_status ?? "not attempted",
    totalTimeSeconds: row.total_time_seconds,
    ...(row.score_raw !== null ? { scoreRaw: Number(row.score_raw) } : {}),
    ...(row.score_min !== null ? { scoreMin: Number(row.score_min) } : {}),
    ...(row.score_max !== null ? { scoreMax: Number(row.score_max) } : {}),
    ...(row.suspend_data ? { suspendData: row.suspend_data } : {}),
    ...(row.lesson_location ? { lessonLocation: row.lesson_location } : {}),
  };
}

/**
 * Grava o estado, somando o tempo da sessão.
 *
 * O tempo SOMA no banco (`total_time_seconds + $N`), não é sobrescrito com um
 * valor calculado na aplicação: duas abas do mesmo SCORM — que existem, porque
 * o conteúdo abre janelas — perderiam uma das sessões se cada uma lesse o
 * total, somasse e gravasse. Mesma razão do `GREATEST` no progresso de vídeo.
 */
export async function saveTracking(
  packageId: string,
  enrollmentId: string,
  state: ScormState,
  sessionSeconds: number,
): Promise<void> {
  await query(
    `INSERT INTO scorm_tracking
            (package_id, enrollment_id, lesson_status, score_raw, score_min, score_max,
             total_time_seconds, suspend_data, lesson_location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (package_id, enrollment_id) DO UPDATE SET
       lesson_status = EXCLUDED.lesson_status,
       score_raw = COALESCE(EXCLUDED.score_raw, scorm_tracking.score_raw),
       score_min = COALESCE(EXCLUDED.score_min, scorm_tracking.score_min),
       score_max = COALESCE(EXCLUDED.score_max, scorm_tracking.score_max),
       total_time_seconds = scorm_tracking.total_time_seconds + $7,
       suspend_data = COALESCE(EXCLUDED.suspend_data, scorm_tracking.suspend_data),
       lesson_location = COALESCE(EXCLUDED.lesson_location, scorm_tracking.lesson_location),
       updated_at = now()`,
    [
      packageId,
      enrollmentId,
      state.lessonStatus,
      state.scoreRaw ?? null,
      state.scoreMin ?? null,
      state.scoreMax ?? null,
      Math.max(0, Math.round(sessionSeconds)),
      state.suspendData ?? null,
      state.lessonLocation ?? null,
    ],
  );
}

/**
 * O acompanhamento de um pacote 2004.
 *
 * Consulta separada da do 1.2 porque são colunas diferentes, e uma só que
 * lesse todas devolveria metade nula para cada versão — deixando quem chama
 * decidir o que é vazio de verdade e o que é da outra versão.
 *
 * `scaledPassingScore` vem do PACOTE, não do acompanhamento: é característica
 * do conteúdo, igual para todo mundo que o fizer.
 */
export async function find2004Tracking(
  packageId: string,
  enrollmentId: string,
): Promise<Scorm2004State> {
  const rows = await query<{
    completion_status: CompletionStatus | null;
    success_status: SuccessStatus | null;
    score_scaled: string | null;
    score_raw: string | null;
    score_min: string | null;
    score_max: string | null;
    total_time_seconds: number;
    suspend_data: string | null;
    location: string | null;
    exit_mode: ExitMode | null;
    scaled_passing_score: string | null;
  }>(
    `SELECT t.completion_status, t.success_status, t.score_scaled,
            t.score_raw, t.score_min, t.score_max,
            t.total_time_seconds, t.suspend_data,
            t.lesson_location AS location, t.exit_mode,
            p.scaled_passing_score
       FROM scorm_tracking t
       JOIN scorm_packages p ON p.id = t.package_id
      WHERE t.package_id = $1 AND t.enrollment_id = $2
      LIMIT 1`,
    [packageId, enrollmentId],
  );

  const row = rows[0];
  if (!row) {
    /* Sem linha, a nota de corte ainda precisa vir: ela decide aprovação já na
       primeira tentativa, antes de existir acompanhamento. */
    const doPacote = await query<{ scaled_passing_score: string | null }>(
      `SELECT scaled_passing_score FROM scorm_packages WHERE id = $1`,
      [packageId],
    );
    const corte = doPacote[0]?.scaled_passing_score;

    return {
      completionStatus: "not attempted",
      successStatus: "unknown",
      totalTimeSeconds: 0,
      exit: "",
      ...(corte !== null && corte !== undefined ? { scaledPassingScore: Number(corte) } : {}),
    };
  }

  return {
    /* Nulo vira "unknown", que é o valor que o padrão define para "ainda não
       se sabe" — e não "not attempted", que afirmaria algo que não sabemos. */
    completionStatus: row.completion_status ?? "not attempted",
    successStatus: row.success_status ?? "unknown",
    totalTimeSeconds: row.total_time_seconds,
    exit: row.exit_mode ?? "",
    ...(row.score_scaled !== null ? { scoreScaled: Number(row.score_scaled) } : {}),
    ...(row.score_raw !== null ? { scoreRaw: Number(row.score_raw) } : {}),
    ...(row.score_min !== null ? { scoreMin: Number(row.score_min) } : {}),
    ...(row.score_max !== null ? { scoreMax: Number(row.score_max) } : {}),
    ...(row.suspend_data ? { suspendData: row.suspend_data } : {}),
    ...(row.location ? { location: row.location } : {}),
    ...(row.scaled_passing_score !== null
      ? { scaledPassingScore: Number(row.scaled_passing_score) }
      : {}),
  };
}

/**
 * Grava o acompanhamento de um pacote 2004.
 *
 * `COALESCE(EXCLUDED.x, tabela.x)` em cada campo, como na versão 1.2, e pela
 * mesma razão: o conteúdo manda um `Commit` com o que mudou, não com o estado
 * inteiro. Sobrescrever com nulo apagaria a nota de quem só mexeu na posição.
 *
 * `lesson_status` fica nulo aqui de propósito. Preenchê-lo com uma tradução do
 * `completion_status` colocaria na mesma linha duas respostas para a mesma
 * pergunta, e um dia elas discordariam — quem lesse a coluna errada veria
 * "incomplete" numa aula concluída.
 */
export async function save2004Tracking(
  packageId: string,
  enrollmentId: string,
  state: Scorm2004State,
  sessionSeconds: number,
): Promise<void> {
  await query(
    `INSERT INTO scorm_tracking
            (package_id, enrollment_id, completion_status, success_status,
             score_scaled, score_raw, score_min, score_max,
             total_time_seconds, suspend_data, lesson_location, exit_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (package_id, enrollment_id) DO UPDATE SET
       completion_status = EXCLUDED.completion_status,
       success_status = EXCLUDED.success_status,
       score_scaled = COALESCE(EXCLUDED.score_scaled, scorm_tracking.score_scaled),
       score_raw = COALESCE(EXCLUDED.score_raw, scorm_tracking.score_raw),
       score_min = COALESCE(EXCLUDED.score_min, scorm_tracking.score_min),
       score_max = COALESCE(EXCLUDED.score_max, scorm_tracking.score_max),
       total_time_seconds = scorm_tracking.total_time_seconds + $9,
       suspend_data = COALESCE(EXCLUDED.suspend_data, scorm_tracking.suspend_data),
       lesson_location = COALESCE(EXCLUDED.lesson_location, scorm_tracking.lesson_location),
       exit_mode = EXCLUDED.exit_mode,
       updated_at = now()`,
    [
      packageId,
      enrollmentId,
      state.completionStatus,
      state.successStatus,
      state.scoreScaled ?? null,
      state.scoreRaw ?? null,
      state.scoreMin ?? null,
      state.scoreMax ?? null,
      Math.max(0, Math.round(sessionSeconds)),
      state.suspendData ?? null,
      state.location ?? null,
      state.exit,
    ],
  );
}
