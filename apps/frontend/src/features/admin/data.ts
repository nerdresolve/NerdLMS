import "server-only";

import { findEmailTemplates } from "@nerdlms/backend/notifications/preferences-repository.ts";
import { findApiKeys } from "@nerdlms/backend/api/api-key-repository.ts";
import { findBadges } from "@nerdlms/backend/badges/badge-repository.ts";
import {
  abandonCandidates,
  activeInPeriod,
  dailyActiveUsers,
  enrollmentCount,
  enrollmentsByDepartment,
  finishedByLesson,
  lessonSteps,
} from "@nerdlms/backend/analytics/analytics-repository.ts";
import {
  abandonedEnrollments,
  courseDropoff,
  departmentPerformance,
  habitMetrics,
  videoRetention,
  worstDropoff,
} from "@nerdlms/core/analytics/advanced.ts";
import {
  findCompetencies,
  findFrameworks,
  findPlans,
} from "@nerdlms/backend/competencies/competency-repository.ts";
import { findAllTracks } from "@nerdlms/backend/courses/tracks-repository.ts";
import { findWebhooks } from "@nerdlms/backend/api/webhook-repository.ts";
import { allProviders } from "@nerdlms/backend/sso/sso-repository.ts";
import { allDirectories, groupRoles } from "@nerdlms/backend/ldap/ldap-repository.ts";

import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  FEATURE_CATALOG,
  ancestorsOf,
  isFeatureEnabled,
} from "@nerdlms/core/tenancy/features.ts";
import { findFeatureOverrides } from "@nerdlms/backend/tenancy/features-repository.ts";

import type {
  PlatformBranding,
  PlatformFeature,
} from "@/features/admin/platform-view.tsx";
import type { HookRow, KeyRow } from "@/features/admin/integrations-view.tsx";
import type { SsoProviderRow } from "@/features/admin/sso-view.tsx";
import type { LdapDirectoryRow } from "@/features/admin/ldap-view.tsx";
import { ssoRedirectUri } from "@/lib/sso-redirect.ts";
import type { BadgeItem, CourseOption } from "@/features/admin/badges-view.tsx";
import type { AnalyticsData } from "@/features/admin/analytics-view.tsx";
import type {
  CompetencyItem,
  FrameworkItem,
  PlanItem,
} from "@/features/admin/competencies-view.tsx";

import { findAuditEvents } from "@nerdlms/backend/audit/audit-repository.ts";
import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { findAllUsers } from "@nerdlms/backend/courses/users-directory.ts";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { activeByProject, activeUsers, lastDays } from "@nerdlms/core/courses/active-users.ts";
import { engagementSummary } from "@nerdlms/core/courses/engagement.ts";
import {
  auditSummary,
  queryAudit,
  repeatedDenials,
  type AuditEvent,
  type AuditSummary,
} from "@nerdlms/core/courses/audit.ts";
import type { User } from "@nerdlms/core/courses/types.ts";

/**
 * Camada de dados da administração.
 *
 * Diferente do gestor, aqui **não há recorte**: o admin responde pela
 * plataforma inteira. Por isso a checagem de permissão é mais importante e não
 * menos — é a única coisa entre um papel comum e a base completa.
 */

/** Garante que quem chegou aqui pode ver a plataforma toda. */
async function requireAdmin() {
  const user = await requireUser();
  /* Quem não tem o papel recebe 404, não erro: um `throw` aqui chegava à tela
     como "Application error: a server-side exception has occurred". Além de
     feio, confirmava que a rota existe — `notFound()` dá o mesmo tratamento
     que as camadas de curso e aula já davam a recurso alheio. */
  if (!can(actorOf(user), "read", { kind: "analytics", scope: "platform" })) {
    notFound();
  }

  return user;
}

export interface AdminPageData {
  admin: User;
  stats: { users: number; active30d: number; courses: number; completions: number };
  byProject: Array<{ project: string; active: number; total: number }>;
  audit: AuditSummary;
  alerts: Array<{ actorId: string; actorName: string; denials: number }>;
}

