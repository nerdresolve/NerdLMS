import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { abrir, fechar } from "./secret-box.ts";

const RAIZ = "chave-de-teste-com-tamanho-suficiente-para-passar";
let anterior: string | undefined;

before(() => {
  anterior = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = RAIZ;
});

after(() => {
  if (anterior === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = anterior;
});

describe("cofre de segredos", () => {
  test("o que entra volta", () => {
    const r = abrir(fechar("s3nh4-do-diretorio", "ldap"), "ldap");
    assert.ok(r.ok);
    assert.equal(r.segredo, "s3nh4-do-diretorio");
  });

  test("acentos e caracteres fora do ASCII sobrevivem", () => {
    const senha = "çãõ-Ünïcode-😀-senha";
    const r = abrir(fechar(senha, "ldap"), "ldap");
    assert.ok(r.ok);
    assert.equal(r.segredo, senha);
  });

  test("cifrar duas vezes o mesmo valor dá saídas diferentes", () => {
    /* O IV é sorteado a cada gravação. Repetir IV no GCM expõe o texto claro de
       todas as mensagens que o compartilham — e saídas idênticas revelariam,
       para quem lê o banco, que dois clientes usam a mesma senha. */
    assert.notEqual(fechar("igual", "ldap"), fechar("igual", "ldap"));
  });

  test("o segredo não aparece no que é guardado", () => {
    const guardado = fechar("s3nh4-do-diretorio", "ldap");
    assert.ok(!guardado.includes("s3nh4"));
    assert.ok(guardado.startsWith("v1."));
  });

  test("um valor cifrado para um uso não abre noutro", () => {
    /* O rótulo entra como dado autenticado justamente para isso: colar o
       segredo de um contexto noutro tem de falhar, não decifrar. */
    const r = abrir(fechar("x", "ldap"), "outra-coisa");
    assert.equal(r.ok, false);
  });

  test("alterar um byte no banco é detectado", () => {
    const guardado = fechar("s3nh4", "ldap");
    const bytes = Buffer.from(guardado.slice(3), "base64");
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 0x01;

    const r = abrir(`v1.${bytes.toString("base64")}`, "ldap");
    assert.equal(r.ok, false);
  });

  test("trocar o SESSION_SECRET dá mensagem que diz o que fazer", () => {
    /* É a falha REAL desta peça — não ataque, troca de chave. Uma pilha de erro
       no log mandaria quem investiga procurar defeito no diretório. */
    const guardado = fechar("s3nh4", "ldap");
    process.env.SESSION_SECRET = "outra-chave-igualmente-longa-o-bastante";

    const r = abrir(guardado, "ldap");
    assert.equal(r.ok, false);
    assert.ok(!r.ok);
    assert.match(r.erro, /SESSION_SECRET/);
    assert.match(r.erro, /regrave/i);

    process.env.SESSION_SECRET = RAIZ;
  });

  test("formato desconhecido não vira exceção", () => {
    assert.equal(abrir("", "ldap").ok, false);
    assert.equal(abrir("sem-ponto", "ldap").ok, false);
    assert.equal(abrir("v9.AAAA", "ldap").ok, false);
    assert.equal(abrir("v1.AAAA", "ldap").ok, false);
  });

  test("sem SESSION_SECRET, falha ao GRAVAR, não no login de alguém depois", () => {
    delete process.env.SESSION_SECRET;
    assert.throws(() => fechar("x", "ldap"), /SESSION_SECRET/);
    process.env.SESSION_SECRET = RAIZ;
  });
});
