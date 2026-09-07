import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { can } from "@nerdlms/core/auth/permissions.ts";

/**
 * A porta que a matrícula atribuída não pode abrir — F1-03.
 *
 * Estes testes fixam a razão de `assignEnrollmentUseCase` recusar quem tenta
 * se incluir na própria lista, e de a permissão ser checada contra a PESSOA A
 * MATRICULAR e não contra o ator.
 *
 * Os dois defeitos apareceram testando no navegador, não lendo o código.
 */

const aluno = { id: "u1", role: "learner" as const, tenantId: "t1" };
const gestor = { id: "u4", role: "manager" as const, tenantId: "t1", project: "Prolagos" };

describe("Permissão de matricular OUTRA pessoa", () => {
  test("o aluno não matricula outra pessoa", () => {
    assert.equal(
      can(aluno, "enroll", { kind: "enrollment", learnerId: "u9", courseAuthorId: "" }),
      false,
    );
  });

  test("mas o aluno PODE matricular a si mesmo — e é essa a armadilha", () => {
    // A regra está certa: é o caminho da auto-inscrição. O erro foi passar o
    // próprio ator como `learnerId` na checagem da matrícula atribuída, o que
    // fazia todo aluno atravessar a porta.
    assert.equal(
      can(aluno, "enroll", { kind: "enrollment", learnerId: aluno.id, courseAuthorId: "" }),
      true,
    );
  });

  test("o gestor matricula outra pessoa", () => {
    assert.equal(
      can(gestor, "enroll", { kind: "enrollment", learnerId: "u1", courseAuthorId: "" }),
      true,
    );
  });

  test("o instrutor não matricula ninguém", () => {
    // Ele acompanha quem está no curso dele; colocar gente lá é do gestor.
    const instrutor = { id: "u2", role: "instructor" as const, tenantId: "t1" };
    assert.equal(
      can(instrutor, "enroll", { kind: "enrollment", learnerId: "u1", courseAuthorId: "u2" }),
      false,
    );
  });
});
