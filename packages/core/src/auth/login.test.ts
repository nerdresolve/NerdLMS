import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  HASH_DE_COMPARACAO,
  authenticate,
  toSessionUser,
  type AccountRecord,
} from "./login.ts";
import { hashPassword, verifyPassword } from "./password.ts";

function conta(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: "u1",
    firstName: "Usuário",
    fullName: "Usuário Mock",
    email: "user.mock@exemplo.com",
    role: "learner",
    project: "Aguilhada",
    jobTitle: "Operador de Campo",
    status: "active",
    passwordHash: hashPassword("usermock"),
    tenant: {
      id: "t1",
      slug: "exemplo",
      name: "a organização",
      unitLabel: "Unidade",
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
      ["email", "firstName", "fullName", "id", "jobTitle", "project", "role", "tenant"],
    );
  });

  test("autenticar devolve só o recorte de sessão", () => {
    const resultado = authenticate(conta(), "usermock");
    assert.equal(resultado.ok, true);
    if (resultado.ok) assert.equal("passwordHash" in resultado.user, false);
  });
});

describe("Enumeração de usuários pelo tempo de resposta", () => {
  test("a conta inexistente gasta o MESMO trabalho de uma existente", () => {
    /* O `DUMMY_HASH` era um Argon2id e `verifyPassword` só entende scrypt:
       ela devolvia `false` na hora, sem gastar nada. Medido no servidor,
       0,03 s para e-mail inexistente contra 0,60 s para existente — vinte
       vezes, o bastante para varrer a base cronometrando o login.

       O teste guarda o formato, e não o tempo: cronometrar num teste é
       instável e mediria a máquina, não a regra. O que importa é que o hash
       falso passe pelo mesmo caminho caro do verdadeiro. */
    const hashFalso = HASH_DE_COMPARACAO;

    assert.match(hashFalso, /^\$scrypt\$/, "precisa ser scrypt, senão a verificação sai cedo");

    const [, parametros] = hashFalso.split("$scrypt$");
    const [custo] = (parametros ?? "").split("$");

    const real = hashPassword("qualquer");
    const [, parametrosReais] = real.split("$scrypt$");
    const [custoReal] = (parametrosReais ?? "").split("$");

    /* Mesmo custo: um scrypt mais barato devolveria a diferença de tempo por
       outro caminho. */
    assert.equal(custo, custoReal);
  });

  test("nenhuma senha bate com o hash de comparação", () => {
    /* Ele existe para SEMPRE falhar. Se alguma senha o satisfizesse, seria uma
       porta para entrar em contas que não têm senha definida. */
    for (const tentativa of ["", "senha", "123456", "admin", "usermock"]) {
      assert.equal(verifyPassword(tentativa, HASH_DE_COMPARACAO), false, tentativa);
    }
  });
});
