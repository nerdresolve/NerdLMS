import "server-only";

import { notFound } from "next/navigation";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { findAllUsers } from "@nerdlms/backend/courses/users-directory.ts";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { findCategoryOptions } from "@nerdlms/backend/courses/category-repository.ts";
import { findClasses } from "@nerdlms/backend/courses/class-repository.ts";
import type { CourseClass } from "@nerdlms/core/courses/classes.ts";
import { actorOf } from "@/lib/auth/session.ts";
import {
  courseEngagement,
  engagementSummary,
  learnerRows,
  type CourseEngagement,
  type EngagementSummary,
  type LearnerRow,
} from "@nerdlms/core/courses/engagement.ts";
import { courseDurationSeconds } from "@nerdlms/core/courses/progress.ts";
import type { Course, User } from "@nerdlms/core/courses/types.ts";

/**
 * Camada de dados do instrutor.
 *
 * A regra que atravessa as três telas: **o instrutor só enxerga o que é dele.**
 * O recorte por autoria acontece aqui, uma vez, em vez de em cada tela — e
 * `can()` confirma o papel antes de qualquer coisa, porque filtrar sem
 * autorizar deixaria um aluno ver a lista só trocando a URL.
 */

export interface AuthoredCourse {
  course: Course;
  lessons: number;
  durationSeconds: number;
  engagement: CourseEngagement;
}

export interface StudioPageData {
  instructor: User;
  courses: AuthoredCourse[];
}

/** Cursos de autoria do instrutor, com os números que a lista mostra. */
export async function getStudioPageData(): Promise<StudioPageData> {
  const user = await requireUser();
  /* O id da sessão É o id do banco: a autoria bate direto, sem tradução. */
  const authorId = user.id;

  /* Autorização antes de dados: sem isto, um aluno que digitasse /instrutor
     receberia a lista vazia em vez de um "não existe". */
  /* Quem não tem o papel recebe 404, não erro: um `throw` aqui chegava à tela
     como "Application error: a server-side exception has occurred". Além de
     feio, confirmava que a rota existe — `notFound()` dá o mesmo tratamento
     que as camadas de curso e aula já davam a recurso alheio. */
  if (!can(actorOf(user), "create", { kind: "course", authorId, status: "draft" })) {
    notFound();
  }

  const [allCourses, allEnrollments] = await Promise.all([findAllCourses(user.tenant.id), findEnrollments()]);
  const authored = allCourses.filter((course) => course.authorId === authorId);

  return {
    instructor: toDisplayUser(user),
    courses: authored.map((course) => ({
      course,
      lessons: course.modules.reduce((total, module) => total + module.lessons.length, 0),
      durationSeconds: courseDurationSeconds(course),
      engagement: courseEngagement(course, allEnrollments),
    })),
  };
}

/**
 * Uma linha da tabela de alunos, já com os nomes resolvidos.
 *
 * `LearnerRow` do domínio carrega ids, que é o certo — regra de negócio não
 * precisa saber como alguém se chama. A tradução para nome acontece aqui, na
 * fronteira, junto com a busca no repositório.
 */
export interface LearnerRowView extends LearnerRow {
  learnerName: string;
  courseTitle: string;
}

export interface EngagementPageData {
  instructor: User;
  summary: EngagementSummary;
  learners: LearnerRowView[];
  courses: Array<{ course: Course; engagement: CourseEngagement }>;
}

/** Engajamento agregado dos cursos do instrutor, e a lista de alunos. */
export async function getEngagementPageData(): Promise<EngagementPageData> {
  const user = await requireUser();
  /* O id da sessão É o id do banco: a autoria bate direto, sem tradução. */
  const authorId = user.id;

  if (!can(actorOf(user), "read", { kind: "analytics", scope: "course", courseAuthorId: authorId })) {
    notFound();
  }

  const [allCourses, allEnrollments, allUsers] = await Promise.all([
    findAllCourses(user.tenant.id),
    findEnrollments(),
    findAllUsers(user.tenant.id),
  ]);
  const authored = allCourses.filter((course) => course.authorId === authorId);

  const nameById = new Map(allUsers.map((person) => [person.id, person.fullName]));
  const titleById = new Map(authored.map((course) => [course.id, course.title]));

  return {
    instructor: toDisplayUser(user),
    summary: engagementSummary(authored, allEnrollments),
    learners: learnerRows(authored, allEnrollments).map((row) => ({
      ...row,
      /* Um aluno que saiu da base não some da tabela: o progresso dele continua
         contando, e uma linha sem nome é melhor que uma linha ausente. */
      learnerName: nameById.get(row.learnerId) ?? "Usuário removido",
      courseTitle: titleById.get(row.courseId) ?? "Curso removido",
    })),
    courses: authored.map((course) => ({
      course,
      engagement: courseEngagement(course, allEnrollments),
    })),
  };
}

export interface EditorPageData {
  instructor: User;
  course: Course;
  lessons: number;
  durationSeconds: number;
  /** Categorias do tenant, para o painel de metadados escolher. */
  categories: { id: string; name: string; parentName: string | null }[];
  classes: CourseClass[];
  instructors: { id: string; name: string }[];
}

/**
 * Curso aberto no editor.
 *
 * Devolve `null` quando o curso não existe **ou** não é do instrutor — a mesma
 * resposta nos dois casos, para que um curso alheio não possa ser distinguido
 * de um inexistente.
 */
export async function getEditorPageData(courseId: string): Promise<EditorPageData | null> {
  const user = await requireUser();

  const allCourses = await findAllCourses(user.tenant.id);
  const course = allCourses.find((item) => item.id === courseId);
  if (!course) return null;

  const status = course.status === "published" ? "published" : "draft";
  if (!can(actorOf(user), "update", { kind: "course", authorId: course.authorId, status })) {
    return null;
  }

  return {
    instructor: toDisplayUser(user),
    course,
    lessons: course.modules.reduce((total, module) => total + module.lessons.length, 0),
    durationSeconds: courseDurationSeconds(course),
    /* Depois da permissão: a lista de categorias do tenant não deve sair para
       quem nem pode abrir o curso. */
    categories: await findCategoryOptions(user.tenant.id),
    classes: await findClasses(courseId),
    /* Quem pode conduzir turma: instrutor ou admin do mesmo cliente. */
    instructors: (await findAllUsers(user.tenant.id))
      .filter((pessoa) => pessoa.role === "instructor" || pessoa.role === "admin")
      .map((pessoa) => ({ id: pessoa.id, name: pessoa.fullName })),
  };
}
