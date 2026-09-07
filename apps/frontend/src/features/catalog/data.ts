import "server-only";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { estadoDasProvas } from "@nerdlms/backend/assessment/retake-repository.ts";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import { toCatalogEntries, toLibraryEntries, type CatalogEntry, type LibraryEntry } from "@nerdlms/core/courses/catalog.ts";
import type { User } from "@nerdlms/core/courses/types.ts";

export interface CatalogPageData {
  student: User;
  entries: CatalogEntry[];
}

export interface LibraryPageData {
  /** Assuntos com curso visível, para o seletor. */
  categories: { slug: string; name: string; parentName?: string }[];
  student: User;
  entries: LibraryEntry[];
}

/**
 * Camada de dados do catálogo. Só devolve cursos em que o aluno está
 * matriculado — `toCatalogEntries` descarta curso sem matrícula, e a
 * verificação passa a ser feita no banco na TASK-006.
 */
export async function getCatalogPageData(): Promise<CatalogPageData> {
  const user = await requireUser();
  const [courses, mine, provas] = await Promise.all([
    findAllCourses(user.tenant.id),
    findEnrollments(user.id),
    /* A melhor nota por curso. Sem ela, "Concluídos" saía das AULAS e listava
       curso cuja prova não foi feita — o aluno via o curso entre os concluídos
       e o certificado era recusado. */
    estadoDasProvas(user.id),
  ]);

  const notas = new Map(
    [...provas.entries()].map(([courseId, estado]) => [courseId, estado.melhorPercentual]),
  );

  /* Curso arquivado não entra: foi retirado de circulação, e continuar
     oferecendo o que foi retirado é a mesma incoerência de outro ângulo. */
  const emCirculacao = courses.filter((course) => course.status !== "archived");

  return {
    student: toDisplayUser(user),
    entries: toCatalogEntries(emCirculacao, mine, notas),
  };
}

/**
 * Camada de dados da biblioteca (`/cursos`).
 *
 * Diferença para `getCatalogPageData`: aqui entra o **catálogo inteiro**, não só
 * o que o aluno já cursa. É a tela de descobrir curso novo, então um curso sem
 * matrícula precisa aparecer — com progresso zerado e sem botão de retomar.
 *
 * Só cursos publicados: rascunho é do instrutor que o escreve, e aparecer aqui
 * exporia conteúdo inacabado a todo mundo.
 */
export async function getLibraryPageData(): Promise<LibraryPageData> {
  const user = await requireUser();
  const [allCourses, mine] = await Promise.all([
    findAllCourses(user.tenant.id),
    findEnrollments(user.id),
  ]);
  const published = allCourses.filter((course) => course.status === "published");
  const entries = toLibraryEntries(published, mine);

  /* As categorias saem dos PRÓPRIOS cursos visíveis, com o slug que veio do
     banco. Duas razões para não consultar a tabela de categorias aqui:

     - oferecer um assunto que leva a uma lista vazia é pior que não oferecer:
       o aluno conclui que a busca quebrou, não que a categoria está vazia;
     - o slug precisa ser o gravado. Derivá-lo do nome erraria em categoria
       renomeada depois de criada. */
  const porSlug = new Map<string, { slug: string; name: string; parentName?: string }>();

  for (const entry of entries) {
    const cat = entry.course.category;
    if (!cat || porSlug.has(cat.slug)) continue;

    porSlug.set(cat.slug, {
      slug: cat.slug,
      name: cat.name,
      ...(cat.parentName ? { parentName: cat.parentName } : {}),
    });
  }

  return {
    student: toDisplayUser(user),
    entries,
    categories: [...porSlug.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
