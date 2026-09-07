import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  levelsByCompetency,
  planProgress,
  type PlanProgress,
} from "@nerdlms/core/competencies/proficiency.ts";

import {
  assignPlan,
  competenciesGrantedByCourse,
  createCompetency,
  createFramework,
  createPlan,
  findCompetencies,
  findEvidenceOf,
  findFrameworks,
  findPlans,
  linkCompetencyToCourse,
  plansOfUser,
  recordEvidence,
  revokeEvidence,
  unlinkCompetencyFromCourse,
  type CompetencyRow,
  type EvidenceRow,
  type FrameworkRow,
  type PlanRow,
} from "./competency-repository.ts";
import { notify } from "../notifications/notify.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Competências e planos de desenvolvimento — F6-02 (guia §20).
 *
 * Quem CONFIGURA competência: admin e instrutor — é desenho de currículo, e
 * quem responde pelo conteúdo responde por ele.
 *
 * Quem ATESTA competência à mão: admin, instrutor e GESTOR. O gestor entra aqui
 * e não na configuração porque é ele quem vê a pessoa trabalhando: "fulano
 * opera a ETA" é observação de quem acompanha, não de quem escreveu o curso.
 */

function podeConfigurar(actor: Actor): boolean {
  return actor.role === "admin" || actor.role === "instructor";
}

function podeAtestar(actor: Actor): boolean {
  return podeConfigurar(actor) || actor.role === "manager";
}

export interface CompetencyCatalog {
  frameworks: FrameworkRow[];
  competencies: CompetencyRow[];
  plans: PlanRow[];
}

export async function listCatalog(
  actor: Actor,
): Promise<{ status: 200; catalog: CompetencyCatalog } | { status: 403; error: string }> {
  if (!podeConfigurar(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão." };
  }

  const [frameworks, competencies, plans] = await Promise.all([
    findFrameworks(actor.tenantId),
    findCompetencies(actor.tenantId),
    findPlans(actor.tenantId),
  ]);

  return { status: 200, catalog: { frameworks, competencies, plans } };
}

export interface FrameworkCommand {
  actor: Actor;
  actorName: string;
  name: string;
  description: string | null;
  levels: string[];
}

export type CreateOutcome =
  | { status: 201; id: string }
  | { status: 400 | 403; error: string };

export async function createFrameworkUseCase(
  command: FrameworkCommand,
): Promise<CreateOutcome> {
  if (!podeConfigurar(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para criar frameworks." };
  }

  const niveis = command.levels.map((n) => n.trim()).filter((n) => n !== "");

  if (command.name.trim() === "") {
    return { status: 400, error: "Dê um nome ao framework." };
  }

  if (niveis.length < 2) {
    /* Uma escala de um degrau não é escala: tudo seria "tem" ou "não tem", e a
       coluna `grants_level` dos vínculos não teria uso. */
    return { status: 400, error: "Informe pelo menos dois níveis de domínio." };
  }

  const id = await createFramework({
    tenantId: command.actor.tenantId,
    name: command.name,
    description: command.description,
    levels: niveis,
  });

  if (!id) return { status: 400, error: "Já existe um framework com esse nome." };

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "competency_configured",
    target: `framework ${command.name}`,
    outcome: "allowed",
  });

  return { status: 201, id };
}

export interface CompetencyCommand {
  actor: Actor;
  actorName: string;
  frameworkId: string;
  parentId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  learningOutcome: string | null;
}

export async function createCompetencyUseCase(
  command: CompetencyCommand,
): Promise<CreateOutcome> {
  if (!podeConfigurar(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para criar competências." };
  }

  if (command.name.trim() === "") {
    return { status: 400, error: "Dê um nome à competência." };
  }

  const id = await createCompetency({
    tenantId: command.actor.tenantId,
    frameworkId: command.frameworkId,
    parentId: command.parentId,
    code: command.code,
    name: command.name,
    description: command.description,
    learningOutcome: command.learningOutcome,
  });

  if (!id) {
    /* Duas causas possíveis, e a mensagem cobre as duas sem afirmar a errada:
       nome repetido, ou framework que não é deste cliente. */
    return {
      status: 400,
      error: "Já existe uma competência com esse nome, ou o framework não foi encontrado.",
    };
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "competency_configured",
    target: command.name,
    outcome: "allowed",
  });

  return { status: 201, id };
}

