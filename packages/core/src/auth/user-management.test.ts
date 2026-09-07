import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EMAIL_MAX_LENGTH, canChangeOwnRole, validateUser } from "./user-management.ts";

describe("Convite e edição de usuário", () => {
  test("dados válidos passam, com e-mail normalizado", () => {
    const decision = validateUser({
      fullName: "  Helena Duarte  ",
      email: "  Helena.Duarte@exemplo.com ",
      role: "learner",
    });

    assert.equal(decision.ok, true);
    assert.equal(decision.ok && decision.fullName, "Helena Duarte");
    // O e-mail vira minúsculas: a coluna é citext, e guardar como digitado
    // deixaria dois cadastros parecerem diferentes sendo o mesmo.
    assert.equal(decision.ok && decision.email, "helena.duarte@exemplo.com");
  });

  test("nome vazio é recusado", () => {
    const decision = validateUser({ fullName: "   ", email: "a@b.com", role: "learner" });
    assert.equal(decision.ok === false && decision.reason, "name_required");
  });

  test("e-mail inválido é recusado", () => {
    for (const email of ["semarroba", "a@b", "a b@c.com", "@exemplo.com"]) {
      const decision = validateUser({ fullName: "Nome", email, role: "learner" });
      assert.equal(decision.ok, false, email);
    }
  });

  test("e-mail acima do limite é recusado", () => {
    const email = "x".repeat(EMAIL_MAX_LENGTH) + "@exemplo.com";
    const decision = validateUser({ fullName: "Nome", email, role: "learner" });
    assert.equal(decision.ok === false && decision.reason, "email_too_long");
  });

  test("gestor SEM projeto é recusado", () => {
    // O schema já impõe (users_manager_needs_project); repetir aqui troca um
    // erro de constraint por uma frase legível.
    const decision = validateUser({ fullName: "Nome", email: "a@b.com", role: "manager" });
    assert.equal(decision.ok === false && decision.reason, "manager_needs_project");

    const comEspaco = validateUser({
      fullName: "Nome",
      email: "a@b.com",
      role: "manager",
      project: "   ",
    });
    assert.equal(comEspaco.ok === false && comEspaco.reason, "manager_needs_project");
  });

  test("gestor com projeto passa", () => {
    const decision = validateUser({
      fullName: "Nome",
      email: "a@b.com",
      role: "manager",
      project: "Siririzinho",
    });
    assert.equal(decision.ok, true);
    assert.equal(decision.ok && decision.project, "Siririzinho");
  });

  test("aluno sem projeto passa: só gestor exige recorte", () => {
    const decision = validateUser({ fullName: "Nome", email: "a@b.com", role: "learner" });
    assert.equal(decision.ok, true);
    assert.equal(decision.ok && decision.project, null);
  });
});

describe("Rebaixar a si mesmo", () => {
  test("um admin não remove o próprio acesso", () => {
    // Um sistema com zero administradores não volta a ter um sem mexer no
    // banco à mão.
    assert.equal(canChangeOwnRole("u9", "u9", "learner"), false);
    assert.equal(canChangeOwnRole("u9", "u9", "manager"), false);
  });

  test("continuar admin é permitido", () => {
    assert.equal(canChangeOwnRole("u9", "u9", "admin"), true);
  });

  test("mudar o papel de outra pessoa é permitido", () => {
    assert.equal(canChangeOwnRole("u9", "u1", "instructor"), true);
  });
});
