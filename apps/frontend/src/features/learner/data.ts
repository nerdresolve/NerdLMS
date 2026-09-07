import "server-only";

import { findEvents, findNotifications } from "@nerdlms/backend/courses/agenda-repository.ts";
import { findTracks } from "@nerdlms/backend/courses/tracks-repository.ts";
import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import { trackView, visibleTracks, type TrackView } from "@nerdlms/core/courses/tracks.ts";
import {
  BADGES,
  REWARDS,
  affordable,
  badgesFor,
  balanceOf,
  earningsOf,
  levelOf,
  type BadgeState,
  type Earnings,
  type Level,
  type Reward,
} from "@nerdlms/core/courses/gamification.ts";
import {
  monthGrid,
  sortNotifications,
  unreadCount,
  upcoming,
  type CalendarDay,
  type CalendarEvent,
  type Notification,
} from "@nerdlms/core/courses/calendar.ts";
import { recommend, type Recommendation } from "@nerdlms/core/courses/recommendations.ts";
import type { User } from "@nerdlms/core/courses/types.ts";

/**
 * Camada de dados das telas de engajamento do aluno.
 *
 * As três compartilham o mesmo recorte — o que é **desta** pessoa — e por isso
 * moram juntas: trilha depende do progresso dela, conquista depende do que ela
 * concluiu, e agenda depende do projeto dela.
 */

/** Matrículas do aluno da sessão. */
async function learnerContext() {
  const user = await requireUser();
  const [allCourses, mine] = await Promise.all([findAllCourses(user.tenant.id), findEnrollments(user.id)]);
  return { user, allCourses, mine };
}

export interface TracksPageData {
  student: User;
  tracks: TrackView[];
  recommended: Recommendation[];
}

/**
 * Trilhas visíveis e cursos recomendados.
 *
 * `visibleTracks` recorta por projeto: uma trilha de Prolagos não faz sentido
 * para quem é da Escola Social, e mostrá-la só geraria pedido de acesso.
 */
export async function getTracksPageData(): Promise<TracksPageData> {
  const { user, allCourses, mine } = await learnerContext();

  /* A consulta já recorta por projeto, e `visibleTracks` recorta de novo. A
     redundância é de propósito: o filtro do domínio é testado e vale como
     rede se um dia a trilha vier de outra origem. */
  const tracks = await findTracks(user.tenant.id, user.project ?? null);

  return {
    student: toDisplayUser(user),
    tracks: visibleTracks(tracks, user.project ?? undefined).map((track) =>
      trackView(track, allCourses, mine),
    ),
    recommended: recommend({
      user: toDisplayUser(user),
      courses: allCourses,
      enrollments: mine,
      allEnrollments: mine,
      tracks,
    }),
  };
}

export interface RewardsPageData {
  student: User;
  earnings: Earnings;
  level: Level;
  balance: number;
  badges: BadgeState[];
  rewards: Reward[];
  affordable: Reward[];
}

/**
 * Conquistas: moedas, nível, medalhas e o que dá para resgatar.
 *
 * O saldo desconta o que já foi gasto. Ainda não há registro de gasto — a
 * tabela `coin_spends` existe e nada escreve nela —, então hoje o saldo é o
 * total ganho. Quando o resgate entrar, só o zero abaixo muda.
 */
export async function getRewardsPageData(): Promise<RewardsPageData> {
  const { user, allCourses, mine } = await learnerContext();

  const earnings = earningsOf(allCourses, mine);
  const balance = balanceOf(earnings.coins, 0);

  return {
    student: toDisplayUser(user),
    earnings,
    level: levelOf(earnings.coins),
    balance,
    badges: badgesFor(earnings),
    rewards: REWARDS,
    affordable: affordable(REWARDS, balance),
  };
}

export interface AgendaPageData {
  student: User;
  month: { year: number; month: number; days: CalendarDay[] };
  upcoming: CalendarEvent[];
  notifications: Notification[];
  unread: number;
}

/** Agenda do mês corrente, próximos eventos e avisos. */
export async function getAgendaPageData(): Promise<AgendaPageData> {
  const { user } = await learnerContext();

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  /* Data civil pelos componentes locais, não `toISOString()`: aquele converte
     para UTC, e em fuso negativo "hoje" à noite vira ontem — o evento de hoje
     sairia da lista de próximos antes da hora. */
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [events, notifications] = await Promise.all([
    findEvents(user.tenant.id, user.project ?? null),
    findNotifications(user.id),
  ]);

  const ordered = sortNotifications(notifications);

  return {
    student: toDisplayUser(user),
    month: { year, month, days: monthGrid(year, month, events, iso) },
    upcoming: upcoming(events, iso),
    notifications: ordered,
    unread: unreadCount(ordered),
  };
}

/** Medalhas possíveis, para a tela mostrar também as ainda não conquistadas. */
export const ALL_BADGES = BADGES;
