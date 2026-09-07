import { query } from "../db/pool.ts";

/**
 * Escrita de curso, módulo e aula.
 *
 * Toda função devolve `false` quando nada mudou — curso inexistente, ou de
 * outro autor. Quem traduz isso em 404 é o caso de uso, e a mesma resposta
 * para "não existe" e "não é seu" é deliberada.
 */

export interface CourseOwnership {
  courseId: string;
  authorId: string;
  status: "draft" | "published" | "archived";
  lessons: number;
  /** Quantas pessoas já se matricularam. Zero permite voltar ao rascunho. */
  enrollments: number;
  /** O cliente dono do curso — as tags e categorias são resolvidas nele. */
  tenantId: string;
  /** Título atual, usado para nomear a cópia (F2-07). */
  title: string;
}

interface OwnershipRow {
  course_id: string;
  author_id: string;
  status: CourseOwnership["status"];
  lessons: string;
  enrollments: string;
  tenant_id: string;
  title: string;
}

/** Autoria, situação e contagem de aulas — o que a decisão de editar precisa. */
export async function findCourseOwnership(courseId: string): Promise<CourseOwnership | null> {
  const rows = await query<OwnershipRow>(
    `SELECT c.id AS course_id, c.author_id, c.status, c.tenant_id, c.title,
            (SELECT count(*)
               FROM lessons l
               JOIN modules m ON m.id = l.module_id
              WHERE m.course_id = c.id) AS lessons,
            /* Quantas pessoas dependem deste curso. Decide se dá para voltar
               ao rascunho — que tiraria o acesso delas. */
            (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id) AS enrollments
       FROM courses c
      WHERE c.id = $1
      LIMIT 1`,
    [courseId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    courseId: row.course_id,
    authorId: row.author_id,
    status: row.status,
    tenantId: row.tenant_id,
    title: row.title,
    lessons: Number(row.lessons),
    enrollments: Number(row.enrollments),
  };
}

/** Atualiza título e resumo. */
export async function updateCourse(
  courseId: string,
  title: string,
  summary: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE courses SET title = $2, summary = $3, updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [courseId, title, summary],
  );
  return rows.length > 0;
}

/** Publica o curso. Idempotente: publicar o que já está publicado não falha. */
export async function publishCourse(courseId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE courses SET status = 'published', updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [courseId],
  );
  return rows.length > 0;
}

/**
 * Muda o curso de estado, sem apagar nada.
 *
 * `archived` aposenta o curso: sai do catálogo e não aceita matrícula nova,
 * mas quem já cursava continua entrando — inclusive para baixar o certificado.
 * `draft` devolve ao rascunho, para corrigir o que foi publicado cedo demais.
 *
 * Não existe DELETE de curso. Apagar levaria junto matrícula, progresso e
 * comentário de quem passou por ele, e o certificado já emitido passaria a
 * apontar para nada — o código de verificação deixaria de conferir.
 */
export async function setCourseStatus(
  courseId: string,
  status: "draft" | "archived",
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE courses SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [courseId, status],
  );
  return rows.length > 0;
}

/**
 * Acrescenta um módulo no fim da lista.
 *
 * A posição é calculada no próprio `INSERT`: lê-la antes, em outra consulta,
 * deixaria duas criações simultâneas disputarem o mesmo número — e a restrição
 * `UNIQUE (course_id, position)` recusaria a segunda.
 */
export async function createModule(courseId: string, title: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO modules (course_id, title, position)
     VALUES ($1, $2, (SELECT coalesce(max(position), 0) + 1 FROM modules WHERE course_id = $1))
     RETURNING id`,
    [courseId, title],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error("Módulo não pôde ser criado.");
  return id;
}

/**
 * Acrescenta uma aula no fim do módulo.
 *
 * `mediaKey` é a chave do arquivo no storage, devolvida pelo upload. Fica nula
 * quando a aula é criada sem vídeo: o instrutor cadastra a estrutura primeiro e
 * envia o arquivo depois, que é como se monta um curso na prática.
 */
export interface LessonContent {
  kind?: string;
  textContent?: string | null;
  externalUrl?: string | null;
  pageCount?: number | null;
  minSeconds?: number | null;
}

export async function createLesson(
  moduleId: string,
  title: string,
  durationSeconds: number,
  mediaKey?: string,
  content: LessonContent = {},
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO lessons (module_id, title, duration_seconds, media_key, position,
                          kind, text_content, external_url, page_count, min_seconds)
     VALUES ($1, $2, $3, $4,
             (SELECT coalesce(max(position), 0) + 1 FROM lessons WHERE module_id = $1),
             COALESCE($5, 'video'), $6, $7, $8, $9)
     RETURNING id`,
    [
      moduleId,
      title,
      durationSeconds,
      mediaKey ?? null,
      content.kind ?? null,
      content.textContent ?? null,
      content.externalUrl ?? null,
      content.pageCount ?? null,
      content.minSeconds ?? null,
    ],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error("Aula não pôde ser criada.");
  return id;
}

/** O curso ao qual um módulo pertence, para conferir autoria antes de escrever. */
export async function findModuleCourse(moduleId: string): Promise<string | null> {
  const rows = await query<{ course_id: string }>(
    `SELECT course_id FROM modules WHERE id = $1 LIMIT 1`,
    [moduleId],
  );
  return rows[0]?.course_id ?? null;
}

/**
 * Slugs já em uso NESTE cliente, para o novo curso não colidir.
 *
 * O recorte importa dos dois lados: sem ele, um curso da ACME evitaria um slug
 * que só existe na organização (ganhando um "-2" sem motivo) e — pior — a checagem
 * passaria a depender do catálogo alheio. A unicidade é por tenant desde a
 * migração 003.
 */
export async function findCourseSlugs(tenantId: string): Promise<string[]> {
  const rows = await query<{ slug: string }>(
    `SELECT slug FROM courses WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows.map((row) => row.slug);
}

/**
 * Cria o curso como rascunho.
 *
 * Nasce em `draft` — que já é o padrão da coluna — porque um curso recém-criado
 * não tem aula nenhuma, e publicar vazio matricularia alunos em nada. Quem
 * publica é `publishCourseUseCase`, depois de haver conteúdo.
 *
 * `artwork` é escolhido por rodízio sobre os cursos existentes: as capas são
 * geradas por gradiente, e sem variar o índice toda capa nova sairia igual.
 */
export async function createCourse(input: {
  tenantId: string;
  slug: string;
  title: string;
  summary: string;
  authorId: string;
  project: string | null;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    /* O rodízio da capa conta só os cursos DESTE cliente: contar os de todos
       faria a variação depender do catálogo alheio. */
    `INSERT INTO courses (tenant_id, slug, title, summary, author_id, project, status, artwork)
     VALUES ($6, $1, $2, $3, $4, $5, 'draft',
             (SELECT count(*) % 4 FROM courses WHERE tenant_id = $6))
     RETURNING id`,
    [input.slug, input.title, input.summary, input.authorId, input.project, input.tenantId],
  );

  const row = rows[0];
  if (!row) throw new Error("Curso não pôde ser criado.");
  return row.id;
}

/**
 * O curso a que uma aula pertence.
 *
 * Existe para o conteúdo interativo (F6-05): as respostas são por MATRÍCULA, e
 * achar a matrícula exige o curso — que a aula só conhece através do módulo.
 */
export async function courseOfLesson(lessonId: string): Promise<string | null> {
  const rows = await query<{ course_id: string }>(
    `SELECT m.course_id
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1
      LIMIT 1`,
    [lessonId],
  );

  return rows[0]?.course_id ?? null;
}
