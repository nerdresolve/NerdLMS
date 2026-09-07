/**
 * Regras do catálogo — TASK-017.
 *
 * Filtro, busca e ordenação são puros e ficam aqui em vez de dentro do
 * componente: a mesma regra vai valer no servidor quando a lista passar a ser
 * paginada pelo banco (TASK-006), e assim os dois lados não divergem.
 */

import { courseProgress, type ProgressSummary } from "./progress.ts";
import { estadoDoCurso, type EstadoDoCurso } from "./completion.ts";
import type { Course, Enrollment } from "./types.ts";

export type CatalogFilter =
  | "all"
  | "not_started"
  | "in_progress"
  | "completed"
  | "saved";
export type CatalogSort = "continue" | "alphabetical" | "progress";

/**
 * O que filtrar, buscar e contar realmente precisam.
 *
 * A matrícula fica de fora de propósito: nem `queryCatalog` nem
 * `catalogCounts` a consultam, e deixá-la no contrato obrigaria a biblioteca —
 * onde a matrícula pode não existir — a duplicar as duas funções.
 */
export interface CatalogItem {
  course: Course;
  /** Resumo completo: o card mostra "X de Y aulas", não só o percentual. */
  summary: ProgressSummary;
  saved: boolean;
  /**
   * O estado do CURSO, que não é o das aulas.
   *
   * Com prova obrigatória, terminar as aulas não fecha o curso — e o filtro
   * "Concluídos" saía de `summary.status`, listando curso cuja prova não foi
   * feita. O aluno via o curso entre os concluídos e o certificado era
   * recusado; a tela prometia o que a regra negava.
   *
   * Ausente quando quem montou a lista não tinha o estado das provas em mãos:
   * aí vale o das aulas, que é o comportamento de antes.
   */
  estado?: EstadoDoCurso;
}

export interface CatalogEntry extends CatalogItem {
  enrollment: Enrollment;
}

export interface CatalogQuery {
  filter?: CatalogFilter;
  /** Texto livre. Ignora acento e caixa. */
  search?: string;
  sort?: CatalogSort;
  /** Slug da categoria. Sem ele, o catálogo inteiro. */
  categorySlug?: string;
  /** Slug da tag. */
  tagSlug?: string;
}

/**
 * Entrada da biblioteca (`/cursos`), onde o catálogo inteiro aparece.
 *
 * Difere de `CatalogEntry` num ponto só, e é o ponto que importa: a matrícula é
 * **opcional**. "Meus cursos" mostra o que a pessoa já cursa; a biblioteca
 * existe para descobrir o que ela ainda não cursa, e um curso sem matrícula
 * precisa aparecer — com progresso zerado e convite para se inscrever.
 */
export interface LibraryEntry extends CatalogItem {
  enrollment: Enrollment | null;
  enrolled: boolean;
}

/**
 * Monta a biblioteca: todo curso entra, com ou sem matrícula.
 *
 * O progresso de quem não está matriculado é o do curso vazio — 0%, nenhuma
 * aula concluída — e não um valor inventado. Quem está matriculado vê o
 * progresso real, igual ao de "Meus cursos".
 */
export function toLibraryEntries(courses: Course[], enrollments: Enrollment[]): LibraryEntry[] {
  return courses.map((course) => {
    const enrollment = enrollments.find((item) => item.courseId === course.id) ?? null;
    const summary = enrollment
      ? courseProgress(course, enrollment)
      : courseProgress(course, { courseId: course.id, learnerId: "", enrolledBy: "self", progress: {} });

    return {
      course,
      enrollment,
      summary,
      saved: enrollment?.saved === true,
      enrolled: enrollment !== null,
    };
  });
}

