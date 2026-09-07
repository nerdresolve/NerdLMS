import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import { accessedWithin, lastDays } from "@nerdlms/core/courses/active-users.ts";
import type { User } from "@nerdlms/core/courses/types.ts";
import { reportFilename, toCsv, UTF8_BOM } from "@nerdlms/core/reports/csv.ts";

import { currentGrades, type GradeEntry } from "@nerdlms/core/assessment/gradebook.ts";

import { findAllCourses, findEnrollments } from "../courses/courses-repository.ts";
import { findGradesForExport } from "./grades-report-repository.ts";
import { findAllUsers } from "../courses/users-directory.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Exportação de relatórios.
 *
 * Cada relatório respeita o recorte de quem pede: o gestor exporta o próprio
 * projeto, o admin exporta a plataforma. Sem isso, a exportação viraria a porta
 * dos fundos que a tela fecha.
 *
 * A exportação é auditada. É ação sensível pela definição do domínio — quem
 * leva dados para fora precisa deixar rastro.
 */

export type ReportKind = "progresso" | "usuarios" | "notas" | "cursos";

export interface ExportCommand {
  actor: Actor;
  actorName: string;
  kind: ReportKind;
  /** Recortes opcionais. Ausentes, o relatório sai completo. */
  filtros?: ReportFilters;
}

export interface ReportFilters {
  /** Só quem acessou nos últimos N dias. */
  ativosEmDias?: number;
  /** Um projeto específico, dentro do que o papel já pode ver. */
  projeto?: string;
  /** Só as linhas de curso concluído. Vale para o relatório de progresso. */
  somenteConcluidos?: boolean;
}

export type ExportOutcome =
  | { status: 200; csv: string; filename: string }
  | { status: 403; error: string };

export async function exportUseCase(command: ExportCommand): Promise<ExportOutcome> {
  const scope = scopeOf(command.actor);
  if (!scope) {
    return { status: 403, error: "Sem permissão para exportar relatórios." };
  }

  /* O filtro de projeto não amplia o que o papel enxerga: ele estreita. Um
     gestor que pedir outro projeto continua vendo o próprio, porque `scope`
     é decidido pela permissão e vem antes. */
  const filtros = command.filtros ?? {};
  const recorte: Scope = scope.project
    ? scope
    : filtros.projeto
      ? { project: filtros.projeto }
      : scope;

  /* Sem tenant não há relatório: exportar sem recorte devolveria dado de
     todos os clientes num CSV. */
  if (!command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para exportar relatórios." };
  }

  const csv = await gerarRelatorio(command.kind, command.actor.tenantId, recorte, filtros);

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "report_exported",
    target: [
      command.kind,
      recorte.project ?? "plataforma",
      ...(filtros.ativosEmDias ? [`ativos em ${filtros.ativosEmDias}d`] : []),
      ...(filtros.somenteConcluidos ? ["só concluídos"] : []),
    ].join(" · "),
    outcome: "allowed",
  });

  return {
    status: 200,
    csv: UTF8_BOM + csv,
    filename: reportFilename(command.kind, new Date().toISOString()),
  };
}

interface Scope {
  /** Ausente para o admin: ele enxerga a plataforma inteira. */
  project?: string;
}

/** Descobre o recorte permitido, ou `null` quando o papel não exporta. */
function scopeOf(actor: Actor): Scope | null {
  if (can(actor, "read", { kind: "analytics", scope: "platform" })) return {};

  if (actor.project && can(actor, "read", { kind: "analytics", scope: "project", project: actor.project })) {
    return { project: actor.project };
  }

  return null;
}

async function progressReport(
  tenantId: string,
  scope: Scope,
  filtros: ReportFilters = {},
): Promise<string> {
  const [courses, enrollments, users] = await Promise.all([
    findAllCourses(tenantId),
    findEnrollments(),
    findAllUsers(tenantId),
  ]);

  const visible = aplicarFiltrosDePessoa(users, scope, filtros);
  const ids = new Set(visible.map((user) => user.id));
  const byId = new Map(visible.map((user) => [user.id, user]));
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const rows = enrollments
    .filter((enrollment) => ids.has(enrollment.learnerId))
    .flatMap((enrollment) => {
      const course = courseById.get(enrollment.courseId);
      const user = byId.get(enrollment.learnerId);
      if (!course || !user) return [];

      const summary = courseProgress(course, enrollment);
      if (filtros.somenteConcluidos && summary.status !== "completed") return [];
      return [
        [
          user.fullName,
          user.email ?? "",
          user.project ?? "",
          course.title,
          summary.completed,
          summary.total,
          `${summary.percent}%`,
          STATUS_LABEL[summary.status],
        ],
      ];
    });

  return toCsv(
    ["Aluno", "E-mail", "Projeto", "Curso", "Aulas concluídas", "Total de aulas", "Progresso", "Situação"],
    rows,
  );
}

