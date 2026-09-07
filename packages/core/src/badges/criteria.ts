/**
 * Critérios de badge — F6-01 (guia §19).
 *
 * Regras puras: dado o que a pessoa fez, quais badges ela merece.
 *
 * Não confundir com `courses/gamification.ts`. Aquilo são as medalhas do
 * PRODUTO — lista fixa, calculada na hora, igual para todo cliente. Estes são
 * os badges que o CLIENTE configura, e que viram emissão com data, validade e
 * código de verificação.
 */

export type BadgeCriterion =
  | "manual"
  | "course_completed"
  | "track_completed"
  | "courses_count"
  | "lessons_count"
  | "grade_above";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  criterion: BadgeCriterion;
  courseId: string | null;
  trackId: string | null;
  threshold: number | null;
  /** Meses de validade. `null` é para sempre. */
  validityMonths: number | null;
  active: boolean;
}

/** O que a pessoa fez, do ponto de vista dos critérios. */
export interface LearnerRecord {
  /** Cursos concluídos, por id. */
  completedCourses: Set<string>;
  /** Trilhas concluídas, por id. */
  completedTracks: Set<string>;
  /** Total de aulas concluídas. */
  lessonsCompleted: number;
  /** Nota final por curso, em percentual. Ausente = sem nota. */
  gradesByCourse: Map<string, number>;
}

/**
 * A pessoa cumpre o critério deste badge?
 *
 * `manual` sempre devolve `false`: quem emite é uma pessoa, e um critério que
 * se cumpre sozinho não seria manual. Devolver `true` faria toda emissão manual
 * acontecer automaticamente para todo mundo — o oposto do que a palavra diz.
 */
export function meetsCriterion(badge: BadgeDefinition, record: LearnerRecord): boolean {
  if (!badge.active) return false;

  switch (badge.criterion) {
    case "manual":
      return false;

    case "course_completed":
      return badge.courseId !== null && record.completedCourses.has(badge.courseId);

    case "track_completed":
      return badge.trackId !== null && record.completedTracks.has(badge.trackId);

    case "courses_count":
      return badge.threshold !== null && record.completedCourses.size >= badge.threshold;

    case "lessons_count":
      return badge.threshold !== null && record.lessonsCompleted >= badge.threshold;

    case "grade_above": {
      if (badge.courseId === null || badge.threshold === null) return false;

      const nota = record.gradesByCourse.get(badge.courseId);

      /* Sem nota lançada não cumpre. Tratar ausência como zero reprovaria quem
         ainda não fez a prova, e tratá-la como aprovação daria o badge a quem
         não fez nada. Ausência é ausência. */
      if (nota === undefined) return false;

      /* A NOTA basta — não se exige o curso concluído junto.
         Quem tirou a nota mínima na avaliação do curso cumpriu o que o badge
         mede. Exigir as duas coisas faria um badge de "nota acima de 80" ficar
         parado enquanto falta uma aula opcional, o que não é o que o nome diz. */
      return nota >= badge.threshold;
    }
  }
}

/** Os badges que a pessoa merece e ainda não tem. */
export function badgesToAward(
  badges: BadgeDefinition[],
  record: LearnerRecord,
  jaConquistados: Set<string>,
): BadgeDefinition[] {
  return badges.filter(
    (badge) => !jaConquistados.has(badge.id) && meetsCriterion(badge, record),
  );
}

/**
 * Quando o badge vence, a partir da emissão.
 *
 * Calculado UMA vez, na emissão, e gravado. Recalcular na leitura faria mudar a
 * validade do badge alterar retroativamente o vencimento de quem já o tem.
 */
export function expiryOf(awardedAt: Date, validityMonths: number | null): Date | null {
  if (validityMonths === null) return null;

  const vencimento = new Date(awardedAt);
  vencimento.setMonth(vencimento.getMonth() + validityMonths);

  return vencimento;
}

export type AwardStatus = "valid" | "expired" | "revoked";

export interface AwardRecord {
  awardedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

/**
 * A situação de uma emissão AGORA.
 *
 * Revogado vence expirado: um badge revogado e vencido é, antes de tudo,
 * revogado — a revogação é uma decisão de alguém, e a expiração é só o
 * calendário.
 */
export function awardStatus(award: AwardRecord, agora = new Date()): AwardStatus {
  if (award.revokedAt !== null) return "revoked";
  if (award.expiresAt !== null && new Date(award.expiresAt) <= agora) return "expired";
  return "valid";
}

/**
 * O badge precisa ser renovado em breve?
 *
 * Existe para a recertificação do guia §33: quem tem NR-10 vencendo em 30 dias
 * precisa ser avisado ANTES de vencer, não depois.
 */
export function expiringWithin(award: AwardRecord, dias: number, agora = new Date()): boolean {
  if (awardStatus(award, agora) !== "valid") return false;
  if (award.expiresAt === null) return false;

  const limite = new Date(agora);
  limite.setDate(limite.getDate() + dias);

  return new Date(award.expiresAt) <= limite;
}

/** Um código de verificação legível, para a URL pública. */
export function isValidBadgeCode(code: string): boolean {
  return /^[A-Z0-9]{12}$/.test(code);
}
