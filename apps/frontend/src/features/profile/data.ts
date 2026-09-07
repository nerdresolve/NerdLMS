import "server-only";

import { awardStatus } from "@nerdlms/core/badges/criteria.ts";
import { findAwardsOf } from "@nerdlms/backend/badges/badge-repository.ts";
import {
  findEvidenceOf,
  plansOfUser,
} from "@nerdlms/backend/competencies/competency-repository.ts";
import { levelsByCompetency, planProgress } from "@nerdlms/core/competencies/proficiency.ts";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { signatureUpdatedAt } from "@nerdlms/backend/auth/users-repository.ts";
import { estadoDasProvas } from "@nerdlms/backend/assessment/retake-repository.ts";
import { cursoConcluido } from "@nerdlms/core/courses/completion.ts";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import { courseDurationSeconds, courseProgress } from "@nerdlms/core/courses/progress.ts";
import type { ProfileCertificate, ProfileTotals } from "./profile-view.tsx";
import type { User } from "@nerdlms/core/courses/types.ts";

/**
 * Um badge emitido, como o perfil o mostra — F6-01.
 *
 * Fica no PERFIL, junto dos certificados, e não em "Conquistas". Badge é
 * credencial verificável, igual ao certificado; medalha de gamificação é outra
 * coisa. A diferença é prática: a tela de Conquistas está atrás da feature
 * `gamificacao`, e um cliente que a desliga não pode perder o badge de NR-10
 * de ninguém.
 */
export interface ProfileBadge {
  code: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: string;
  expiresAt: string | null;
  status: "valid" | "expired" | "revoked";
}

import type {
  ProfileCompetency,
  ProfilePlan,
} from "@/features/profile/profile-competencies.tsx";

export interface ProfilePageData {
  user: User;
  totals: ProfileTotals;
  certificates: ProfileCertificate[];
  badges: ProfileBadge[];
  competencies: ProfileCompetency[];
  plans: ProfilePlan[];
  /** Data em que a assinatura atual foi enviada, já formatada. */
  assinaturaEnviadaEm: string | null;
}

/** Números da jornada e certificados, derivados do progresso real do aluno. */
export async function getProfilePageData(): Promise<ProfilePageData> {
  const user = await requireUser();
  const [courses, mine] = await Promise.all([findAllCourses(user.tenant.id), findEnrollments(user.id)]);

  const rows = courses.flatMap((course) => {
    const enrollment = mine.find((item) => item.courseId === course.id);
    if (!enrollment) return [];
    return [{ course, enrollment, summary: courseProgress(course, enrollment) }];
  });

  const totals: ProfileTotals = {
    lessons: rows.reduce((sum, row) => sum + row.summary.total, 0),
    completedLessons: rows.reduce((sum, row) => sum + row.summary.completed, 0),
    courses: rows.length,
    completedCourses: rows.filter((row) => row.summary.status === "completed").length,
    watchedSeconds: rows.reduce(
      (sum, row) => sum + Object.values(row.enrollment.progress).reduce((acc, item) => acc + item.watchedSeconds, 0),
      0,
    ),
    percent: 0,
  };
  totals.percent = totals.lessons === 0 ? 0 : Math.round((totals.completedLessons / totals.lessons) * 100);

  /* O estado da prova de cada curso deste aluno.

     Sem isto, a lista de certificados saía de "aulas concluídas" — e oferecia
     download que o servidor recusava por falta de nota. A tela prometia o que
     a regra negava, e quem visse aquilo concluiria que o sistema quebrou. */
  const provas = await estadoDasProvas(user.id);

  const certificates: ProfileCertificate[] = rows
    .filter((row) =>
      cursoConcluido(row.summary, {
        notaMinima: row.course.minGradePercent ?? null,
        melhorPercentual: provas.get(row.course.id)?.melhorPercentual ?? null,
      }),
    )
    .map((row) => ({
      course: row.course,
      summary: row.summary,
      durationSeconds: courseDurationSeconds(row.course),
    }));

  const badges: ProfileBadge[] = (await findAwardsOf(user.id)).map((award) => ({
    code: award.code,
    name: award.badgeName,
    description: award.badgeDescription,
    icon: award.badgeIcon,
    awardedAt: award.awardedAt,
    expiresAt: award.expiresAt,
    status: awardStatus({
      awardedAt: award.awardedAt,
      expiresAt: award.expiresAt,
      revokedAt: award.revokedAt,
    }),
  }));

  /* Competências e planos — F6-02.
     
     As evidências vêm cruas e o nível VIGENTE é calculado aqui pela mesma
     função que a tela de gestão usa: duas implementações da regra
     discordariam sobre quem tem o quê. */
  const [evidencias, planosDaPessoa] = await Promise.all([
    findEvidenceOf(user.tenant.id, user.id),
    plansOfUser(user.tenant.id, user.id),
  ]);

  const niveis = levelsByCompetency(evidencias);

  /* Uma competência por linha, com a evidência que a sustenta HOJE — a de maior
     nível entre as que ainda contam. Mostrar todas as evidências repetiria a
     mesma competência várias vezes, e a pergunta do perfil é "o que eu sei
     fazer", não "por quantos caminhos cheguei lá". */
  const competencies: ProfileCompetency[] = [...niveis].map(([competencyId, level]) => {
    const vigente = evidencias
      .filter((e) => e.competencyId === competencyId && e.level === level && !e.revokedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;

    return {
      competencyId,
      name: vigente.competencyName,
      frameworkName: vigente.frameworkName,
      levels: vigente.levels,
      level,
      expiresAt: vigente.expiresAt,
      source: vigente.source,
      courseTitle: vigente.courseTitle,
    };
  });

  const plans: ProfilePlan[] = planosDaPessoa.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    dueDate: plan.dueDate,
    progress: planProgress(plan.items, evidencias),
    /* Os rótulos vêm do ITEM DO PLANO, que traz a escala do framework dele.
       
       Tirá-los da evidência não funcionava: um gap é justamente a ausência de
       evidência, então o rótulo se perdia na única linha que precisava dele — a
       tela mostrava "Nível 2" onde deveria estar "Intermediário". */
    levelsByCompetency: Object.fromEntries(
      plan.items.map((item) => [item.competencyId, item.levels]),
    ),
  }));

  /* Só a DATA do envio, nunca os bytes.

     A assinatura convertida tem dezenas de quilobytes e não é renderizável
     por `<img>` — é RGB cru, não PNG. Mandá-la ao navegador engordaria a
     página do perfil para exibir algo que ela não sabe desenhar. */
  const enviadaEm = await signatureUpdatedAt(user.id);

  return {
    user: toDisplayUser(user),
    totals,
    certificates,
    badges,
    competencies,
    plans,
    assinaturaEnviadaEm: enviadaEm
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(enviadaEm)
      : null,
  };
}
