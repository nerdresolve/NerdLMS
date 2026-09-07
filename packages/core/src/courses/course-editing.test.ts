import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  canPublish,
  durationFromMinutes,
  lessonCountOf,
  validateCourseEdit,
} from "./course-editing.ts";
import { makeCourse, makeLesson, makeModule } from "./test-fixtures.ts";

describe("Edição de curso", () => {
  test("título e resumo válidos passam, já aparados", () => {
    const decision = validateCourseEdit({ title: "  Tratamento  ", summary: "  Resumo  " });
    assert.equal(decision.ok, true);
    assert.equal(decision.ok && decision.title, "Tratamento");
    assert.equal(decision.ok && decision.summary, "Resumo");
  });

  test("título vazio ou só espaço é recusado", () => {
    for (const title of ["", "   ", "\n\t"]) {
      const decision = validateCourseEdit({ title, summary: "" });
      assert.equal(decision.ok === false && decision.reason, "title_required", JSON.stringify(title));
    }
  });

  test("título e resumo acima do limite são recusados", () => {
    const longo = validateCourseEdit({ title: "x".repeat(TITLE_MAX_LENGTH + 1), summary: "" });
    assert.equal(longo.ok === false && longo.reason, "title_too_long");

    const resumo = validateCourseEdit({ title: "ok", summary: "x".repeat(SUMMARY_MAX_LENGTH + 1) });
    assert.equal(resumo.ok === false && resumo.reason, "summary_too_long");
  });

  test("resumo vazio é permitido", () => {
    // Nem todo curso precisa de resumo para existir; título é o mínimo.
    assert.equal(validateCourseEdit({ title: "Curso", summary: "" }).ok, true);
  });
});

describe("Publicação de curso", () => {
  test("curso com aula publica", () => {
    const course = makeCourse({ id: "c1", authorId: "u2", lessonCount: 3 });
    assert.equal(canPublish({ title: course.title, lessonCount: lessonCountOf(course) }).ok, true);
  });

  test("curso SEM aula não publica", () => {
    // Publicar um curso vazio matricularia alunos em nada, e a barra de
    // progresso ficaria em 0% para sempre.
    const decision = canPublish({ title: "Curso novo", lessonCount: 0 });
    assert.equal(decision.ok, false);
    assert.equal(decision.ok === false && decision.reason, "no_lessons");
  });

  test("módulo sem aula também conta como vazio", () => {
    const comModuloVazio = { modules: [makeModule({ id: "m1", lessons: [] })] };
    const decision = canPublish({ title: "Curso", lessonCount: lessonCountOf(comModuloVazio) });
    assert.equal(decision.ok === false && decision.reason, "no_lessons");
  });

  test("curso sem título não publica", () => {
    const comAula = { modules: [makeModule({ id: "m1", lessons: [makeLesson({})] })] };
    const decision = canPublish({ title: "   ", lessonCount: lessonCountOf(comAula) });
    assert.equal(decision.ok === false && decision.reason, "title_required");
  });
});

describe("Duração digitada", () => {
  test("minutos viram segundos", () => {
    assert.equal(durationFromMinutes(30), 1800);
    assert.equal(durationFromMinutes("45"), 2700);
  });

  test("entrada inválida vira 0, nunca NaN", () => {
    // NaN contamina todo o cálculo de progresso adiante.
    for (const valor of ["abc", "", null, undefined, -5, 0, Number.NaN]) {
      assert.equal(durationFromMinutes(valor), 0, String(valor));
    }
  });

  test("fração é arredondada para segundo inteiro", () => {
    assert.equal(durationFromMinutes(1.5), 90);
    assert.equal(durationFromMinutes(0.51), 31);
  });
});
