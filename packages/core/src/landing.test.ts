import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { landingStats } from "./landing.ts";

describe("Números da landing, contagem real, nunca inventada", () => {
  test("omite o que está zerado", () => {
    // "0 alunos" numa página de apresentação fala do estado da instalação, não
    // do produto. Melhor não mostrar o cartão.
    const stats = landingStats({ learners: 0, courses: 7, lessons: 0, completedLessons: 0 });
    assert.deepEqual(stats, [{ value: "7", label: "Cursos" }]);
  });

  test("instalação vazia não mostra número nenhum", () => {
    assert.deepEqual(
      landingStats({ learners: 0, courses: 0, lessons: 0, completedLessons: 0 }),
      [],
    );
  });

  test("número pequeno aparece como é", () => {
    const stats = landingStats({ learners: 13, courses: 7, lessons: 98, completedLessons: 41 });
    assert.deepEqual(stats.map((s) => s.value), ["13", "7", "98", "41"]);
  });

  test("singular quando é um só", () => {
    const stats = landingStats({ learners: 1, courses: 1, lessons: 0, completedLessons: 0 });
    assert.deepEqual(stats.map((s) => s.label), ["Aluno", "Curso"]);
  });

  test("abrevia milhar arredondando para BAIXO", () => {
    // Arredondar para cima faria a plataforma parecer maior do que é — que é
    // exatamente o problema que esta mudança veio resolver.
    const stats = landingStats({ learners: 1299, courses: 0, lessons: 0, completedLessons: 0 });
    assert.equal(stats[0]!.value, "1,2 mil");
  });

  test("milhar redondo não vira 10,0 mil", () => {
    const stats = landingStats({ learners: 10000, courses: 0, lessons: 0, completedLessons: 0 });
    assert.equal(stats[0]!.value, "10 mil");
  });
});
