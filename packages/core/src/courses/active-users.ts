/**
 * Usuários ativos por período �.
 *
 * "Usuário ativo" é a métrica que hoje está travada em 500 pela licença e a que
 * o levantamento pede no relatório de período. Havia três leituras possíveis
 * (quem acessou, quem tem matrícula vigente, quem concluiu alguma aula) e a
 * decisão está registrada no PRD §2: **ativo é quem acessou a plataforma dentro
 * do período**, porque é isso que uma licença por usuário ativo cobra e é o que
 * responde "quantas pessoas realmente usam".
 *
 * Funções puras sobre a lista de usuários; a origem da data de acesso é
 * responsabilidade de quem chama.
 */

import type { User } from "./types.ts";

export interface Period {
  /** Início, inclusivo. */
  from: Date;
  /** Fim, inclusivo. */
  to: Date;
}

/** Últimos `days` dias, terminando em `reference`. */
export function lastDays(days: number, reference: Date): Period {
  const to = new Date(reference);
  const from = new Date(reference);
  from.setDate(from.getDate() - days + 1);
  return { from, to };
}

/** `true` se a pessoa acessou dentro do período. Exportado porque o filtro
    dos relatórios precisa da mesma regra: duas cópias divergiriam
    no tratamento de data ausente e de data inválida. */
export function accessedWithin(user: User, period: Period): boolean {
  if (!user.lastAccessAt) return false;
  const at = new Date(user.lastAccessAt);
  if (Number.isNaN(at.getTime())) return false;
  return at >= period.from && at <= period.to;
}

export interface ActiveUsers {
  active: number;
  total: number;
  /** Percentual da base que esteve ativa no período. */
  percent: number;
  /** Pessoas nunca acessaram: convites que não viraram uso. */
  neverAccessed: number;
}

export function activeUsers(users: User[], period: Period): ActiveUsers {
  const active = users.filter((user) => accessedWithin(user, period)).length;

  return {
    active,
    total: users.length,
    percent: users.length === 0 ? 0 : Math.round((active / users.length) * 100),
    neverAccessed: users.filter((user) => !user.lastAccessAt).length,
  };
}

/** Ativos por projeto — o recorte que o gestor enxerga e o admin compara. */
export function activeByProject(users: User[], period: Period): Array<{ project: string; active: number; total: number }> {
  const projects = [...new Set(users.map((user) => user.project).filter((value): value is string => Boolean(value)))];

  return projects
    .map((project) => {
      const people = users.filter((user) => user.project === project);
      return {
        project,
        active: people.filter((user) => accessedWithin(user, period)).length,
        total: people.length,
      };
    })
    .sort((a, b) => b.active - a.active);
}
