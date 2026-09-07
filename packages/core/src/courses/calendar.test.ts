import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  civilDate,
  monthGrid,
  sortNotifications,
  unreadCount,
  upcoming,
  type CalendarEvent,
  type Notification,
} from "./calendar.ts";

const evento = (id: string, date: string, title = id): CalendarEvent => ({
  id,
  date,
  title,
  kind: "training",
});

describe("monthGrid", () => {
  test("sempre devolve semanas completas", () => {
    for (const [ano, mes] of [[2026, 1], [2026, 2], [2026, 8], [2026, 11], [2024, 2]] as const) {
      const grade = monthGrid(ano, mes, []);
      assert.equal(grade.length % 7, 0, `${ano}-${mes}`);
    }
  });

  test("a primeira célula é sempre um domingo", () => {
    const grade = monthGrid(2026, 8, []);
    // Agosto de 2026 começa num sábado: a grade abre no domingo anterior, 26/07.
    assert.equal(grade[0]?.date, "2026-07-26");
    assert.equal(grade[0]?.inMonth, false);
  });

  test("fevereiro bissexto tem 29 dias no mês", () => {
    const grade = monthGrid(2024, 2, []).filter((cell) => cell.inMonth);
    assert.equal(grade.length, 29);
    assert.equal(grade.at(-1)?.date, "2024-02-29");
  });

  test("fevereiro comum tem 28", () => {
    assert.equal(monthGrid(2026, 2, []).filter((cell) => cell.inMonth).length, 28);
  });

  test("janeiro puxa dezembro do ano anterior", () => {
    const grade = monthGrid(2026, 1, []);
    assert.ok(grade[0]!.date.startsWith("2025-12"), grade[0]!.date);
  });

  test("dezembro empurra janeiro do ano seguinte", () => {
    const grade = monthGrid(2026, 12, []);
    assert.ok(grade.at(-1)!.date.startsWith("2027-01"), grade.at(-1)!.date);
  });

  test("mês que começa no domingo não ganha semana vazia na frente", () => {
    // Novembro de 2026 começa num domingo.
    const grade = monthGrid(2026, 11, []);
    assert.equal(grade[0]?.date, "2026-11-01");
    assert.equal(grade[0]?.inMonth, true);
  });

  test("evento cai exatamente no dia declarado, sem deslize de fuso", () => {
    const grade = monthGrid(2026, 8, [evento("e1", "2026-08-26")]);
    const dia26 = grade.find((cell) => cell.date === "2026-08-26");
    assert.equal(dia26?.events.length, 1);
    const dia25 = grade.find((cell) => cell.date === "2026-08-25");
    assert.equal(dia25?.events.length, 0, "não pode vazar para o dia anterior");
  });

  test("vários eventos no mesmo dia ficam juntos", () => {
    const grade = monthGrid(2026, 8, [evento("a", "2026-08-10"), evento("b", "2026-08-10")]);
    assert.equal(grade.find((cell) => cell.date === "2026-08-10")?.events.length, 2);
  });

  test("evento de outro mês aparece na cauda, não some", () => {
    const grade = monthGrid(2026, 8, [evento("x", "2026-07-28")]);
    const celula = grade.find((cell) => cell.date === "2026-07-28");
    assert.equal(celula?.events.length, 1);
    assert.equal(celula?.inMonth, false);
  });
});

describe("civilDate", () => {
  test("preenche com zero à esquerda", () => {
    assert.equal(civilDate(2026, 3, 7), "2026-03-07");
  });
});

describe("upcoming", () => {
  const eventos = [evento("c", "2026-09-01"), evento("a", "2026-08-20"), evento("b", "2026-08-20", "Bravo")];

  test("traz só o que ainda vem, em ordem de data", () => {
    const lista = upcoming(eventos, "2026-08-20").map((item) => item.date);
    assert.deepEqual(lista, ["2026-08-20", "2026-08-20", "2026-09-01"]);
  });

  test("ignora o que já passou", () => {
    assert.equal(upcoming(eventos, "2026-08-25").length, 1);
  });

  test("respeita o limite", () => {
    assert.equal(upcoming(eventos, "2026-01-01", 2).length, 2);
  });

  test("empate de data é desempatado pelo título", () => {
    const lista = upcoming(eventos, "2026-08-20").map((item) => item.title);
    assert.deepEqual(lista.slice(0, 2), ["a", "Bravo"]);
  });
});

describe("Notificações", () => {
  const itens: Notification[] = [
    { id: "1", title: "Antiga lida", body: "", date: "2026-08-01", kind: "announcement", read: true },
    { id: "2", title: "Nova não lida", body: "", date: "2026-08-10", kind: "reminder", read: false },
    { id: "3", title: "Antiga não lida", body: "", date: "2026-08-02", kind: "reminder", read: false },
    { id: "4", title: "Recente lida", body: "", date: "2026-08-11", kind: "achievement", read: true },
  ];

  test("não lidas vêm primeiro, mesmo sendo mais antigas", () => {
    assert.deepEqual(sortNotifications(itens).map((item) => item.id), ["2", "3", "4", "1"]);
  });

  test("não altera o array original", () => {
    const antes = itens.map((item) => item.id);
    sortNotifications(itens);
    assert.deepEqual(itens.map((item) => item.id), antes);
  });

  test("conta as não lidas", () => {
    assert.equal(unreadCount(itens), 2);
    assert.equal(unreadCount([]), 0);
  });
});
