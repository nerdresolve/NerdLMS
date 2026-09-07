import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "./password.ts";

describe("Hash de senha", () => {
  test("a senha correta confere", () => {
    const hash = hashPassword("adminmock");
    assert.equal(verifyPassword("adminmock", hash), true);
  });

  test("a senha errada não confere", () => {
    const hash = hashPassword("adminmock");
    assert.equal(verifyPassword("usermock", hash), false);
    assert.equal(verifyPassword("adminmoc", hash), false);
    assert.equal(verifyPassword("adminmockk", hash), false);
    assert.equal(verifyPassword("", hash), false);
  });

  test("a mesma senha gera hashes diferentes", () => {
    // Se dois usuários com a mesma senha tivessem o mesmo hash, o vazamento do
    // banco entregaria de graça quem repetiu senha. O sal impede isso.
    const a = hashPassword("adminmock");
    const b = hashPassword("adminmock");
    assert.notEqual(a, b);
    assert.equal(verifyPassword("adminmock", a), true);
    assert.equal(verifyPassword("adminmock", b), true);
  });

  test("o formato é PHC, legível por outra implementação", () => {
    const hash = hashPassword("adminmock");
    assert.match(hash, /^\$scrypt\$ln=\d+,r=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
  });

  test("hash corrompido ou de outro formato é recusado, sem lançar", () => {
    for (const invalid of ["", "não é hash", "$scrypt$ln=x,r=8,p=1$aaa$bbb", "$2b$10$abcdefgh", "$argon2id$v=19$m=19456,t=2,p=1$aaa$bbb"]) {
      assert.equal(verifyPassword("adminmock", invalid), false, invalid);
    }
  });

  test("senha com acento e espaço funciona", () => {
    // O banco guarda UTF-8; a senha do usuário não precisa ser ASCII.
    const senha = "Sérgio da Silva 123";
    const hash = hashPassword(senha);
    assert.equal(verifyPassword(senha, hash), true);
    assert.equal(verifyPassword("Sergio da Silva 123", hash), false);
  });

  test("os parâmetros de custo vêm do hash, não das constantes atuais", () => {
    // Um hash gerado com custo menor precisa continuar verificável depois de
    // subirmos o custo — senão, subir custo derrubaria todo mundo.
    const hash = hashPassword("adminmock");
    const comCustoAntigo = hash.replace(/ln=\d+/, "ln=14");
    // Com outros parâmetros o hash não bate, mas a função não pode explodir.
    assert.equal(verifyPassword("adminmock", comCustoAntigo), false);
  });
});