/**
 * Aplica o recorte de pessoas comum aos dois relatórios.
 *
 * O escopo do papel vem primeiro e não é negociável; os filtros só estreitam
 * o que já era visível.
 */
function aplicarFiltrosDePessoa(users: User[], scope: Scope, filtros: ReportFilters): User[] {
  let visible = scope.project ? users.filter((user) => user.project === scope.project) : users;

  if (filtros.ativosEmDias && filtros.ativosEmDias > 0) {
    const periodo = lastDays(filtros.ativosEmDias, new Date());
    visible = visible.filter((user) => accessedWithin(user, periodo));
  }

  return visible;
}

const STATUS_LABEL = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
} as const;

const ROLE_LABEL = {
  learner: "Aluno",
  manager: "Gestor",
  instructor: "Instrutor",
  admin: "Administrador",
} as const;

async function usersReport(
  tenantId: string,
  scope: Scope,
  filtros: ReportFilters = {},
): Promise<string> {
  const users = await findAllUsers(tenantId);
  const visible = aplicarFiltrosDePessoa(users, scope, filtros);

  const rows = visible.map((user) => [
    user.fullName,
    user.email ?? "",
    ROLE_LABEL[user.role],
    user.project ?? "",
    user.region ?? "",
    user.status === "active" ? "Ativo" : user.status === "pending" ? "Pendente" : "Inativo",
    user.lastAccessAt ? user.lastAccessAt.slice(0, 10) : "nunca acessou",
  ]);

  return toCsv(
    ["Nome", "E-mail", "Papel", "Projeto", "Região", "Situação", "Último acesso"],
    rows,
  );
}

/** Escolhe o relatório. Um lugar só, para o `switch` não se espalhar. */
async function gerarRelatorio(
  kind: ReportKind,
  tenantId: string,
  recorte: Scope,
  filtros: ReportFilters,
): Promise<string> {
  switch (kind) {
    case "usuarios":
      return usersReport(tenantId, recorte, filtros);
    case "notas":
      return gradesReport(tenantId, recorte, filtros);
    case "cursos":
      return coursesReport(tenantId, recorte);
    default:
      return progressReport(tenantId, recorte, filtros);
  }
}

/**
 * Livro de notas — guia §24, "exportar notas".
 *
 * Uma linha por atividade avaliada, com a NOTA VIGENTE. `grade_entries` é
 * append-only: exportar todos os lançamentos mostraria a nota antes e depois de
 * uma revisão, e quem abrisse a planilha somaria as duas.
 *
 * A nota anterior não some do produto — ela continua em `grade_entries` e na
 * tela de histórico. O que esta planilha responde é "quanto cada um tem
 * hoje", e para isso a revisada é a única resposta certa.
 */
