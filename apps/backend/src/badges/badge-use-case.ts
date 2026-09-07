import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  awardStatus,
  badgesToAward,
  expiryOf,
  isValidBadgeCode,
  type BadgeDefinition,
} from "@nerdlms/core/badges/criteria.ts";

import {
  awardBadge,
  createBadge,
  findActiveBadges,
  findAwardByCode,
  findAwardedBadgeIds,
  findAwardsOf,
  findBadges,
  learnerRecordOf,
  revokeAward,
  setBadgeActive,
  type AwardRow,
  type BadgeRow,
} from "./badge-repository.ts";
import { notify } from "../notifications/notify.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Badges — F6-01 (guia §19).
 *
 * Quem configura: admin e instrutor — badge é reconhecimento de aprendizado, e
 * quem responde pelo conteúdo responde por ele. Quem emite à mão: os mesmos.
 * Quem VERIFICA: qualquer um, sem conta — é o ponto do §19.
 */

function podeAdministrar(actor: Actor): boolean {
  return actor.role === "admin" || actor.role === "instructor";
}

export interface ListBadgesOutcome {
  status: 200 | 403;
  badges?: BadgeRow[];
  error?: string;
}

export async function listBadges(actor: Actor): Promise<ListBadgesOutcome> {
  if (!podeAdministrar(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão." };
  }

  return { status: 200, badges: await findBadges(actor.tenantId) };
}

export interface CreateBadgeCommand {
  actor: Actor;
  actorName: string;
  name: string;
  description: string;
  icon: string;
  criterion: string;
  courseId: string | null;
  trackId: string | null;
  threshold: number | null;
  validityMonths: number | null;
}

export type CreateOutcome =
  | { status: 201; id: string }
  | { status: 400 | 403; error: string };

export async function createBadgeUseCase(command: CreateBadgeCommand): Promise<CreateOutcome> {
  if (!podeAdministrar(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para criar badges." };
  }

  if (command.name.trim() === "" || command.description.trim() === "") {
    return { status: 400, error: "Dê um nome e uma descrição ao badge." };
  }

  const resultado = await createBadge({
    tenantId: command.actor.tenantId,
    name: command.name,
    description: command.description,
    icon: command.icon,
    criterion: command.criterion,
    courseId: command.courseId,
    trackId: command.trackId,
    threshold: command.threshold,
    validityMonths: command.validityMonths,
    createdBy: command.actor.id,
  });

  if (!resultado.ok) {
    return {
      status: 400,
      error:
        resultado.reason === "name_taken"
          ? "Já existe um badge com esse nome."
          : "O critério escolhido exige um curso, uma trilha ou um número que não foi informado.",
    };
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "badge_created",
    target: command.name,
    outcome: "allowed",
  });

  return { status: 201, id: resultado.id };
}

export async function toggleBadgeUseCase(
  actor: Actor,
  actorName: string,
  id: string,
  active: boolean,
): Promise<{ status: 200 | 403 | 404; error?: string }> {
  if (!podeAdministrar(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão." };
  }

  const ok = await setBadgeActive(id, actor.tenantId, active);
  if (!ok) return { status: 404, error: "Badge não encontrado." };

  await recordAudit({
    actorId: actor.id,
    actorName,
    action: "badge_created",
    target: `${active ? "ativou" : "desativou"} badge`,
    outcome: "allowed",
  });

  return { status: 200 };
}

/**
 * Avalia os critérios e emite o que for devido.
 *
 * Chamada depois de concluir aula, curso ou lançar nota. **Nunca lança**: um
 * badge que falha não pode impedir a conclusão que o gerou — mesma regra de
 * `notify`, `recordAudit` e `dispatchWebhook`.
 */
export async function evaluateBadges(
  userId: string,
  tenantId: string,
): Promise<{ code: string; badge: BadgeRow }[]> {
  const emitidos: { code: string; badge: BadgeRow }[] = [];

  try {
    const badges = await findActiveBadges(tenantId);

    /* Sem badge automático configurado, não há o que avaliar — e a consulta do
       histórico, que é a cara, não roda. É o caso do cliente que ainda não
       configurou nenhum. */
    const automaticos = badges.filter((badge) => badge.criterion !== "manual");
    if (automaticos.length === 0) return [];

    const [record, jaTem] = await Promise.all([
      learnerRecordOf(userId, tenantId),
      findAwardedBadgeIds(userId),
    ]);

    const devidos = badgesToAward(automaticos as BadgeDefinition[], record, jaTem);

    for (const definicao of devidos) {
      const badge = automaticos.find((b) => b.id === definicao.id)!;

      const code = await awardBadge({
        badgeId: badge.id,
        userId,
        expiresAt: expiryOf(new Date(), badge.validityMonths),
        /* Nulo: quem emitiu foi o critério, não uma pessoa. */
        awardedBy: null,
      });

      /* `null` é a corrida perdida — outra avaliação emitiu primeiro. Não é
         erro: o badge está lá, que é o que importa. */
      if (!code) continue;

      emitidos.push({ code, badge });

      await notify({
        userId,
        /* `achievement` e não um tipo novo: um badge É uma conquista, e a
           preferência de notificação para ela já existe — quem desligou
           "Conquistas" não quer receber badge tampouco. */
        kind: "achievement",
        title: `Você conquistou o badge ${badge.name}`,
        body: badge.description,
        link: `/conquistas`,
        values: { badge: badge.name },
      });
    }
  } catch (erro) {
    /* Nunca derruba a operação que gerou a avaliação. */
    console.error("[badges] falha ao avaliar:", erro);
  }

  return emitidos;
}

export interface ManualAwardCommand {
  actor: Actor;
  actorName: string;
  badgeId: string;
  userId: string;
}

export type ManualAwardOutcome =
  | { status: 201; code: string }
  | { status: 400 | 403 | 404; error: string };

/** Emissão à mão — o `manual` do §19. */
export async function awardManuallyUseCase(
  command: ManualAwardCommand,
): Promise<ManualAwardOutcome> {
  if (!podeAdministrar(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para emitir badges." };
  }

  /* O badge tem de ser DESTE cliente. Sem esta conferência, um id copiado de
     outro lugar emitiria badge alheio para alguém daqui. */
  const badges = await findBadges(command.actor.tenantId);
  const badge = badges.find((b) => b.id === command.badgeId);

  if (!badge) return { status: 404, error: "Badge não encontrado." };

  if (!badge.active) {
    return { status: 400, error: "Este badge está desativado." };
  }

  const code = await awardBadge({
    badgeId: badge.id,
    userId: command.userId,
    expiresAt: expiryOf(new Date(), badge.validityMonths),
    awardedBy: command.actor.id,
  });

  if (!code) {
    return { status: 400, error: "Esta pessoa já tem este badge." };
  }

  await notify({
    userId: command.userId,
    kind: "achievement",
    title: `Você recebeu o badge ${badge.name}`,
    body: badge.description,
    link: `/conquistas`,
    values: { badge: badge.name },
  });

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "badge_awarded",
    target: `${badge.name} · código ${code}`,
    outcome: "allowed",
  });

  return { status: 201, code };
}

export async function revokeAwardUseCase(
  actor: Actor,
  actorName: string,
  code: string,
  reason: string,
): Promise<{ status: 200 | 400 | 403 | 404; error?: string }> {
  if (!podeAdministrar(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão para revogar." };
  }

  if (reason.trim() === "") {
    /* Revogar sem motivo deixa a verificação pública dizendo "revogado" sem
       explicar — quem confere fica sem saber se foi engano ou fraude. */
    return { status: 400, error: "Diga o motivo da revogação." };
  }

  const ok = await revokeAward(code, actor.tenantId, reason);
  if (!ok) return { status: 404, error: "Emissão não encontrada ou já revogada." };

  await recordAudit({
    actorId: actor.id,
    actorName,
    action: "badge_revoked",
    target: `código ${code}, ${reason}`,
    outcome: "allowed",
  });

  return { status: 200 };
}

export interface PublicAward {
  code: string;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
  criterion: string;
  courseName: string | null;
  trackName: string | null;
  threshold: number | null;
  /** Nome de quem recebeu. O e-mail NÃO sai daqui. */
  recipientName: string;
  tenantName: string;
  awardedAt: string;
  expiresAt: string | null;
  status: "valid" | "expired" | "revoked";
  revokedReason: string | null;
}

/**
 * Verificação pública — sem sessão, sem conta.
 *
 * O que sai daqui é o mínimo para conferir: quem, qual badge, quando e se
 * ainda vale. **O e-mail não sai**: a página é pública, e publicar o endereço
 * de quem tem badge transformaria cada verificação num vazamento.
 */
export async function verifyBadgeUseCase(code: string): Promise<PublicAward | null> {
  if (!isValidBadgeCode(code)) return null;

  const award = await findAwardByCode(code);
  if (!award) return null;

  return {
    code: award.code,
    badgeName: award.badgeName,
    badgeDescription: award.badgeDescription,
    badgeIcon: award.badgeIcon,
    criterion: award.criterion,
    courseName: award.courseName,
    trackName: award.trackName,
    threshold: award.threshold,
    recipientName: award.userName,
    tenantName: award.tenantName,
    awardedAt: award.awardedAt,
    expiresAt: award.expiresAt,
    status: awardStatus({
      awardedAt: award.awardedAt,
      expiresAt: award.expiresAt,
      revokedAt: award.revokedAt,
    }),
    revokedReason: award.revokedReason,
  };
}

/** Os badges de uma pessoa, para o perfil dela. */
export async function myBadges(actor: Actor): Promise<AwardRow[]> {
  return findAwardsOf(actor.id);
}

/** Os badges de outra pessoa — o gestor vê os da equipe. */
export async function badgesOfUser(
  actor: Actor,
  userId: string,
): Promise<{ status: 200 | 403; awards?: AwardRow[]; error?: string }> {
  const proprio = actor.id === userId;

  if (!proprio && !can(actor, "read", { kind: "user" })) {
    return { status: 403, error: "Sem permissão." };
  }

  return { status: 200, awards: await findAwardsOf(userId) };
}
