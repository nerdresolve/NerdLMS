import type { Track } from "@nerdlms/core/courses/tracks.ts";

import { query, withTransaction } from "../db/pool.ts";

/**
 * Trilhas de aprendizagem.
 *
 * Uma trilha é uma sequência de cursos com nome próprio — "Operação de Água"
 * junta três cursos numa jornada. A ordem vive em `track_courses.position`, e
 * é ela que decide o que abre primeiro no modo sequencial.
 *
 * O recorte acontece na leitura, como em `findEvents`, e tem DUAS dimensões:
 * o local (`project`) e a função (`job_title`). Campo em branco na trilha é
 * ausência de filtro, não filtro que não casa — a regra inteira, com o porquê,
 * está em `core/courses/alvo-da-trilha.ts`.
 */

interface TrackRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  mode: string;
  project: string | null;
  job_title: string | null;
  /* `array_agg` devolve os ids já ordenados pela posição. Montar isso em JS
     exigiria uma segunda consulta ou um agrupamento manual, e a ordem é
     justamente o que define a trilha. */
  course_ids: string[] | null;
}

/**
 * Todas as trilhas do cliente, sem recorte.
 *
 * Existe separada de `findTracks` porque "sem recorte" e "recorte vazio" são
 * coisas diferentes, e passar `null` para dizer as duas foi o que confundiu a
 * chamada da tela de badges: lá o `null` queria dizer "todas", enquanto na
 * trilha `project` nulo quer dizer "para todos". Nomes distintos, sentidos
 * distintos.
 */
export async function findAllTracks(tenantId: string): Promise<Track[]> {
  const rows = await query<TrackRow>(
    `SELECT t.id, t.slug, t.title, t.summary, t.mode, t.project, t.job_title,
            array_remove(array_agg(tc.course_id ORDER BY tc.position), NULL) AS course_ids
       FROM tracks t
       LEFT JOIN track_courses tc ON tc.track_id = t.id
      WHERE t.tenant_id = $1
      GROUP BY t.id
      ORDER BY t.title`,
    [tenantId],
  );

  return rows.map(paraTrilha);
}

export interface QuemPergunta {
  project: string | null;
  jobTitle: string | null;
}

/**
 * As trilhas que alcançam esta pessoa.
 *
 * A comparação é frouxa no SQL pelo mesmo motivo que é frouxa no núcleo: o
 * cargo e a área vêm digitados por gente, do Active Directory, e um espaço a
 * mais faria a trilha sumir sem erro e sem aviso. `lower(btrim(...))` cobre
 * caixa e espaço; o acento fica de fora porque a mesma unidade não costuma
 * aparecer escrita das duas formas no diretório, e trazer `unaccent` obrigaria
 * a instalar uma extensão no banco de produção por um caso hipotético.
 */
export async function findTracks(tenantId: string, quem: QuemPergunta): Promise<Track[]> {
  const rows = await query<TrackRow>(
    `SELECT t.id, t.slug, t.title, t.summary, t.mode, t.project, t.job_title,
            array_remove(array_agg(tc.course_id ORDER BY tc.position), NULL) AS course_ids
       FROM tracks t
       LEFT JOIN track_courses tc ON tc.track_id = t.id
      WHERE t.tenant_id = $3
        AND (btrim(coalesce(t.project, '')) = ''
             OR lower(btrim(t.project)) = lower(btrim(coalesce($1, ''))))
        AND (btrim(coalesce(t.job_title, '')) = ''
             OR lower(btrim(t.job_title)) = lower(btrim(coalesce($2, ''))))
      GROUP BY t.id
      ORDER BY t.title`,
    [quem.project, quem.jobTitle, tenantId],
  );

  return rows.map(paraTrilha);
}

function paraTrilha(row: TrackRow): Track {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    courseIds: row.course_ids ?? [],
    /* Um valor fora do domínio viraria trilha travada sem motivo aparente.
       "free" é o padrão seguro: mostra tudo em vez de esconder tudo. */
    mode: row.mode === "sequential" ? "sequential" : "free",
    ...(row.project ? { project: row.project } : {}),
    ...(row.job_title ? { jobTitle: row.job_title } : {}),
  };
}