async function gradesReport(
  tenantId: string,
  scope: Scope,
  filtros: ReportFilters = {},
): Promise<string> {
  const [lancamentos, users] = await Promise.all([
    findGradesForExport(tenantId),
    findAllUsers(tenantId),
  ]);

  const visible = aplicarFiltrosDePessoa(users, scope, filtros);
  const ids = new Set(visible.map((user) => user.id));

  /* As notas vigentes são apuradas POR MATRÍCULA — por aluno E curso. Apurar
     por aluno misturaria atividades de cursos diferentes, e duas provas com o
     mesmo id nunca acontecem, mas dois cursos do mesmo aluno sim. */
  const porMatricula = new Map<string, typeof lancamentos>();

  for (const linha of lancamentos) {
    if (!ids.has(linha.learnerId)) continue;

    const chave = `${linha.learnerId}|${linha.courseId}`;
    const atual = porMatricula.get(chave);
    if (atual) atual.push(linha);
    else porMatricula.set(chave, [linha]);
  }

  const rows: Array<Array<unknown>> = [];

  for (const doAluno of porMatricula.values()) {
    /* `currentGrades` é a MESMA função que a tela usa para decidir qual
       lançamento vale. Reimplementar a regra aqui faria a planilha e a tela
       discordarem sobre a nota de alguém. */
    const entradas: GradeEntry[] = doAluno.map((linha) => ({
      id: `${linha.activityId}|${linha.createdAt}`,
      activityId: linha.activityId,
      activityKind: linha.activityKind,
      pointsEarned: linha.pointsEarned,
      pointsPossible: linha.pointsPossible,
      weight: linha.weight,
      createdAt: linha.createdAt,
      ...(linha.reason ? { reason: linha.reason } : {}),
    }));

    const vigentes = new Set(currentGrades(entradas).map((e) => `${e.activityId}|${e.createdAt}`));

    for (const linha of doAluno) {
      if (!vigentes.has(`${linha.activityId}|${linha.createdAt}`)) continue;

      const percentual =
        linha.pointsPossible > 0
          ? Math.round((linha.pointsEarned / linha.pointsPossible) * 10000) / 100
          : 0;

      rows.push([
        linha.learnerName,
        linha.learnerEmail ?? "",
        linha.project ?? "",
        linha.courseTitle,
        linha.activityKind === "quiz" ? "Prova" : "Trabalho",
        linha.activityTitle,
        linha.pointsEarned,
        linha.pointsPossible,
        `${percentual}%`,
        linha.weight,
        linha.createdAt.slice(0, 10),
        linha.gradedByName ?? "",
        /* O motivo só existe quando a nota foi revisada. É o que explica, na
           planilha, por que aquela nota não é a que alguém lembrava. */
        linha.reason ?? "",
      ]);
    }
  }

  return toCsv(
    [
      "Aluno",
      "E-mail",
      "Projeto",
      "Curso",
      "Tipo",
      "Atividade",
      "Pontos",
      "Total",
      "Percentual",
      "Peso",
      "Data",
      "Avaliado por",
      "Motivo da revisão",
    ],
    rows,
  );
}

/**
 * Catálogo de cursos — guia §24, "exportar cursos".
 *
 * O que a planilha responde é "o que existe e como está", não o conteúdo aula
 * a aula: exportar o conteúdo é fazer BACKUP do curso, que é o F5-06 e tem
 * outro formato. Aqui é o catálogo com os números que a coordenação acompanha.
 *
 * Não aceita filtro de pessoa: curso não tem projeto — quem tem é o aluno. O
 * recorte que vale é o do tenant, aplicado na consulta.
 */
async function coursesReport(tenantId: string, _scope: Scope): Promise<string> {
  const [courses, enrollments] = await Promise.all([
    findAllCourses(tenantId),
    findEnrollments(),
  ]);

  /* Matrículas por curso, contadas uma vez — sem isto seria uma varredura da
     lista inteira por curso. */
  const matriculasPorCurso = new Map<string, number>();
  const concluidosPorCurso = new Map<string, number>();
  const courseById = new Map(courses.map((course) => [course.id, course]));

  for (const enrollment of enrollments) {
    const course = courseById.get(enrollment.courseId);
    if (!course) continue;

    matriculasPorCurso.set(course.id, (matriculasPorCurso.get(course.id) ?? 0) + 1);

    if (courseProgress(course, enrollment).status === "completed") {
      concluidosPorCurso.set(course.id, (concluidosPorCurso.get(course.id) ?? 0) + 1);
    }
  }

  const rows = courses.map((course) => {
    const aulas = course.modules.reduce((soma, modulo) => soma + modulo.lessons.length, 0);
    const matriculados = matriculasPorCurso.get(course.id) ?? 0;
    const concluidos = concluidosPorCurso.get(course.id) ?? 0;

    return [
      course.title,
      course.code ?? "",
      course.category?.name ?? "",
      COURSE_STATUS_LABEL[course.status],
      course.level ?? "",
      course.modules.length,
      aulas,
      course.workloadMinutes ?? "",
      matriculados,
      concluidos,
      /* Percentual de conclusão calculado aqui e não na planilha: quem abre no
         Excel não deveria precisar montar a fórmula para ler o número que a
         coordenação pede. Curso sem ninguém matriculado é 0%, não divisão por
         zero. */
      matriculados > 0 ? `${Math.round((concluidos / matriculados) * 100)}%` : "0%",
    ];
  });

  return toCsv(
    [
      "Curso",
      "Código",
      "Categoria",
      "Situação",
      "Nível",
      "Módulos",
      "Aulas",
      "Carga (min)",
      "Matriculados",
      "Concluíram",
      "Conclusão",
    ],
    rows,
  );
}

const COURSE_STATUS_LABEL = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
} as const;
