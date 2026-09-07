import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { canJoinClass, classPeriod, seatsLeft, type CourseClass } from "./classes.ts";

const turma = (over: Partial<CourseClass> = {}): CourseClass => ({
  id: "t1",
  courseId: "c1",
  name: "Turma de março",
  status: "open",
  enrolled: 0,
  ...over,
});

const HOJE = "2026-03-15";

describe("Quem pode entrar na turma", () => {
  test("turma aberta e com vaga aceita", () => {
    assert.equal(canJoinClass(turma(), "c1", HOJE).allow, true);
  });

  test("turma de outro curso é recusada", () => {
    // O gatilho da 008 também impede no banco; aqui é a mensagem em vez do
    // erro de restrição.
    const d = canJoinClass(turma(), "c-outro", HOJE);
    assert.equal(d.allow === false && d.reason, "wrong_course");
  });

  test("turma fechada é recusada", () => {
    const d = canJoinClass(turma({ status: "closed" }), "c1", HOJE);
    assert.equal(d.allow === false && d.reason, "class_closed");
  });

  test("turma lotada é recusada", () => {
    const d = canJoinClass(turma({ capacity: 20, enrolled: 20 }), "c1", HOJE);
    assert.equal(d.allow === false && d.reason, "class_full");
  });

  test("turma sem teto nunca lota", () => {
    // Turma aberta e contínua é o caso comum; um teto obrigatório obrigaria a
    // inventar um número.
    assert.equal(canJoinClass(turma({ enrolled: 9999 }), "c1", HOJE).allow, true);
  });

  test("turma encerrada é recusada", () => {
    const d = canJoinClass(turma({ endsOn: "2026-03-01" }), "c1", HOJE);
    assert.equal(d.allow === false && d.reason, "class_ended");
  });

  test("turma que termina hoje ainda aceita", () => {
    // O último dia é dia de aula. Recusar no dia do encerramento tiraria uma
    // pessoa que chegou a tempo.
    assert.equal(canJoinClass(turma({ endsOn: HOJE }), "c1", HOJE).allow, true);
  });

  test("encerrada E lotada informa o encerramento", () => {
    // "Lotada" sugeriria que abrir vaga resolve — e não resolve.
    const d = canJoinClass(
      turma({ endsOn: "2026-01-01", capacity: 5, enrolled: 5 }),
      "c1",
      HOJE,
    );
    assert.equal(d.allow === false && d.reason, "class_ended");
  });

  test("turma que ainda não começou aceita matrícula", () => {
    // Inscrever-se antes do início é o caso NORMAL de uma turma com data.
    assert.equal(canJoinClass(turma({ startsOn: "2026-06-01" }), "c1", HOJE).allow, true);
  });
});

describe("Vagas restantes", () => {
  test("conta o que sobra", () => {
    assert.equal(seatsLeft(turma({ capacity: 20, enrolled: 8 })), 12);
  });

  test("sem teto devolve null, não zero", () => {
    // Zero seria lido como "lotada" na tela.
    assert.equal(seatsLeft(turma({ enrolled: 40 })), null);
  });

  test("nunca devolve negativo", () => {
    // Pode acontecer se o teto for reduzido depois das matrículas.
    assert.equal(seatsLeft(turma({ capacity: 5, enrolled: 8 })), 0);
  });
});

describe("Período da turma", () => {
  test("com as duas datas", () => {
    assert.equal(classPeriod(turma({ startsOn: "2026-03-02", endsOn: "2026-03-20" })), "02/03/2026 a 20/03/2026");
  });

  test("só com início", () => {
    assert.equal(classPeriod(turma({ startsOn: "2026-03-02" })), "A partir de 02/03/2026");
  });

  test("só com fim", () => {
    assert.equal(classPeriod(turma({ endsOn: "2026-03-20" })), "Até 20/03/2026");
  });

  test("sem data nenhuma devolve null", () => {
    // Turma contínua existe; um traço solto na tela não informaria nada.
    assert.equal(classPeriod(turma()), null);
  });
});