/**
 * Normaliza para busca: minúsculas, sem acento e sem espaço redundante.
 * "Água" e "agua" precisam encontrar o mesmo curso — o catálogo é pt-BR.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function matches(entry: CatalogItem, term: string): boolean {
  /* Categoria e tags entram no que a busca alcança: quem digita "elétrica"
     espera achar o curso de NR-10, mesmo que a palavra não apareça no título
     nem no resumo. A categoria mãe entra junto, para "segurança" encontrar as
     filhas. */
  const categoria = entry.course.category;
  const extras = [
    categoria?.name ?? "",
    categoria?.parentName ?? "",
    ...(entry.course.tags ?? []).map((tag) => tag.name),
    entry.course.code ?? "",
  ].join(" ");

  const haystack = normalizeForSearch(`${entry.course.title} ${entry.course.summary} ${extras}`);
  // Todos os termos precisam aparecer; a ordem não importa.
  return normalizeForSearch(term)
    .split(" ")
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function toCatalogEntries(
  courses: Course[],
  enrollments: Enrollment[],
  /** Melhor percentual por curso, quando se sabe. Ver `estado` em `CatalogItem`. */
  notas?: Map<string, number | null>,
): CatalogEntry[] {
  return courses.flatMap((course) => {
    const enrollment = enrollments.find((item) => item.courseId === course.id);
    if (!enrollment) return [];

    const summary = courseProgress(course, enrollment);

    return [
      {
        course,
        enrollment,
        summary,
        saved: enrollment.saved === true,
        ...(notas
          ? {
              estado: estadoDoCurso(summary, {
                notaMinima: course.minGradePercent ?? null,
                melhorPercentual: notas.get(course.id) ?? null,
              }),
            }
          : {}),
      },
    ];
  });
}

/**
 * Concluído é o estado do CURSO — prova incluída, quando há.
 *
 * `estado` ausente cai no das aulas: é o comportamento de quem chama sem
 * saber das provas, e mantém funcionando quem ainda não passou a informar.
 */
const concluido = (entry: CatalogItem): boolean =>
  entry.estado ? entry.estado === "concluido" : entry.summary.status === "completed";

const FILTERS: Record<CatalogFilter, (entry: CatalogItem) => boolean> = {
  all: () => true,
  /* Os três estados abaixo são mutuamente exclusivos e cobrem o conjunto
     inteiro, de modo que somados reproduzem o total de "Todos". "Salvos"
     atravessa os três e fica de fora dessa soma. */
  not_started: (entry) => entry.summary.status === "not_started" && !concluido(entry),
  /* "Em andamento" inclui quem terminou as aulas e ainda deve a prova. Sem
     isso, o curso não apareceria em nenhum dos três. */
  in_progress: (entry) => !concluido(entry) && entry.summary.status !== "not_started",
  completed: concluido,
  saved: (entry) => entry.saved,
};

function compare(sort: CatalogSort, a: CatalogItem, b: CatalogItem): number {
  if (sort === "alphabetical") return a.course.title.localeCompare(b.course.title, "pt-BR");
  if (sort === "progress") return b.summary.percent - a.summary.percent;

  // "continue": quem está em andamento vem primeiro, do mais avançado ao menos;
  // depois os não iniciados; concluídos por último.
  const rank = { in_progress: 0, not_started: 1, completed: 2 } as const;
  const byStatus = rank[a.summary.status] - rank[b.summary.status];
  if (byStatus !== 0) return byStatus;
  if (a.summary.status === "in_progress") return b.summary.percent - a.summary.percent;
  return a.course.title.localeCompare(b.course.title, "pt-BR");
}

export function queryCatalog<T extends CatalogItem>(entries: T[], query: CatalogQuery = {}): T[] {
  const { filter = "all", search = "", sort = "continue", categorySlug, tagSlug } = query;
  const term = search.trim();

  return entries
    .filter(FILTERS[filter])
    /* Curso fora do catálogo some da vitrine — mas nunca de quem já cursa.
       Esconder de quem tem matrícula tiraria o curso de "Meus cursos" e
       transformaria o progresso num link quebrado. */
    .filter((entry) => {
      if (entry.course.visibility !== "unlisted") return true;
      return "enrolled" in entry ? entry.enrolled === true : false;
    })
    .filter((entry) => (categorySlug ? entry.course.category?.slug === categorySlug : true))
    .filter((entry) =>
      tagSlug ? (entry.course.tags ?? []).some((tag) => tag.slug === tagSlug) : true,
    )
    .filter((entry) => (term === "" ? true : matches(entry, term)))
    .slice()
    .sort((a, b) => compare(sort, a, b));
}

/** Contagem por aba, sempre sobre o conjunto completo (a busca não altera). */
export function catalogCounts(entries: CatalogItem[]): Record<CatalogFilter, number> {
  return {
    all: entries.length,
    not_started: entries.filter(FILTERS.not_started).length,
    in_progress: entries.filter(FILTERS.in_progress).length,
    completed: entries.filter(FILTERS.completed).length,
    saved: entries.filter(FILTERS.saved).length,
  };
}
