import { query, withTransaction } from "../db/pool.ts";

/**
 * A fila de cortes de vídeo.
 *
 * O trabalho é enfileirado quando uma aula recebe um vídeo mais longo que o
 * teto; um trabalhador o pega, corta, e substitui a aula por N aulas.
 */

export interface TrabalhoDeCorte {
  id: string;
  tenantId: string;
  lessonId: string;
  courseId: string;
  mediaKey: string;
  attempts: number;
}

/**
 * Enfileira o corte de uma aula.
 *
 * Devolve `null` quando já existe um trabalho em andamento para a mesma aula —
 * o índice único parcial recusando. Dois cliques em "Aula" com o mesmo arquivo
 * enfileirariam dois cortes do mesmo vídeo, e o segundo trabalharia sobre uma
 * aula que o primeiro já substituiu.
 */
export async function enfileirarCorte(input: {
  tenantId: string;
  lessonId: string;
  courseId: string;
  mediaKey: string;
}): Promise<string | null> {
  const linhas = await query<{ id: string }>(
    `INSERT INTO video_split_jobs (tenant_id, lesson_id, course_id, media_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [input.tenantId, input.lessonId, input.courseId, input.mediaKey],
  );

  const id = linhas[0]?.id ?? null;

  if (id !== null) {
    await query(`UPDATE lessons SET media_status = 'splitting' WHERE id = $1`, [input.lessonId]);
  }

  return id;
}

/**
 * Pega o próximo trabalho e já o marca como em andamento.
 *
 * `FOR UPDATE SKIP LOCKED` numa transação: dois trabalhadores rodando ao mesmo
 * tempo pegam trabalhos DIFERENTES em vez de disputarem o mesmo. Sem isso, os
 * dois cortariam o mesmo vídeo e o segundo escreveria por cima do primeiro.
 *
 * `attempts` sobe aqui, e não no fim: um trabalho que derruba o processo no
 * meio precisa contar a tentativa, senão volta para a fila para sempre.
 */
export async function pegarProximoCorte(maxTentativas = 3): Promise<TrabalhoDeCorte | null> {
  return withTransaction(async (executar) => {
    const linhas = await executar<{
      id: string;
      tenant_id: string;
      lesson_id: string;
      course_id: string;
      media_key: string;
      attempts: number;
    }>(
      `SELECT id, tenant_id, lesson_id, course_id, media_key, attempts
         FROM video_split_jobs
        WHERE status = 'pending' AND attempts < $1
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [maxTentativas],
    );

    const linha = linhas[0];
    if (!linha) return null;

    await executar(
      `UPDATE video_split_jobs
          SET status = 'running', attempts = attempts + 1, updated_at = now()
        WHERE id = $1`,
      [linha.id],
    );

    return {
      id: linha.id,
      tenantId: linha.tenant_id,
      lessonId: linha.lesson_id,
      courseId: linha.course_id,
      mediaKey: linha.media_key,
      attempts: linha.attempts + 1,
    };
  });
}

export interface ParteParaGravar {
  titulo: string;
  mediaKey: string;
  duracaoSegundos: number;
}

/**
 * Troca a aula original pelas partes, numa transação só.
 *
 * A PRIMEIRA PARTE REAPROVEITA A AULA que já existe, em vez de apagar e criar
 * N novas: a aula pode já estar referenciada — numa trilha, num badge, no
 * progresso de quem abriu o curso enquanto o corte rodava — e recriá-la
 * quebraria essas referências sem nada avisando.
 *
 * As demais entram logo depois, e as aulas seguintes do módulo descem. O índice
 * único de posição é `DEFERRABLE INITIALLY DEFERRED`, então a conferência só
 * acontece no commit: dá para abrir espaço sem o truque de deslocar tudo para
 * um intervalo alto e voltar.
 */
export async function substituirPorPartes(
  lessonId: string,
  partes: ParteParaGravar[],
): Promise<number> {
  if (partes.length === 0) return 0;

  return withTransaction(async (executar) => {
    const atual = await executar<{ module_id: string; position: number }>(
      `SELECT module_id, position FROM lessons WHERE id = $1`,
      [lessonId],
    );

    const aula = atual[0];
    if (!aula) return 0;

    const extras = partes.length - 1;

    if (extras > 0) {
      /* Espaço para as partes novas. Da última para a primeira não é preciso:
         a conferência do índice está adiada até o commit. */
      await executar(
        `UPDATE lessons
            SET position = position + $3
          WHERE module_id = $1 AND position > $2`,
        [aula.module_id, aula.position, extras],
      );
    }

    const primeira = partes[0]!;

    await executar(
      `UPDATE lessons
          SET title = $2, media_key = $3, duration_seconds = $4, media_status = 'ready'
        WHERE id = $1`,
      [lessonId, primeira.titulo, primeira.mediaKey, primeira.duracaoSegundos],
    );

    for (const [indice, parte] of partes.slice(1).entries()) {
      await executar(
        `INSERT INTO lessons
           (module_id, title, position, duration_seconds, kind, media_key, media_status)
         VALUES ($1, $2, $3, $4, 'video', $5, 'ready')`,
        [
          aula.module_id,
          parte.titulo,
          aula.position + indice + 1,
          parte.duracaoSegundos,
          parte.mediaKey,
        ],
      );
    }

    return partes.length;
  });
}

/** O trabalho terminou bem. */
export async function concluirCorte(jobId: string): Promise<void> {
  await query(
    `UPDATE video_split_jobs SET status = 'done', error = NULL, updated_at = now() WHERE id = $1`,
    [jobId],
  );
}

/**
 * O trabalho falhou.
 *
 * Volta para 'pending' enquanto houver tentativa sobrando — falha de rede ao
 * baixar o arquivo costuma passar na segunda. Esgotadas as tentativas, o
 * trabalho fica 'failed' e a AULA também: um vídeo inteiro publicado como se
 * fosse uma aula de quinze minutos seria pior que uma aula marcada com
 * problema, porque ninguém saberia.
 */
export async function falharCorte(
  jobId: string,
  lessonId: string,
  motivo: string,
  maxTentativas = 3,
): Promise<void> {
  const linhas = await query<{ attempts: number }>(
    `UPDATE video_split_jobs
        SET status = CASE WHEN attempts >= $3 THEN 'failed' ELSE 'pending' END,
            error = $2,
            updated_at = now()
      WHERE id = $1
      RETURNING attempts`,
    [jobId, motivo.slice(0, 500), maxTentativas],
  );

  if ((linhas[0]?.attempts ?? 0) >= maxTentativas) {
    await query(`UPDATE lessons SET media_status = 'failed' WHERE id = $1`, [lessonId]);
  }
}

/** Quantos trabalhos esperam, para quem quiser saber sem abrir o banco. */
export async function corteEmAndamento(courseId: string): Promise<number> {
  const linhas = await query<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM video_split_jobs
      WHERE course_id = $1 AND status IN ('pending', 'running')`,
    [courseId],
  );

  return Number(linhas[0]?.total ?? 0);
}
