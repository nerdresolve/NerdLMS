/**
 * Gamificação.
 *
 * A proposta promete "moedas, badges e sistema de recompensas" e o levantamento
 * pede gamificação explicitamente. O objetivo declarado é converter acesso em
 * hábito.
 *
 * Três decisões de regra, todas com a mesma raiz — recompensa que não
 * corresponde a esforço real destrói a própria motivação que deveria criar:
 *
 * 1. **Moeda ganha é derivada do progresso**, nunca um saldo gravado. Se fosse
 *    saldo, um erro de contabilização viraria moeda de graça, e um curso que
 *    perde uma aula deixaria a conta errada para sempre.
 * 2. **Moeda gasta é evento e precisa ser gravada.** Saldo = ganho − gasto.
 *    Essa é a única parte que o servidor precisa persistir.
 * 3. **Distintivo é condição verificável sobre o progresso**, avaliada na hora.
 *    Nada de "conceder" distintivo manualmente: o critério é a fonte.
 */

import { courseProgress } from "./progress.ts";
import type { Course, Enrollment } from "./types.ts";

/** Moedas por aula concluída. */
export const COINS_PER_LESSON = 10;
/** Bônus por curso concluído — recompensa terminar, não só começar. */
export const COINS_PER_COURSE = 100;

export interface Earnings {
  lessonsCompleted: number;
  coursesCompleted: number;
  /** Total já ganho na vida. Base do nível — nunca diminui ao gastar. */
  coins: number;
}

export function earningsOf(courses: Course[], enrollments: Enrollment[]): Earnings {
  const byId = new Map(courses.map((course) => [course.id, course]));

  let lessonsCompleted = 0;
  let coursesCompleted = 0;

  for (const enrollment of enrollments) {
    const course = byId.get(enrollment.courseId);
    if (!course) continue;
    const summary = courseProgress(course, enrollment);
    lessonsCompleted += summary.completed;
    if (summary.status === "completed") coursesCompleted += 1;
  }

  return {
    lessonsCompleted,
    coursesCompleted,
    coins: lessonsCompleted * COINS_PER_LESSON + coursesCompleted * COINS_PER_COURSE,
  };
}

/**
 * Saldo disponível para gastar na loja.
 * O nível usa o **ganho acumulado**, não o saldo: gastar não pode rebaixar
 * alguém que já fez o esforço.
 */
export function balanceOf(earned: number, spent: number): number {
  return Math.max(0, earned - spent);
}

/** Moedas necessárias para alcançar cada nível. */
export const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 1800, 3000] as const;

export interface Level {
  level: number;
  /** Moedas exigidas pelo nível atual. */
  floor: number;
  /** Moedas do próximo nível, ou null no último. */
  next: number | null;
  /** Progresso dentro do nível atual, de 0 a 100. */
  percent: number;
}

export function levelOf(coins: number): Level {
  const safe = Number.isFinite(coins) && coins > 0 ? coins : 0;

  let index = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (safe >= LEVEL_THRESHOLDS[i]!) index = i;
  }

  const floor = LEVEL_THRESHOLDS[index]!;
  const next = index + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[index + 1]! : null;

  return {
    level: index + 1,
    floor,
    next,
    // No último nível a barra fica cheia em vez de dividir por zero.
    percent: next === null ? 100 : Math.round(((safe - floor) / (next - floor)) * 100),
  };
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Condição verificável. Recebe o resumo do esforço real. */
  earned: (earnings: Earnings) => boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "primeira-aula",
    title: "Primeiro passo",
    description: "Concluiu a primeira aula.",
    icon: "play",
    earned: (e) => e.lessonsCompleted >= 1,
  },
  {
    id: "dez-aulas",
    title: "Em ritmo",
    description: "Concluiu 10 aulas.",
    icon: "trending-up",
    earned: (e) => e.lessonsCompleted >= 10,
  },
  {
    id: "primeiro-curso",
    title: "Curso completo",
    description: "Concluiu o primeiro curso inteiro.",
    icon: "award",
    earned: (e) => e.coursesCompleted >= 1,
  },
  {
    id: "trinta-aulas",
    title: "Especialista em campo",
    description: "Concluiu 30 aulas.",
    icon: "graduation-cap",
    earned: (e) => e.lessonsCompleted >= 30,
  },
  {
    id: "tres-cursos",
    title: "Formação sólida",
    description: "Concluiu 3 cursos.",
    icon: "circle-check-big",
    earned: (e) => e.coursesCompleted >= 3,
  },
  {
    id: "mil-moedas",
    title: "Mil moedas",
    description: "Acumulou 1.000 moedas.",
    icon: "star",
    earned: (e) => e.coins >= 1000,
  },
];

export interface BadgeState extends Omit<BadgeDefinition, "earned"> {
  earned: boolean;
}

export function badgesFor(earnings: Earnings): BadgeState[] {
  return BADGES.map(({ earned, ...rest }) => ({ ...rest, earned: earned(earnings) }));
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  cost: number;
}

/** Itens da loja. O catálogo real é decisão do RH. */
export const REWARDS: Reward[] = [
  { id: "r1", title: "Dia de folga", description: "Um dia de descanso a combinar com a liderança.", cost: 3000 },
  { id: "r2", title: "Kit da marca", description: "Garrafa térmica e caderno da marca.", cost: 800 },
  { id: "r3", title: "Vale-livro", description: "Crédito para um livro técnico à sua escolha.", cost: 1200 },
  { id: "r4", title: "Café com a liderança", description: "Uma conversa de 30 minutos com a diretoria da sua área.", cost: 300 },
];

/** Itens que o saldo alcança agora. */
export function affordable(rewards: Reward[], balance: number): Reward[] {
  return rewards.filter((reward) => reward.cost <= balance);
}
