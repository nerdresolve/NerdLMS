import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { RESET_TOKEN_TTL_MINUTES, validateNewPassword } from "./password-reset.ts";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../validation/login.ts";

describe("Senha nova na recuperação", () => {
  test("senha válida passa", () => {
    const decision = validateNewPassword("senhaforte123");
    assert.equal(decision.ok, true);
  });

  test("curta demais é recusada", () => {
    const decision = validateNewPassword("x".repeat(PASSWORD_MIN_LENGTH - 1));
    assert.equal(decision.ok === false && decision.reason, "password_too_short");
  });

  test("longa demais é recusada", () => {
    const decision = validateNewPassword("x".repeat(PASSWORD_MAX_LENGTH + 1));
    assert.equal(decision.ok === false && decision.reason, "password_too_long");
  });

  test("exatamente nos limites passa", () => {
    assert.equal(validateNewPassword("x".repeat(PASSWORD_MIN_LENGTH)).ok, true);
    assert.equal(validateNewPassword("x".repeat(PASSWORD_MAX_LENGTH)).ok, true);
  });

  test("espaços NÃO são aparados", () => {
    // Espaço é caractere válido de senha. Cortar silenciosamente faria a
    // pessoa digitar uma coisa e o sistema guardar outra — e o login seguinte
    // falharia sem explicação.
    const comEspaco = "  senha com espaco  ";
    const decision = validateNewPassword(comEspaco);
    assert.equal(decision.ok, true);
    assert.equal(decision.ok && decision.password, comEspaco);
  });

  test("os limites são os mesmos do login", () => {
    // Se divergissem, alguém definiria uma senha que depois não consegue usar.
    assert.equal(PASSWORD_MIN_LENGTH, 8);
    assert.ok(PASSWORD_MAX_LENGTH >= 128);
  });

  test("a validade do link é curta", () => {
    // Janela curta limita o estrago de um e-mail vazado ou encaminhado.
    assert.ok(RESET_TOKEN_TTL_MINUTES <= 120);
  });
});
