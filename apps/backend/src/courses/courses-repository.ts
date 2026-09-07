import type { Course, Enrollment, Lesson, LessonProgress, Module, Tag } from "@nerdlms/core/courses/types.ts";

import { query } from "../db/pool.ts";

/**
 * Consultas de catálogo e progresso.
 *
 * O formato devolvido é o mesmo que `mocks/data.ts` entrega hoje — `Course`
 * com módulos e aulas aninhados, `Enrollment` com o progresso indexado por
 * aula. É isso que permite trocar a origem sem tocar em nenhuma tela: o
 * contrato é o tipo do domínio, não a forma da tabela.
 *
 * As consultas trazem tudo de uma vez e montam a árvore em memória. Uma
 * consulta por curso, depois uma por módulo, seria o problema N+1 clássico —
 * com 7 cursos ninguém nota, com 70 sim.
 */

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  author_id: string;
  status: Course["status"];
  enrollment_mode: Course["enrollmentMode"];
  project: string | null;
  artwork: Course["artwork"];
  /* Metadados da 007. Tudo anulável: curso antigo não tem nada preenchido. */
  code: string | null;
  workload_minutes: number | null;
  level: Course["level"] | null;
  language: string | null;
  objectives: string | null;
  audience: string | null;
  starts_on: Date | null;
  ends_on: Date | null;
  visibility: Course["visibility"];
  content_release: "open" | "sequential";
  min_grade_percent: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  category_parent_name: string | null;
}

interface CourseTagRow {
  course_id: string;
  id: string;
  name: string;
  slug: string;
}

