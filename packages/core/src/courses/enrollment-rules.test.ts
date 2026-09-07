import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { canSelfEnroll } from "./enrollment-rules.ts";
import { makeCourse } from "./test-fixtures.ts";

describe("Auto-matrícula", () => {
  test("curso aberto e publicado aceita", () => {
    const course = makeCourse({ id: "c1", authorId: "u2", status: "published", enrollmentMode: "open" });
    assert.equal(canSelfEnroll(course, false).allow, true);
  });

  test("quem já está matriculado não se matricula de novo", () => {
    const course = makeCourse({ id: "c1", authorId: "u2", status: "published", enrollmentMode: "open" });
    const decision = canSelfEnroll(course, true);
    assert.equal(decision.allow, false);
    assert.equal(decision.allow === false && decision.reason, "already_enrolled");
  });

  test("curso não publicado é recusado", () => {
    // Rascunho pode estar incompleto: matricular alguém encheria o painel dele
    // com um curso que some depois.
    for (const status of ["draft", "archived"] as const) {
      const course = makeCourse({ id: "c1", authorId: "u2", status, enrollmentMode: "open" });
      const decision = canSelfEnroll(course, false);
      assert.equal(decision.allow, false, status);
      assert.equal(decision.allow === false && decision.reason, "course_not_published", status);
    }  });

  test("curso atribuído só entra pelo gestor", () => {
    // É o treinamento obrigatório. Deixar o aluno entrar sozinho
    // apagaria a diferença entre os dois modos de matrícula.
    const course = makeCourse({ id: "c1", authorId: "u2", status: "published", enrollmentMode: "assigned" });
    const decision = canSelfEnroll(course, false);
    assert.equal(decision.allow, false);
    assert.equal(decision.allow === false && decision.reason, "assigned_only");
  });

  test("já matriculado tem prioridade sobre os outros motivos", () => {
    // Quem já está dentro precisa ouvir "você já está", não "não disponível".
    const course = makeCourse({ id: "c1", authorId: "u2", status: "draft", enrollmentMode: "assigned" });
    const decision = canSelfEnroll(course, true);
    assert.equal(decision.allow === false && decision.reason, "already_enrolled");
  });
});