export async function linkCourseUseCase(
  actor: Actor,
  actorName: string,
  competencyId: string,
  courseId: string,
  grantsLevel: number,
  ligar: boolean,
): Promise<{ status: 200 | 400 | 403; error?: string }> {
  if (!podeConfigurar(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão." };
  }

  const ok = ligar
    ? await linkCompetencyToCourse(actor.tenantId, competencyId, courseId, grantsLevel)
    : await unlinkCompetencyFromCourse(actor.tenantId, competencyId, courseId);

  if (!ok) {
    return {
      status: 400,
      error: ligar
        ? "Este curso já desenvolve esta competência, ou um dos dois não foi encontrado."
        : "Vínculo não encontrado.",
    };
  }

  await recordAudit({
    actorId: actor.id,
    actorName,
    action: "competency_configured",
    target: `${ligar ? "vinculou" : "desvinculou"} curso e competência`,
    outcome: "allowed",
  });

  return { status: 200 };
}

/**
 * Registra as evidências que concluir um curso gera.
 *
 * Chamada quando o curso é concluído. **Nunca lança**: uma competência que
 * falha não pode impedir a conclusão que a gerou — mesma regra de `notify`,
 * `recordAudit`, `dispatchWebhook` e `evaluateBadges`.
 */
export async function grantCompetenciesForCourse(
  userId: string,
  tenantId: string,
  courseId: string,
): Promise<number> {
  let registradas = 0;

  try {
    const vinculos = await competenciesGrantedByCourse(tenantId, courseId);
    if (vinculos.length === 0) return 0;

    for (const vinculo of vinculos) {
      const id = await recordEvidence({
        tenantId,
        competencyId: vinculo.competencyId,
        userId,
        level: vinculo.grantsLevel,
        source: "course",
        courseId,
        /* Sem vencimento por padrão: quem define validade de competência é
           quem a configura, e a coluna existe para evidência manual e para
           reciclagem — não para toda conclusão de curso. */
        expiresAt: null,
      });

      if (id) registradas += 1;
    }
  } catch (erro) {
    console.error("[competencias] falha ao registrar evidência:", erro);
  }

  return registradas;
}

export interface AttestCommand {
  actor: Actor;
  actorName: string;
  competencyId: string;
  userId: string;
  level: number;
  note: string;
  /** Meses de validade. Nulo é sem prazo. */
  validityMonths: number | null;
  /** `external` quando a formação veio de fora da plataforma. */
  external: boolean;
}

export type AttestOutcome =
  | { status: 201; id: string }
  | { status: 400 | 403; error: string };

/**
 * Atesta uma competência à mão — a "evidência" do §20.
 *
 * O que torna isto sério: a afirmação "fulano sabe operar uma ETA" pode mandar
 * alguém para um campo onde a falta dessa competência machuca. Por isso a
 * justificativa é OBRIGATÓRIA, o banco a exige, e quem atestou fica registrado.
 */
export async function attestUseCase(command: AttestCommand): Promise<AttestOutcome> {
  if (!podeAtestar(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para atestar competências." };
  }

  if (command.note.trim() === "") {
    return {
      status: 400,
      error: "Diga em que você se baseia. Uma competência atestada sem justificativa não se sustenta numa auditoria.",
    };
  }

  if (!Number.isInteger(command.level) || command.level < 1) {
    return { status: 400, error: "Nível inválido." };
  }

  let expiresAt: Date | null = null;
  if (command.validityMonths !== null && command.validityMonths > 0) {
    expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + command.validityMonths);
  }

  const id = await recordEvidence({
    tenantId: command.actor.tenantId,
    competencyId: command.competencyId,
    userId: command.userId,
    level: command.level,
    source: command.external ? "external" : "manual",
    note: command.note,
    attestedBy: command.actor.id,
    expiresAt,
  });

  if (!id) return { status: 400, error: "Competência não encontrada ou inativa." };

  await notify({
    userId: command.userId,
    kind: "achievement",
    title: "Uma competência foi reconhecida no seu perfil",
    body: command.note,
    link: "/perfil",
    values: {},
  });

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "competency_attested",
    target: `nível ${command.level} para outra pessoa`,
    outcome: "allowed",
  });

  return { status: 201, id };
}