/** Painel do administrador: números da plataforma e sinais de auditoria. */
export async function getAdminPageData(): Promise<AdminPageData> {
  const user = await requireAdmin();

  const [allCourses, allEnrollments, allUsers, auditEvents] = await Promise.all([
    findAllCourses(user.tenant.id),
    findEnrollments(),
    findAllUsers(user.tenant.id),
    findAuditEvents(user.tenant.id),
  ]);

  const period = lastDays(30, new Date());
  const summary = engagementSummary(allCourses, allEnrollments);

  return {
    admin: toDisplayUser(user),
    stats: {
      users: allUsers.length,
      active30d: activeUsers(allUsers, period).active,
      courses: allCourses.filter((course) => course.status === "published").length,
      completions: summary.completions,
    },
    byProject: activeByProject(allUsers, period),
    audit: auditSummary(auditEvents),
    /* Negativa repetida é o sinal que interessa: uma falha isolada é engano,
       várias seguidas é alguém tentando o que não pode. */
    alerts: repeatedDenials(auditEvents),
  };
}

export interface UsersPageData {
  admin: User;
  users: Array<{ user: User; enrollments: number }>;
}

/** Lista de usuários da plataforma. */
export async function getUsersPageData(): Promise<UsersPageData> {
  const user = await requireAdmin();

  const [allUsers, allEnrollments] = await Promise.all([findAllUsers(user.tenant.id), findEnrollments()]);

  const countByLearner = new Map<string, number>();
  for (const enrollment of allEnrollments) {
    countByLearner.set(enrollment.learnerId, (countByLearner.get(enrollment.learnerId) ?? 0) + 1);
  }

  return {
    admin: toDisplayUser(user),
    users: allUsers.map((person) => ({
      user: person,
      enrollments: countByLearner.get(person.id) ?? 0,
    })),
  };
}

export interface AuditPageData {
  admin: User;
  summary: AuditSummary;
  events: AuditEvent[];
  alerts: Array<{ actorId: string; actorName: string; denials: number }>;
}

/** Registro de auditoria, do mais recente para o mais antigo. */
export async function getAuditPageData(): Promise<AuditPageData> {
  const user = await requireAdmin();

  const auditEvents = await findAuditEvents(user.tenant.id);

  return {
    admin: toDisplayUser(user),
    summary: auditSummary(auditEvents),
    events: queryAudit(auditEvents),
    alerts: repeatedDenials(auditEvents),
  };
}

export interface PlatformPageData {
  admin: User;
  tenantName: string;
  features: PlatformFeature[];
  branding: PlatformBranding;
  /** Textos de e-mail que este cliente personalizou (F4-05). */
  emailTemplates: { kind: string; subject: string; body: string }[];
}

/**
 * Dados da tela de configuração da plataforma.
 *
 * O estado de cada funcionalidade vem em três partes que a tela precisa
 * distinguir:
 *
 * - `enabled`  — o resultado final, com herança aplicada
 * - `overridden` — se o cliente MEXEU, ou se ainda vale o padrão do catálogo
 * - `blockedByParent` — desligada por causa do pai, e o controle trava
 *
 * Sem as três, a tela mentiria em dois pontos: um filho desligado pelo pai
 * pareceria escolha do cliente, e "voltar ao padrão" apareceria em coisa que
 * já está no padrão.
 */
export async function getPlatformPageData(): Promise<PlatformPageData> {
  const user = await requireAdmin();

  const overrides = await findFeatureOverrides(user.tenant.id);

  const features: PlatformFeature[] = FEATURE_CATALOG.map((definition) => {
    const paiDesligado = ancestorsOf(definition.key).some(
      (ancestral) => !isFeatureEnabled(ancestral, overrides),
    );

    return {
      ...definition,
      enabled: isFeatureEnabled(definition.key, overrides),
      overridden: overrides.has(definition.key),
      blockedByParent: paiDesligado,
    };
  });

  return {
    admin: toDisplayUser(user),
    tenantName: user.tenant.name,
    features,
    branding: {
      ...user.tenant.branding,
      /* O remetente não viaja na sessão — só a tela de configuração precisa
         dele, e carregá-lo em toda requisição seria peso morto. */
      mailFromName: null,
      mailFromEmail: null,
    },
    /* Só o que o cliente mudou: sem linha, vale o texto padrão do produto —
       a mesma regra das features e do branding. */
    emailTemplates: await findEmailTemplates(user.tenant.id),
  };
}

