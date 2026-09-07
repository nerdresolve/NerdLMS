/**
 * Calendário e eventos.
 *
 * A proposta pede "calendário de treinamento, eventos corporativos e
 * comunicações internas". Montar grade de mês parece trivial e é onde erro de
 * data mora: mês que começa no domingo, fevereiro bissexto, e principalmente
 * **fuso horário** — um evento salvo em UTC pode aparecer no dia anterior para
 * quem está em Brasília.
 *
 * Por isso as datas de evento aqui são **civis** (`AAAA-MM-DD`), sem hora nem
 * fuso: um treinamento no dia 26 é no dia 26 em qualquer lugar. A hora, quando
 * existe, é um rótulo separado.
 */

export type EventKind = "training" | "deadline" | "announcement";

export interface CalendarEvent {
  id: string;
  /** Data civil no formato AAAA-MM-DD. Sem hora, sem fuso. */
  date: string;
  /** Rótulo de horário, se houver. Ex.: "14h às 17h". */
  time?: string;
  title: string;
  kind: EventKind;
  location?: string;
}

export interface CalendarDay {
  /** Data civil AAAA-MM-DD. */
  date: string;
  day: number;
  /** Falso para os dias de preenchimento do mês vizinho. */
  inMonth: boolean;
  /** Hoje. Um calendário sem esta marca obriga a conferir a data em outro lugar. */
  isToday: boolean;
  events: CalendarEvent[];
}

const PAD = (value: number) => String(value).padStart(2, "0");

/** Data civil de um ano/mês/dia, sem passar por fuso. */
export function civilDate(year: number, month: number, day: number): string {
  return `${year}-${PAD(month)}-${PAD(day)}`;
}

function daysInMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte é o último dia deste mês. Cobre bissexto sem tabela.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Dia da semana do primeiro dia do mês, 0 = domingo. Calculado em UTC. */
function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/**
 * Grade do mês, sempre em semanas completas de domingo a sábado.
 *
 * @param month 1–12, não 0–11. O off-by-one do `Date` do JavaScript já causou
 * bug demais para ser reproduzido aqui.
 */
export function monthGrid(
  year: number,
  month: number,
  events: CalendarEvent[],
  /* Recebido, não lido de `new Date()` aqui dentro: assim a função continua
     pura e testável com qualquer "hoje". Quem chama já tem a data civil. */
  today?: string,
): CalendarDay[] {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  const total = daysInMonth(year, month);
  const offset = firstWeekday(year, month);

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousTotal = daysInMonth(previousYear, previousMonth);

  const cells: CalendarDay[] = [];

  // Cauda do mês anterior, para a primeira semana começar no domingo.
  for (let i = offset - 1; i >= 0; i -= 1) {
    const day = previousTotal - i;
    const date = civilDate(previousYear, previousMonth, day);
    cells.push({ date, day, inMonth: false, isToday: date === today, events: byDate.get(date) ?? [] });
  }

  for (let day = 1; day <= total; day += 1) {
    const date = civilDate(year, month, day);
    cells.push({ date, day, inMonth: true, isToday: date === today, events: byDate.get(date) ?? [] });
  }

  // Cabeça do mês seguinte, até fechar a última semana.
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let day = 1;
  while (cells.length % 7 !== 0) {
    const date = civilDate(nextYear, nextMonth, day);
    cells.push({ date, day, inMonth: false, isToday: date === today, events: byDate.get(date) ?? [] });
    day += 1;
  }

  return cells;
}

/** Próximos eventos a partir de uma data civil, em ordem. */
export function upcoming(events: CalendarEvent[], from: string, limit = 5): CalendarEvent[] {
  return events
    .filter((event) => event.date >= from)
    .sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title, "pt-BR") : a.date.localeCompare(b.date)))
    .slice(0, limit);
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  /** Data civil. */
  date: string;
  kind: "announcement" | "reminder" | "achievement";
  read: boolean;
}

/** Não lidas primeiro, depois por data decrescente. */
export function sortNotifications(items: Notification[]): Notification[] {
  return [...items].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return b.date.localeCompare(a.date);
  });
}

export function unreadCount(items: Notification[]): number {
  return items.filter((item) => !item.read).length;
}