/* ---------------------------------------------------------------------------
   Gestão de trilhas
   ---------------------------------------------------------------------------

   Até aqui o arquivo só LIA. As trilhas existiam no schema, na tela do aluno e
   na configuração de badge, e não havia nenhum caminho para criar uma — o banco
   deste cliente tinha zero. Uma funcionalidade inteira que só sabia mostrar o
   que ninguém conseguia cadastrar.
   --------------------------------------------------------------------------- */

export interface NovaTrilha {
  tenantId: string;
  slug: string;
  title: string;
  summary: string;
  mode: "sequential" | "free";
  /** Nulo: qualquer unidade. */
  project: string | null;
  /** Nulo: qualquer função. */
  jobTitle: string | null;
}

/**
 * Cria a trilha e devolve o id.
 *
 * `null` quando o slug já existe no cliente: duas trilhas com o mesmo endereço
 * fariam uma delas ficar inalcançável. Quem chama transforma isso em mensagem;
 * deixar o banco levantar a violação daria um texto sobre índice único.
 */
export async function createTrack(nova: NovaTrilha): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO tracks (tenant_id, slug, title, summary, mode, project, job_title)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [nova.tenantId, nova.slug, nova.title, nova.summary, nova.mode, nova.project, nova.jobTitle],
  );

  return rows[0]?.id ?? null;
}

export interface EdicaoDaTrilha {
  tenantId: string;
  trackId: string;
  title: string;
  summary: string;
  mode: "sequential" | "free";
  project: string | null;
  jobTitle: string | null;
}

/** Devolve `false` quando a trilha não é deste cliente — ou não existe. */
export async function updateTrack(edicao: EdicaoDaTrilha): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE tracks
        SET title = $3, summary = $4, mode = $5, project = $6, job_title = $7
      WHERE id = $2 AND tenant_id = $1
      RETURNING id`,
    [
      edicao.tenantId,
      edicao.trackId,
      edicao.title,
      edicao.summary,
      edicao.mode,
      edicao.project,
      edicao.jobTitle,
    ],
  );

  return rows.length > 0;
}

/**
 * Substitui os cursos da trilha, na ordem recebida.
 *
 * Apaga e reinsere em vez de conciliar: a ordem é o conteúdo, e uma
 * reconciliação por diferença precisaria mexer em `position` de qualquer jeito.
 * Numa transação, para a trilha nunca ficar sem cursos entre os dois passos.
 */
export async function setTrackCourses(
  tenantId: string,
  trackId: string,
  courseIds: string[],
): Promise<boolean> {
  const daCasa = await query<{ id: string }>(
    `SELECT id FROM tracks WHERE id = $1 AND tenant_id = $2`,
    [trackId, tenantId],
  );

  if (daCasa.length === 0) return false;

  return withTransaction(async (executar) => {
    await executar(`DELETE FROM track_courses WHERE track_id = $1`, [trackId]);

    for (const [posicao, courseId] of courseIds.entries()) {
      /* O curso precisa ser do mesmo cliente: um id de outro tenant montaria
         uma trilha que atravessa a fronteira, e ela é a que nada atravessa. */
      await executar(
        `INSERT INTO track_courses (track_id, course_id, position)
         SELECT $1, c.id, $3 FROM courses c WHERE c.id = $2 AND c.tenant_id = $4`,
        [trackId, courseId, posicao + 1, tenantId],
      );
    }

    return true;
  });
}

export interface PessoaDaMatriz {
  id: string;
  project: string | null;
  jobTitle: string | null;
}

/**
 * Quem entra na matriz de treinamento.
 *
 * Só contas ATIVAS: convite pendente e conta desativada distorceriam a
 * contagem de "quantas pessoas nesta função" sem que ninguém precisasse ser
 * treinado hoje.
 */
export async function pessoasDaMatriz(tenantId: string): Promise<PessoaDaMatriz[]> {
  const rows = await query<{ id: string; project: string | null; job_title: string | null }>(
    `SELECT id, project, job_title
       FROM users
      WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId],
  );

  return rows.map((row) => ({ id: row.id, project: row.project, jobTitle: row.job_title }));
}