export interface IntegrationsPageData {
  admin: ReturnType<typeof toDisplayUser>;
  keys: KeyRow[];
  hooks: HookRow[];
}

/**
 * Dados da tela de integrações — F5-01 e F5-02.
 *
 * As duas listas vêm SEMPRE recortadas pelo tenant de quem está logado. É o
 * recorte que impede um admin de um cliente ver — ou revogar — a chave de
 * outro; e como uma chave dá acesso programático ao cliente inteiro, é o
 * recorte mais importante da administração.
 */
export async function getIntegrationsPageData(): Promise<IntegrationsPageData> {
  const user = await requireAdmin();

  /* Em paralelo: são duas leituras independentes, e a tela só rende com as
     duas. Em série, a pessoa esperaria a soma das duas sem motivo. */
  const [keys, hooks] = await Promise.all([
    findApiKeys(user.tenant.id),
    findWebhooks(user.tenant.id),
  ]);

  return { admin: toDisplayUser(user), keys, hooks };
}

export interface BadgesPageData {
  admin: ReturnType<typeof toDisplayUser>;
  badges: BadgeItem[];
  courses: CourseOption[];
  tracks: CourseOption[];
}

/**
 * Dados da tela de badges — F6-01.
 *
 * Cursos e trilhas vêm junto porque o formulário precisa deles para os
 * critérios "concluir o curso X" e "concluir a trilha Y" — sem a lista, a
 * pessoa teria de digitar um uuid.
 */
export async function getBadgesPageData(): Promise<BadgesPageData> {
  const user = await requireAdmin();

  const [badges, courses, tracks] = await Promise.all([
    findBadges(user.tenant.id),
    findAllCourses(user.tenant.id),
    /* A configuração de badge é do cliente inteiro, não de uma unidade: quem
       administra escolhe entre TODAS as trilhas, e não entre as que alcançam a
       própria conta dele. */
    findAllTracks(user.tenant.id),
  ]);

  return {
    admin: toDisplayUser(user),
    badges,
    courses: courses.map((curso) => ({ id: curso.id, title: curso.title })),
    tracks: tracks.map((trilha) => ({ id: trilha.id, title: trilha.title })),
  };
}

export interface CompetenciesPageData {
  admin: ReturnType<typeof toDisplayUser>;
  frameworks: FrameworkItem[];
  competencies: CompetencyItem[];
  plans: PlanItem[];
  courses: CourseOption[];
}

/** Dados da tela de competências — F6-02. */
export async function getCompetenciesPageData(): Promise<CompetenciesPageData> {
  const user = await requireAdmin();

  const [frameworks, competencies, plans, courses] = await Promise.all([
    findFrameworks(user.tenant.id),
    findCompetencies(user.tenant.id),
    findPlans(user.tenant.id),
    findAllCourses(user.tenant.id),
  ]);

  return {
    admin: toDisplayUser(user),
    frameworks,
    competencies,
    plans,
    courses: courses.map((curso) => ({ id: curso.id, title: curso.title })),
  };
}

export interface AnalyticsPageData {
  admin: ReturnType<typeof toDisplayUser>;
  analytics: AnalyticsData;
  courses: CourseOption[];
  selectedCourseId: string | null;
}

/**
 * Dados do analytics avançado — F6-06.
 *
 * O funil é POR CURSO: "onde as pessoas param" não faz sentido somando cursos
 * diferentes, porque a aula 3 de um não é a aula 3 do outro. As demais métricas
 * são da plataforma inteira.
 */
