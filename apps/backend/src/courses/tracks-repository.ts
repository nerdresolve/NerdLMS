import type { Track } from "@nerdlms/core/courses/tracks.ts";

import { query } from "../db/pool.ts";

/**
 * Trilhas de aprendizagem.
 *
 * Uma trilha é uma sequência de cursos com nome próprio — "Operação de Água"
 * junta três cursos numa jornada. A ordem vive em `track_courses.position`, e
 * é ela que decide o que abre primeiro no modo sequencial.
 *
 * O recorte por projeto acontece na leitura, como em `findEvents`: trilha sem
 * projeto vale para todo mundo.
 */

interface TrackRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  mode: string;
  project: string | null;
  /* `array_agg` devolve os ids já ordenados pela posição. Montar isso em JS
     exigiria uma segunda consulta ou um agrupamento manual, e a ordem é
     justamente o que define a trilha. */
  course_ids: string[] | null;
}

export async function findTracks(tenantId: string, project: string | null): Promise<Track[]> {
  const rows = await query<TrackRow>(
    `SELECT t.id, t.slug, t.title, t.summary, t.mode, t.project,
            array_remove(array_agg(tc.course_id ORDER BY tc.position), NULL) AS course_ids
       FROM tracks t
       LEFT JOIN track_courses tc ON tc.track_id = t.id
      WHERE t.tenant_id = $2
        AND (t.project IS NULL OR t.project = $1)
      GROUP BY t.id
      ORDER BY t.title`,
    [project, tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    courseIds: row.course_ids ?? [],
    /* Um valor fora do domínio viraria trilha travada sem motivo aparente.
       "free" é o padrão seguro: mostra tudo em vez de esconder tudo. */
    mode: row.mode === "sequential" ? "sequential" : "free",
    ...(row.project ? { project: row.project } : {}),
  }));
}