export async function revokeEvidenceUseCase(
  actor: Actor,
  actorName: string,
  evidenceId: string,
  reason: string,
): Promise<{ status: 200 | 400 | 403 | 404; error?: string }> {
  if (!podeAtestar(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão." };
  }

  if (reason.trim() === "") {
    return { status: 400, error: "Diga o motivo da revogação." };
  }

  const ok = await revokeEvidence(actor.tenantId, evidenceId, reason);
  if (!ok) return { status: 404, error: "Evidência não encontrada ou já revogada." };

  await recordAudit({
    actorId: actor.id,
    actorName,
    action: "competency_revoked",
    target: `evidência ${evidenceId} — ${reason}`,
    outcome: "allowed",
  });

  return { status: 200 };
}

export interface PlanCommand {
  actor: Actor;
  actorName: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  items: Array<{ competencyId: string; requiredLevel: number }>;
}

export async function createPlanUseCase(command: PlanCommand): Promise<CreateOutcome> {
  if (!podeConfigurar(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para criar planos." };
  }

  if (command.name.trim() === "") {
    return { status: 400, error: "Dê um nome ao plano." };
  }

  if (command.items.length === 0) {
    /* Um plano sem competência não pede nada, e o relatório de gaps dele
       mostraria 100% para todo mundo. */
    return { status: 400, error: "Escolha pelo menos uma competência." };
  }

  const id = await createPlan({
    tenantId: command.actor.tenantId,
    name: command.name,
    description: command.description,
    dueDate: command.dueDate,
    createdBy: command.actor.id,
    items: command.items,
  });

  if (!id) return { status: 400, error: "Já existe um plano com esse nome." };

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "competency_configured",
    target: `plano ${command.name}`,
    outcome: "allowed",
  });

  return { status: 201, id };
}

export async function assignPlanUseCase(
  actor: Actor,
  actorName: string,
  planId: string,
  userIds: string[],
): Promise<{ status: 200 | 403; atribuidos?: number; error?: string }> {
  /* Gestor atribui plano: é ele quem responde pelo desenvolvimento da equipe.
     Configurar o plano é currículo; atribuí-lo é gestão. */
  if (!podeAtestar(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão." };
  }

  const atribuidos = await assignPlan(actor.tenantId, planId, userIds, actor.id);

  await recordAudit({
    actorId: actor.id,
    actorName,
    action: "competency_configured",
    target: `plano atribuído a ${atribuidos} ${atribuidos === 1 ? "pessoa" : "pessoas"}`,
    outcome: "allowed",
  });

  return { status: 200, atribuidos };
}

export interface UserCompetencyReport {
  evidences: EvidenceRow[];
  /** Competência → nível vigente. */
  levels: Record<string, number>;
  plans: Array<PlanRow & { progress: PlanProgress }>;
}

/**
 * O painel de competências de uma pessoa: o que ela tem e o que falta.
 *
 * É o relatório de gaps do §20, do ponto de vista de UMA pessoa.
 */
export async function userReport(
  actor: Actor,
  userId: string,
): Promise<{ status: 200; report: UserCompetencyReport } | { status: 403; error: string }> {
  const proprio = actor.id === userId;

  /* Cada um vê o próprio painel; ver o de outra pessoa exige o mesmo poder que
     ver o cadastro dela. */
  if (!proprio && !can(actor, "read", { kind: "user" })) {
    return { status: 403, error: "Sem permissão." };
  }

  if (!actor.tenantId) return { status: 403, error: "Sessão sem cliente." };

  const [evidences, plans] = await Promise.all([
    findEvidenceOf(actor.tenantId, userId),
    plansOfUser(actor.tenantId, userId),
  ]);

  const niveis = levelsByCompetency(evidences);

  return {
    status: 200,
    report: {
      evidences,
      levels: Object.fromEntries(niveis),
      plans: plans.map((plan) => ({
        ...plan,
        progress: planProgress(plan.items, evidences),
      })),
    },
  };
}
