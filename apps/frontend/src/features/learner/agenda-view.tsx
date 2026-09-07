import { Bell, CalendarDays } from "lucide-react";

import { NotificationItem } from "./notification-item.tsx";
import type { AgendaPageData } from "./data.ts";

import "@/features/agenda/agenda.css";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

/** Dia e mês curtos, a partir de uma data civil `AAAA-MM-DD`. */
/** "2026-08-10" vira "10 ago". O aviso imprimia a data ISO crua, enquanto os
    "Próximos" logo acima já usavam este formato. */
function formatDate(date: string): string {
  const { day, month } = dayMonth(date);
  return month ? `${Number(day)} ${month}` : date;
}

function dayMonth(date: string): { day: string; month: string } {
  const [, month = "1", day = "1"] = date.split("-");
  return { day, month: (MONTHS[Number(month) - 1] ?? "").slice(0, 3) };
}

/**
 * Agenda do mês, próximos eventos e avisos.
 *
 * O calendário mostra o mês inteiro, incluindo os dias das semanas vizinhas —
 * é o que faz a grade fechar sem buraco, e `inMonth` os deixa apagados.
 */
export function AgendaView({ month, upcoming, notifications, unread }: Omit<AgendaPageData, "student">) {
  return (
    <div className="agenda">
      <div className="agenda__main">
        <div className="page-head">
          <h1 className="page-head__title">Agenda</h1>
          <p className="page-head__sub">Treinamentos, prazos e comunicados da sua área.</p>
        </div>

        <section className="calendar" aria-labelledby="mes">
          <div className="calendar__head">
            <h2 className="calendar__month" id="mes">
              {MONTHS[month.month - 1]} de {month.year}
            </h2>
          </div>

          <div className="calendar__grid" role="grid">
            {WEEKDAYS.map((weekday) => (
              <span className="calendar__weekday" key={weekday} role="columnheader">
                {weekday}
              </span>
            ))}

            {month.days.map((day) => (
              <div
                className="calendar__day"
                data-in-month={day.inMonth}
                data-today={day.isToday || undefined}
                /* `aria-current="date"` é como um leitor de tela anuncia o dia
                   corrente; a borda sozinha só serve a quem enxerga. */
                aria-current={day.isToday ? "date" : undefined}
                key={day.date}
                role="gridcell"
              >
                <span className="calendar__number">{day.day}</span>
                {day.events.map((event) => (
                  <span className="calendar__event" data-kind={event.kind} key={event.id}>
                    {event.title}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="agenda__aside">
        <section className="course-section" aria-labelledby="proximos">
          <h2 className="course-section__title" id="proximos">
            Próximos
          </h2>

          {upcoming.length > 0 ? (
            <div className="event-list">
              {upcoming.map((event) => {
                const { day, month: monthLabel } = dayMonth(event.date);
                return (
                  <article className="event" data-kind={event.kind} key={event.id}>
                    <span className="event__date">
                      <span className="event__day">{day}</span>
                      <span className="event__month">{monthLabel}</span>
                    </span>
                    <span className="event__body">
                      <span className="event__title">{event.title}</span>
                      <span className="event__meta">
                        {event.time ? `${event.time} · ` : ""}
                        {event.location ?? "Online"}
                      </span>
                    </span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <span className="empty__rule" aria-hidden="true" />
              <div className="empty__inner">
                <span className="empty__icon">
                  <CalendarDays aria-hidden />
                </span>
                <h3 className="empty__title">Nada agendado</h3>
                <p className="empty__text">Novos treinamentos e prazos aparecem aqui.</p>
              </div>
            </div>
          )}
        </section>

        <section className="course-section" aria-labelledby="avisos">
          <h2 className="course-section__title" id="avisos">
            Avisos {unread > 0 ? <span className="badge">{unread} {unread === 1 ? "não lido" : "não lidos"}</span> : null}
          </h2>

          {/* Seção vazia precisa DIZER que está vazia.

              "Próximos", logo acima, já explicava a ausência com um estado
              próprio; esta ficava sendo um título seguido de nada, e um bloco
              em branco no meio da página se lê como falha de carregamento. */}
          {notifications.length > 0 ? (
            <div className="notifications">
              {notifications.map((item) => (
                <NotificationItem item={item} formattedDate={formatDate(item.date)} key={item.id} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <span className="empty__rule" aria-hidden="true" />
              <div className="empty__inner">
                <span className="empty__icon">
                  <Bell aria-hidden />
                </span>
                <h3 className="empty__title">Nenhum aviso</h3>
                <p className="empty__text">
                  Comunicados e lembretes dos seus cursos aparecem aqui.
                </p>
              </div>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
