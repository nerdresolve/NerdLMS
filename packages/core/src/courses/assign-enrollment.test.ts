import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { canAssignEnrollment, canSelfEnroll } from "./enrollment-rules.ts";
import type { EnrollableCourse } from "./enrollment-rules.ts";

const curso = (over: Partial<EnrollableCourse> = {}): EnrollableCourse => ({
  status: "published",
  enrollmentMode: "assigned",
  ...over,
});

describe("Gestor matricula a equipe (F1-03)", () => {
  test("curso `assigned` é o caso normal, não a recusa", () => {
    // É a diferença central em relação à auto-matrícula: o treinamento
    // obrigatório existe justamente para ser atribuído.
    assert.equal(canAssignEnrollment(curso(), false, true).allow, true);

    const auto = canSelfEnroll(curso(), false);
    assert.equal(auto.allow === false && auto.reason, "assigned_only");
  });

  test("curso `open` também pode ser atribuído", () => {
    // Nada impede o gestor de inscrever a equipe num curso que a pessoa
    // também poderia pegar sozinha.
    assert.equal(canAssignEnrollment(curso({ enrollmentMode: "open" }), false, true).allow, true);
  });

  test("gente de fora da equipe é recusada", () => {
    // Sem isto um gestor matricularia pessoas de outra concessionária, e o
    // relatório dele passaria a contar quem não é dele.
    const d = canAssignEnrollment(curso(), false, false);
    assert.equal(d.allow === false && d.reason, "outside_team");
  });

  test("a checagem de equipe vem ANTES de qualquer outra", () => {
    // Recusar por "já matriculado" alguém de fora da equipe confirmaria que a
    // pessoa existe e está naquele curso — para um gestor que não deveria
    // saber nada sobre ela.
    const d = canAssignEnrollment(curso({ status: "draft" }), true, false);
    assert.equal(d.allow === false && d.reason, "outside_team");
  });

  test("quem já está matriculado não é matriculado de novo", () => {
    const d = canAssignEnrollment(curso(), true, true);
    assert.equal(d.allow === false && d.reason, "already_enrolled");
  });

  test("rascunho e arquivado ficam de fora", () => {
    for (const status of ["draft", "archived"] as const) {
      const d = canAssignEnrollment(curso({ status }), false, true);
      assert.equal(d.allow === false && d.reason, "course_not_published");
    }
  });
});