/** `date` do Postgres → "AAAA-MM-DD", sem passar por fuso. */
function isoDate(value: Date | null): string | undefined {
  if (!value) return undefined;
  /* `toISOString` converteria para UTC e poderia recuar um dia. A data do
     Postgres já chega no fuso local do processo, então os componentes locais
     são os corretos. */
  const ano = value.getFullYear();
  const mes = String(value.getMonth() + 1).padStart(2, "0");
  const dia = String(value.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  position: number;
  duration_seconds: number;
  kind: Lesson["kind"];
  media_key: string | null;
  /* Aula de conteúdo — os campos da 013. */
  text_content: string | null;
  external_url: string | null;
  page_count: number | null;
  min_seconds: number | null;
}

/**
 * Todos os cursos, com módulos e aulas em ordem.
 *
 * Traz rascunho junto: quem filtra por situação é quem chama, porque o
 * instrutor precisa ver o próprio rascunho e o aluno não.
 */
/**
 * Todos os cursos DO TENANT, com módulos e aulas.
 *
 * `tenantId` é obrigatório, não opcional com padrão: uma assinatura que aceita
 * a ausência convida a chamadas sem recorte, e uma chamada sem recorte aqui
 * devolve o catálogo de todos os clientes.
 *
 * Módulos e aulas não têm `tenant_id` próprio — herdam do curso (ver a
 * migração 003). O recorte delas vem do JOIN, e é por isso que a consulta
 * passa por `courses` em vez de ler as tabelas soltas.
 */
export async function findAllCourses(tenantId: string): Promise<Course[]> {
  const [courseRows, moduleRows, lessonRows, tagRows] = await Promise.all([
    query<CourseRow>(
      `SELECT c.id, c.slug, c.title, c.summary, c.author_id, c.status,
              c.enrollment_mode, c.project, c.artwork,
              c.code, c.workload_minutes, c.level, c.language,
              c.objectives, c.audience, c.starts_on, c.ends_on, c.visibility,
              c.content_release, c.min_grade_percent,
              c.category_id,
              cat.name  AS category_name,
              cat.slug  AS category_slug,
              pai.name  AS category_parent_name
         FROM courses c
         LEFT JOIN course_categories cat ON cat.id = c.category_id
         LEFT JOIN course_categories pai ON pai.id = cat.parent_id
        WHERE c.tenant_id = $1
        ORDER BY c.title`,
      [tenantId],
    ),
    query<ModuleRow>(
      `SELECT m.id, m.course_id, m.title, m.position
         FROM modules m
         JOIN courses c ON c.id = m.course_id
        WHERE c.tenant_id = $1
        ORDER BY m.course_id, m.position`,
      [tenantId],
    ),
    query<LessonRow>(
      `SELECT l.id, l.module_id, l.title, l.position, l.duration_seconds, l.kind, l.media_key,
              l.text_content, l.external_url, l.page_count, l.min_seconds
         FROM lessons l
         JOIN modules m ON m.id = l.module_id
         JOIN courses c ON c.id = m.course_id
        WHERE c.tenant_id = $1
        ORDER BY l.module_id, l.position`,
      [tenantId],
    ),
    query<CourseTagRow>(
      `SELECT ct.course_id, t.id, t.name, t.slug
         FROM course_tags ct
         JOIN tags t    ON t.id = ct.tag_id
         JOIN courses c ON c.id = ct.course_id
        WHERE c.tenant_id = $1
        ORDER BY t.name`,
      [tenantId],
    ),
  ]);

  const tagsByCourse = new Map<string, Tag[]>();
  for (const row of tagRows) {
    const list = tagsByCourse.get(row.course_id) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    tagsByCourse.set(row.course_id, list);
  }

  const lessonsByModule = new Map<string, Lesson[]>();
  for (const row of lessonRows) {
    const list = lessonsByModule.get(row.module_id) ?? [];
    /* `kind` só entra quando não é o padrão: com `exactOptionalPropertyTypes`,
       a chave presente valendo `undefined` é diferente de ausente, e o domínio
       trata "vídeo" como a ausência. */
    const lesson: Lesson = {
      id: row.id,
      title: row.title,
      durationSeconds: row.duration_seconds,
      ...(row.kind && row.kind !== "video" ? { kind: row.kind } : {}),
      ...(row.media_key ? { mediaKey: row.media_key } : {}),
      ...(row.text_content ? { textContent: row.text_content } : {}),
      ...(row.external_url ? { externalUrl: row.external_url } : {}),
      ...(row.page_count !== null ? { pageCount: row.page_count } : {}),
      ...(row.min_seconds !== null ? { minSeconds: row.min_seconds } : {}),
    };
    list.push(lesson);
    lessonsByModule.set(row.module_id, list);
  }

  const modulesByCourse = new Map<string, Module[]>();
  for (const row of moduleRows) {
    const list = modulesByCourse.get(row.course_id) ?? [];
    list.push({ id: row.id, title: row.title, lessons: lessonsByModule.get(row.id) ?? [] });
    modulesByCourse.set(row.course_id, list);
  }

  return courseRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    authorId: row.author_id,
    status: row.status,
    enrollmentMode: row.enrollment_mode,
    artwork: row.artwork,
    modules: modulesByCourse.get(row.id) ?? [],
    ...(row.project ? { project: row.project } : {}),

    /* Metadados: a chave é OMITIDA quando não há valor, não atribuída como
       `undefined` — `exactOptionalPropertyTypes` distingue as duas coisas. */
    ...(row.code ? { code: row.code } : {}),
    ...(row.workload_minutes ? { workloadMinutes: row.workload_minutes } : {}),
    ...(row.level ? { level: row.level } : {}),
    ...(row.language ? { language: row.language } : {}),
    ...(row.objectives ? { objectives: row.objectives } : {}),
    ...(row.audience ? { audience: row.audience } : {}),
    ...(isoDate(row.starts_on) ? { startsOn: isoDate(row.starts_on)! } : {}),
    ...(isoDate(row.ends_on) ? { endsOn: isoDate(row.ends_on)! } : {}),
    ...(row.visibility ? { visibility: row.visibility } : {}),
    ...(row.content_release ? { contentRelease: row.content_release } : {}),
    ...(row.min_grade_percent !== null ? { minGradePercent: Number(row.min_grade_percent) } : {}),
    ...(row.category_id && row.category_name && row.category_slug
      ? {
          category: {
            id: row.category_id,
            name: row.category_name,
            slug: row.category_slug,
            ...(row.category_parent_name ? { parentName: row.category_parent_name } : {}),
          },
        }
      : {}),
    ...(tagsByCourse.has(row.id) ? { tags: tagsByCourse.get(row.id)! } : {}),
  }));
}

interface EnrollmentRow {
  id: string;
  course_id: string;
  learner_id: string;
  enrolled_by: string | null;
  saved: boolean;
}

interface ProgressRow {
  enrollment_id: string;
  lesson_id: string;
  watched_seconds: number;
  last_position_seconds: number;
  completed_at: Date | null;
  completion_source: "auto" | "manual" | null;
  pages_seen: number[] | null;
  seconds_on_page: number;
}

