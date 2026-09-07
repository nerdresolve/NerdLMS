import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { authenticate, toSessionUser, type AccountRecord } from "./login.ts";
import { hashPassword } from "./password.ts";

function conta(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: "u1",
    firstName: "Usuário",
    fullName: "Usuário Mock",
    email: "user.mock@exemplo.com.br",
    role: "learner",
    project: "Escola Social",
    status: "active",
    passwordHash: hashPassword("usermock"),
    tenant: {
      id: "t1",
      slug: "lms",
      name: "NerdResolve",
      unitLabel: "Concessionária",
      /* Sem personalização: nulo em tudo significa "usa o padrão do produto". */
      branding: {
        logoLightUrl: null,
        logoDarkUrl: null,
        faviconUrl: null,
        brandColor: null,
      },
    },
    ...overrides,
  };
}

describe("Autenticação", () => {
  test("credenciais corretas autenticam", () => {
    const resultado = authenticate(conta(), "usermock");
    assert.equal(resultado.ok, true);
    assert.equal(resultado.ok && resultado.user.id, "u1");
  });

  test("senha errada não autentica", () => {
    const resultado = authenticate(conta(), "senha-errada");
    assert.equal(resultado.ok, false);
    assert.equal(resultado.ok === false && resultado.reason, "invalid_credentials");
  });

  test("conta inexistente e senha errada dão o MESMO motivo", () => {
    // Distinguir os dois diria a um atacante quais e-mails existem na base.
    const inexistente = authenticate(null, "qualquer");
    const senhaErrada = authenticate(conta(), "qualquer");
    assert.equal(inexistente.ok, false);
    assert.equal(senhaErrada.ok, false);
    assert.equal(
      inexistente.ok === false && inexistente.reason,
      senhaErrada.ok === false && senhaErrada.reason,
    );
  });

  test("conta sem senha definida não autentica com senha vazia", () => {
    // `password_hash` nulo é o estado "convite pendente" (001_init.sql).
    const resultado = authenticate(conta({ passwordHash: null }), "");
    assert.equal(resultado.ok, false);
    assert.equal(resultado.ok === false && resultado.reason, "invalid_credentials");
  });

  test("conta inativa é recusada mesmo com a senha certa", () => {
    for (const status of ["inactive", "pending"] as const) {
      const resultado = authenticate(conta({ status }), "usermock");
      assert.equal(resultado.ok, false, status);
      assert.equal(resultado.ok === false && resultado.reason, "inactive_account", status);
    }
  });

  test("a senha errada numa conta inativa não revela que ela está inativa", () => {
    // A ordem importa: verificar a senha ANTES do status evita que alguém
    // descubra o estado da conta sem conhecer a credencial.
    const resultado = authenticate(conta({ status: "inactive" }), "senha-errada");
    assert.equal(resultado.ok === false && resultado.reason, "invalid_credentials");
  });

  test("o usuário da sessão nunca carrega o hash da senha", () => {
    const user = toSessionUser(conta());
    assert.equal("passwordHash" in user, false);
    assert.equal("status" in user, false);
    assert.deepEqual(
      Object.keys(user).sort(),
      ["email", "firstName", "fullName", "id", "project", "role", "tenant"],
    );
  });

  test("autenticar devolve só o recorte de sessão", () => {
    const resultado = authenticate(conta(), "usermock");
    assert.equal(resultado.ok, true);
    if (resultado.ok) assert.equal("passwordHash" in resultado.user, false);
  });
});
