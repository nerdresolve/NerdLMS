import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  IDENTIFIER_MAX_LENGTH,
  LOGIN_MESSAGES,
  PASSWORD_MAX_LENGTH,
  validateLoginInput,
} from "./login.ts";

const VALID_PASSWORD = "senhaSegura1";

function expectOk(result: ReturnType<typeof validateLoginInput>) {
  assert.equal(result.ok, true, "esperava entrada válida");
  return (result as Extract<typeof result, { ok: true }>).value;
}

function expectErrors(result: ReturnType<typeof validateLoginInput>) {
  assert.equal(result.ok, false, "esperava entrada inválida");
  return (result as Extract<typeof result, { ok: false }>).errors;
}

describe("validateLoginInput — identificador", () => {
  test("aceita email e normaliza para minúsculas", () => {
    const value = expectOk(validateLoginInput({ identifier: "Maria.Souza@exemplo.com.br", password: VALID_PASSWORD }));
    assert.equal(value.identifier, "maria.souza@exemplo.com.br");
    assert.equal(value.identifierKind, "email");
  });

  test("aceita nome de usuário", () => {
    const value = expectOk(validateLoginInput({ identifier: "maria_souza", password: VALID_PASSWORD }));
    assert.equal(value.identifierKind, "username");
  });

  test("remove espaços nas extremidades", () => {
    const value = expectOk(validateLoginInput({ identifier: "  ana@exemplo.com  ", password: VALID_PASSWORD }));
    assert.equal(value.identifier, "ana@exemplo.com");
  });

  test("rejeita vazio e somente espaços", () => {
    assert.equal(expectErrors(validateLoginInput({ identifier: "", password: VALID_PASSWORD })).identifier, LOGIN_MESSAGES.identifierRequired);
    assert.equal(expectErrors(validateLoginInput({ identifier: "   ", password: VALID_PASSWORD })).identifier, LOGIN_MESSAGES.identifierRequired);
  });

  test("rejeita email malformado", () => {
    for (const bad of ["ana@", "@exemplo.com", "ana@nerdlms", "a n a@exemplo.com"]) {
      assert.equal(expectErrors(validateLoginInput({ identifier: bad, password: VALID_PASSWORD })).identifier, LOGIN_MESSAGES.emailInvalid, bad);
    }
  });

  test("rejeita usuário curto, longo ou com caracteres inválidos", () => {
    assert.equal(expectErrors(validateLoginInput({ identifier: "ab", password: VALID_PASSWORD })).identifier, LOGIN_MESSAGES.usernameTooShort);
    assert.equal(expectErrors(validateLoginInput({ identifier: "a".repeat(33), password: VALID_PASSWORD })).identifier, LOGIN_MESSAGES.usernameTooLong);
    assert.equal(expectErrors(validateLoginInput({ identifier: "maria souza", password: VALID_PASSWORD })).identifier, LOGIN_MESSAGES.usernameInvalid);
  });

  test("rejeita identificador acima do limite de tamanho", () => {
    const huge = `${"a".repeat(IDENTIFIER_MAX_LENGTH)}@exemplo.com`;
    assert.equal(expectErrors(validateLoginInput({ identifier: huge, password: VALID_PASSWORD })).identifier, LOGIN_MESSAGES.identifierTooLong);
  });
});

describe("validateLoginInput — senha", () => {
  test("rejeita ausente e curta", () => {
    assert.equal(expectErrors(validateLoginInput({ identifier: "ana@exemplo.com", password: "" })).password, LOGIN_MESSAGES.passwordRequired);
    assert.equal(expectErrors(validateLoginInput({ identifier: "ana@exemplo.com", password: "1234567" })).password, LOGIN_MESSAGES.passwordTooShort);
  });

  test("rejeita senha acima do limite (proteção de custo de hash)", () => {
    const huge = "a".repeat(PASSWORD_MAX_LENGTH + 1);
    assert.equal(expectErrors(validateLoginInput({ identifier: "ana@exemplo.com", password: huge })).password, LOGIN_MESSAGES.passwordTooLong);
  });

  test("preserva espaços internos e externos da senha", () => {
    const password = "  duas palavras  ";
    const value = expectOk(validateLoginInput({ identifier: "ana@exemplo.com", password }));
    assert.equal(value.password, password);
  });
});

describe("validateLoginInput — entrada não confiável", () => {
  test("não quebra com tipos inesperados", () => {
    for (const bad of [null, undefined, 42, "texto", [], { identifier: 1, password: {} }]) {
      const result = validateLoginInput(bad);
      assert.equal(result.ok, false);
    }
  });

  test("ignora campos extras enviados pelo cliente", () => {
    const value = expectOk(
      validateLoginInput({ identifier: "ana@exemplo.com", password: VALID_PASSWORD, role: "admin", userId: 1 } as unknown),
    );
    assert.deepEqual(Object.keys(value).sort(), ["identifier", "identifierKind", "password", "remember"]);
  });

  test("remember só é verdadeiro com boolean true", () => {
    assert.equal(expectOk(validateLoginInput({ identifier: "ana@exemplo.com", password: VALID_PASSWORD, remember: "true" as unknown as boolean })).remember, false);
    assert.equal(expectOk(validateLoginInput({ identifier: "ana@exemplo.com", password: VALID_PASSWORD, remember: true })).remember, true);
  });

  test("payloads de XSS são tratados como texto comum e reprovados pelas regras", () => {
    const result = validateLoginInput({ identifier: "<script>alert(1)</script>", password: VALID_PASSWORD });
    assert.equal(expectErrors(result).identifier, LOGIN_MESSAGES.usernameInvalid);
  });

  test("tentativa de SQL injection não é aceita como identificador", () => {
    const result = validateLoginInput({ identifier: "' OR 1=1 --", password: VALID_PASSWORD });
    assert.ok(expectErrors(result).identifier);
  });
});