/**
 * Matrículas, com o progresso de cada aula.
 *
 * `learnerId` opcional: sem ele vêm todas — é o que as telas de gestor,
 * instrutor e admin precisam para agregar. Com ele, só as de uma pessoa.
 */
export async function findEnrollments(learnerId?: string): Promise<Enrollment[]> {
  const where = learnerId ? `WHERE learner_id = $1` : "";
  const params = learnerId ? [learnerId] : [];

  const rows = await query<EnrollmentRow>(
    `SELECT id, course_id, learner_id, enrolled_by, saved FROM enrollments ${where}`,
    params,
  );
  if (rows.length === 0) return [];

  const progressRows = await query<ProgressRow>(
    `SELECT enrollment_id, lesson_id, watched_seconds, last_position_seconds,
            completed_at, completion_source, pages_seen, seconds_on_page
       FROM lesson_progress
      WHERE enrollment_id = ANY($1::uuid[])`,
    [rows.map((row) => row.id)],
  );

  const progressByEnrollment = new Map<string, Record<string, LessonProgress>>();
  for (const row of progressRows) {
    const bag = progressByEnrollment.get(row.enrollment_id) ?? {};
    /* As chaves de conclusão são omitidas quando não há conclusão, e não
       atribuídas como undefined: `exactOptionalPropertyTypes` distingue as
       duas coisas, e o CHECK do banco garante que ou vêm as duas ou nenhuma. */
    bag[row.lesson_id] = {
      lessonId: row.lesson_id,
      watchedSeconds: row.watched_seconds,
      lastPositionSeconds: row.last_position_seconds,
      ...(row.pages_seen && row.pages_seen.length > 0 ? { pagesSeen: row.pages_seen } : {}),
      ...(row.seconds_on_page > 0 ? { secondsOnPage: row.seconds_on_page } : {}),
      ...(row.completed_at && row.completion_source
        ? {
            completedAt: row.completed_at.toISOString(),
            completionSource: row.completion_source,
          }
        : {}),
    };
    progressByEnrollment.set(row.enrollment_id, bag);
  }

  return rows.map((row) => ({
    courseId: row.course_id,
    learnerId: row.learner_id,
    /* `enrolled_by` aponta para o próprio aluno quando ele se inscreveu; o
       domínio representa isso como "self". */
    enrolledBy: row.enrolled_by === row.learner_id ? "self" : (row.enrolled_by ?? "self"),
    saved: row.saved,
    progress: progressByEnrollment.get(row.id) ?? {},
  }));
}

/**
 * Contagem para a página pública.
 *
 * Uma consulta só, com subconsultas: são quatro números para uma página que
 * qualquer pessoa abre, e quatro viagens ao banco por visita não se
 * justificam. Conta apenas o que é público — curso publicado, pessoa ativa —
 * porque rascunho e conta desativada não representam a plataforma.
 */
export async function countPlatform(tenantId: string): Promise<{
  learners: number;
  courses: number;
  lessons: number;
  completedLessons: number;
}> {
  const rows = await query<{
    learners: string;
    courses: string;
    lessons: string;
    completed: string;
  }>(
    `SELECT
       (SELECT count(*) FROM users
         WHERE tenant_id = $1 AND role = 'learner' AND status = 'active')         AS learners,
       (SELECT count(*) FROM courses
         WHERE tenant_id = $1 AND status = 'published')                           AS courses,
       (SELECT count(*) FROM lessons l
          JOIN modules m ON m.id = l.module_id
          JOIN courses c ON c.id = m.course_id
         WHERE c.tenant_id = $1 AND c.status = 'published')                       AS lessons,
       (SELECT count(*) FROM lesson_progress lp
          JOIN enrollments e ON e.id = lp.enrollment_id
          JOIN courses c ON c.id = e.course_id
         WHERE c.tenant_id = $1 AND lp.completed_at IS NOT NULL)                  AS completed`,
    [tenantId],
  );

  const row = rows[0];
  return {
    learners: Number(row?.learners ?? 0),
    courses: Number(row?.courses ?? 0),
    lessons: Number(row?.lessons ?? 0),
    completedLessons: Number(row?.completed ?? 0),
  };
}