export async function getAnalyticsPageData(courseId?: string): Promise<AnalyticsPageData> {
  const user = await requireAdmin();

  const courses = await findAllCourses(user.tenant.id);

  /* Sem curso escolhido, o primeiro publicado: a tela precisa mostrar algo, e
     um funil vazio não ensina nada sobre o produto. */
  const escolhido =
    courses.find((c) => c.id === courseId) ??
    courses.find((c) => c.status === "published") ??
    courses[0];

  const [steps, matriculados, finished, diarios, wau, mau, candidatos, porArea] =
    await Promise.all([
      escolhido ? lessonSteps(user.tenant.id, escolhido.id) : Promise.resolve([]),
      escolhido ? enrollmentCount(user.tenant.id, escolhido.id) : Promise.resolve(0),
      escolhido ? finishedByLesson(user.tenant.id, escolhido.id) : Promise.resolve(new Map()),
      dailyActiveUsers(user.tenant.id, 30),
      activeInPeriod(user.tenant.id, 7),
      activeInPeriod(user.tenant.id, 30),
      abandonCandidates(user.tenant.id, null),
      enrollmentsByDepartment(user.tenant.id),
    ]);

  const dropoff = courseDropoff(steps, matriculados);

  return {
    admin: toDisplayUser(user),
    courses: courses.map((curso) => ({ id: curso.id, title: curso.title })),
    selectedCourseId: escolhido?.id ?? null,
    analytics: {
      courseTitle: escolhido?.title ?? "Nenhum curso",
      enrollments: matriculados,
      dropoff,
      worst: worstDropoff(dropoff),
      retention: videoRetention(steps, finished),
      habit: habitMetrics(diarios, wau, mau),
      abandoned: abandonedEnrollments(candidatos),
      departments: departmentPerformance(porArea),
    },
  };
}

export interface SsoPageData {
  admin: ReturnType<typeof toDisplayUser>;
  providers: SsoProviderRow[];
  /** A URL de retorno a cadastrar no provedor. */
  redirectUri: string;
  diretorios: LdapDirectoryRow[];
}

/**
 * Dados da tela de acesso — F5-04.
 *
 * A CHAVE SECRETA NÃO SAI DAQUI. A tela mostra se existe uma configurada, não
 * o valor: quem já a tem não precisa relê-la, e mandá-la ao navegador a
 * colocaria no HTML de uma página que alguém pode deixar aberta.
 */
export async function getSsoPageData(): Promise<SsoPageData> {
  const user = await requireAdmin();
  const [provedores, diretorios] = await Promise.all([
    allProviders(user.tenant.id),
    allDirectories(user.tenant.id),
  ]);

  /* Os mapas de grupo vêm por diretório, e são poucos: no máximo três linhas,
     uma por tipo de diretório. Uma consulta por linha aqui é mais legível que
     uma junção que teria de reagrupar em memória do mesmo jeito. */
  const mapas = await Promise.all(diretorios.map((d) => groupRoles(d.id)));

  return {
    admin: toDisplayUser(user),
    providers: provedores.map((p) => ({
      id: p.id,
      provider: p.provider,
      displayName: p.displayName,
      clientId: p.clientId,
      hasSecret: p.clientSecret.length > 0,
      providerTenantId: p.providerTenantId,
      authorizationUrl: p.authorizationUrl,
      tokenUrl: p.tokenUrl,
      jwksUrl: p.jwksUrl,
      issuer: p.issuer,
      allowedDomains: p.allowedDomains.join(", "),
      allowJit: p.allowJit,
      jitRole: p.jitRole,
      enabled: p.enabled,
      allowPasswordLogin: p.allowPasswordLogin,
    })),
    redirectUri: ssoRedirectUri(await headers()),
    /* A SENHA DA CONTA DE SERVIÇO NÃO SAI DAQUI — só o fato de existir uma.
       Mesma regra da chave secreta do OIDC: quem já a configurou não precisa
       relê-la, e mandá-la ao navegador a poria no HTML de uma página que
       alguém pode deixar aberta. */
    diretorios: diretorios.map((d, i) => ({
      id: d.id,
      kind: d.kind,
      displayName: d.displayName,
      host: d.host,
      port: d.port,
      domain: d.domain,
      baseDn: d.baseDn,
      dnTemplate: d.kind === "generico" ? d.dnTemplate : null,
      allowSelfSigned: d.allowSelfSigned,
      allowedDomains: d.allowedDomains.join(", "),
      allowJit: d.allowJit,
      jitRole: d.jitRole,
      enabled: d.enabled,
      allowPasswordLogin: d.allowPasswordLogin,
      serviceDn: d.serviceDn || null,
      temSenhaDeServico: d.servicePasswordEncrypted !== null,
      searchBase: d.searchBase,
      syncProfile: d.syncProfile,
      requireGroup: d.requireGroup,
      groupRoles: mapas[i] ?? [],
    })),
  };
}
