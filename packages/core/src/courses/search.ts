/**
 * Busca global.
 *
 * Diferente de `queryCatalog`, que filtra uma lista já montada de cursos: aqui
 * a pergunta é "onde está isso?", e a resposta pode ser um curso ou uma aula
 * específica. Quem procura "cloro" quase nunca quer o curso inteiro — quer a
 * aula que fala de cloro.
 *
 * Só entra o que a pessoa pode ver. O recorte de permissão é feito por quem
 * chama, passando apenas os cursos visíveis: filtrar aqui exigiria trazer o
 * ator para dentro do domínio de catálogo, e é a camada de dados que já sabe
 * disso.
 */

import { normalizeForSearch } from "./catalog.ts";
import type { Course } from "./types.ts";

export type SearchKind = "course" | "lesson";

export interface SearchHit {
  kind: SearchKind;
  /** Para curso, o slug; para aula, o id — é o que a URL de cada um usa. */
  id: string;
  title: string;
  /** Onde o resultado vive, para a pessoa se situar. Ex.: "Segurança · Injeção de SQL". */
  context: string;
  href: string;
  /** Quanto o resultado casa com o termo. Maior aparece primeiro. */
  score: number;
}

/**
 * Pontuação de um texto contra os termos buscados.
 *
 * Devolve 0 quando algum termo não aparece — busca com dois termos que só
 * casa um não é resultado, é ruído.
 *
 * Título vale mais que resumo, e começar com o termo vale mais que contê-lo
 * no meio: quem digita "seguranca" espera "Segurança em Operações de Campo"
 * antes de um curso que menciona segurança na terceira linha do resumo.
 */
function score(haystack: string, terms: string[], weight: number): number {
  const text = normalizeForSearch(haystack);
  let total = 0;

  for (const term of terms) {
    const at = text.indexOf(term);
    if (at === -1) return 0;
    total += weight + (at === 0 ? weight : 0);
  }

  return total;
}

/**
 * Procura em cursos e aulas.
 *
 * @param limit corta a lista. A busca do topo mostra poucos resultados e um
 * link para ver todos — uma lista de quarenta itens num painel suspenso não
 * ajuda ninguém.
 */
export function searchCourses(courses: Course[], search: string, limit = 8): SearchHit[] {
  const terms = normalizeForSearch(search).split(" ").filter(Boolean);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const course of courses) {
    const courseScore =
      score(course.title, terms, 10) || score(`${course.title} ${course.summary}`, terms, 3);

    if (courseScore > 0) {
      hits.push({
        kind: "course",
        id: course.slug,
        title: course.title,
        context: `${course.modules.length} ${course.modules.length === 1 ? "módulo" : "módulos"}`,
        href: `/cursos/${course.slug}`,
        score: courseScore,
      });
    }

    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        const lessonScore = score(lesson.title, terms, 6);
        if (lessonScore === 0) continue;

        hits.push({
          kind: "lesson",
          id: lesson.id,
          title: lesson.title,
          context: `${course.title} · ${module.title}`,
          href: `/aulas/${lesson.id}`,
          score: lessonScore,
        });
      }
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, limit);
}
