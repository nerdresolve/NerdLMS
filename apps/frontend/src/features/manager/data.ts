import "server-only";

import { notFound } from "next/navigation";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { findAllUsers } from "@nerdlms/backend/courses/users-directory.ts";
import { findClasses } from "@nerdlms/backend/courses/class-repository.ts";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { activeUsers, lastDays } from "@nerdlms/core/courses/active-users.ts";
import { courseEngagement, engagementSummary } from "@nerdlms/core/courses/engagement.ts";
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import type { Course, Enrollment, User } from "@nerdlms/core/courses/types.ts";

/**
 * Camada de dados do gestor.
 *
 * O recorte é o **projeto**, não a autoria: um gestor responde por Siririzinho
 * inteiro, incluindo cursos escritos por outra pessoa. É por isso que o papel
 * existe separado de instrutor (DEC-038).
 *
 * O filtro por projeto acontece aqui, antes de qualquer agregação. Calcular
 * sobre a base inteira e recortar depois vazaria números de outros projetos
 * nos totais.
 */

/** Uma pessoa da equipe, com o que a tela de equipe mostra. */
export interface TeamMember {
  user: User;
  enrollments: number;
  completed: number;
  averagePercent: number;
}

export interface ManagerPageData {
  manager: User;
  project: string;
  team: TeamMember[];
  stats: { people: number; active30d: number; enrollments: number; completions: number };
  courses: Array<{ course: Course; learners: number; averagePercent: number; completed: number }>;
}

/** Projeto do gestor, e o erro claro quando ele não tem um. */
async function requireManager() {
  const user = await requireUser();
  const project = user.project;

  /* Gestor sem projeto enxergaria tudo ou nada, e as duas opções são erradas —
     é a razão do CHECK `users_manager_needs_project` no schema. */
  if (!project) {
    notFound();
  }

  /* Quem não tem o papel recebe 404, não erro: um `throw` aqui chegava à tela
     como "Application error: a server-side exception has occurred". Além de
     feio, confirmava que a rota existe — `notFound()` dá o mesmo tratamento
     que as camadas de curso e aula já davam a recurso alheio. */
  if (!can(actorOf(user), "read", { kind: "analytics", scope: "project", project })) {
    notFound();
  }

  return { user, project };
}

/* `tenantId` explícito: esta função não tem sessão em escopo, e herdar o
   recorte de uma variável de fora seria justamente o tipo de acoplamento que
   deixa passar consulta sem tenant. */
async function teamOf(tenantId: string, project: string): Promise<User[]> {
  const allUsers = await findAllUsers(tenantId);
  return allUsers.filter((person) => person.project === project && person.role === "learner");
}

/** Painel do gestor: os números do projeto e o desempenho por curso. */
export async function getManagerPageData(): Promise<ManagerPageData> {
  const { user, project } = await requireManager();

  const [team, allEnrollments, allCourses] = await Promise.all([
    teamOf(user.tenant.id, project),
    findEnrollments(),
    findAllCourses(user.tenant.id),
  ]);
  const teamIds = new Set(team.map((person) => person.id));
  const teamEnrollments = allEnrollments.filter((item) => teamIds.has(item.learnerId));

  /* Só cursos em que alguém da equipe está matriculado: o catálogo inteiro
     encheria a tabela de linhas zeradas que não dizem nada ao gestor. */
  const courseIds = new Set(teamEnrollments.map((item) => item.courseId));
  const relevant = allCourses.filter((course) => courseIds.has(course.id));

  const summary = engagementSummary(relevant, teamEnrollments);
  const active = activeUsers(team, lastDays(30, new Date()));

  return {
    manager: toDisplayUser(user),
    project,
    team: team.map((person) => memberOf(person, teamEnrollments, allCourses)),
    stats: {
      people: team.length,
      active30d: active.active,
      enrollments: teamEnrollments.length,
      completions: summary.completions,
    },
    courses: relevant.map((course) => {
      const engagement = courseEngagement(course, teamEnrollments);
      return {
        course,
        learners: engagement.learners,
        averagePercent: engagement.averagePercent,
        completed: engagement.completed,
      };
    }),
  };
}

/** Agrega o progresso de uma pessoa nos cursos em que ela está matriculada. */
function memberOf(person: User, enrollments: Enrollment[], allCourses: Course[]): TeamMember {
  const mine = enrollments.filter((item) => item.learnerId === person.id);
  const summaries = mine.flatMap((enrollment) => {
    const course = allCourses.find((item) => item.id === enrollment.courseId);
    return course ? [courseProgress(course, enrollment)] : [];
  });

  const completed = summaries.filter((summary) => summary.status === "completed").length;
  const averagePercent =
    summaries.length === 0
      ? 0
      : Math.round(summaries.reduce((total, summary) => total + summary.percent, 0) / summaries.length);

  return { user: person, enrollments: mine.length, completed, averagePercent };
}

export interface TeamPageData {
  manager: User;
  project: string;
  team: TeamMember[];
  /** Cursos que o gestor pode atribuir à equipe (F1-03). */
  courses: Course[];
  /** Turmas abertas de cada curso (F2-02). */
  classesByCourse: Record<string, { id: string; name: string }[]>;
}

/** Lista da equipe, pessoa a pessoa. */
export async function getTeamPageData(): Promise<TeamPageData> {
  const { user, project } = await requireManager();

  const [team, allEnrollments, allCourses] = await Promise.all([
    teamOf(user.tenant.id, project),
    findEnrollments(),
    findAllCourses(user.tenant.id),
  ]);
  const teamIds = new Set(team.map((person) => person.id));
  const teamEnrollments = allEnrollments.filter((item) => teamIds.has(item.learnerId));
  const publicados = allCourses.filter((course) => course.status === "published");

  return {
    manager: toDisplayUser(user),
    project,
    team: team.map((person) => memberOf(person, teamEnrollments, allCourses)),
    /* Só publicados: rascunho pode estar incompleto e arquivado sumiria do
       painel de quem fosse inscrito. É a mesma regra que `canAssignEnrollment`
       aplica no servidor — aqui ela só evita oferecer o que seria recusado. */
    courses: publicados,
    /* Só as turmas ABERTAS: oferecer uma turma fechada levaria o gestor a
       montar a seleção inteira para ser recusado no envio. */
    classesByCourse: Object.fromEntries(
      await Promise.all(
        publicados.map(async (course) => [
          course.id,
          (await findClasses(course.id))
            .filter((turma) => turma.status === "open")
            .map((turma) => ({ id: turma.id, name: turma.name })),
        ]),
      ),
    ),
  };
}
