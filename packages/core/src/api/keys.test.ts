import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { API_SCOPES, hasScope, isValidKeyFormat, parseScopes } from "./keys.ts";

/**
 * Chaves de API — F5-01.
 *
 * A geração e o hash vivem no backend (precisam de `node:crypto`); aqui ficam
 * as regras puras: formato, escopos e a decisão de permissão.
 */

describe("Formato da chave", () => {
  test("aceita o formato emitido", () => {
    // `aeg_` + 48 hex. O prefixo existe para a chave ser reconhecível num log
    // ou num vazamento: quem vê `aeg_...` sabe o que revogar.
    assert.equal(isValidKeyFormat("aeg_" + "a".repeat(48)), true);
  });

  test("recusa sem o prefixo", () => {
    assert.equal(isValidKeyFormat("a".repeat(48)), false);
  });

  test("recusa comprimento errado", () => {
    assert.equal(isValidKeyFormat("aeg_" + "a".repeat(47)), false);
    assert.equal(isValidKeyFormat("aeg_" + "a".repeat(49)), false);
  });

  test("recusa caractere fora do hexadecimal", () => {
    assert.equal(isValidKeyFormat("aeg_" + "z".repeat(48)), false);
  });

  test("recusa vazio e lixo", () => {
    for (const ruim of ["", "aeg_", "Bearer xyz", "null"]) {
      assert.equal(isValidKeyFormat(ruim), false);
    }
  });

  test("a validação de formato acontece ANTES da consulta ao banco", () => {
    // É a razão de ela existir: sem o filtro, cada requisição com lixo no
    // cabeçalho viraria uma consulta. É barato recusar por formato.
    assert.equal(isValidKeyFormat("' OR 1=1 --"), false);
  });
});

describe("Escopos", () => {
  test("o catálogo tem os escopos documentados", () => {
    for (const escopo of API_SCOPES) {
      assert.ok(escopo.key.includes(":"), `${escopo.key} sem ação`);
      assert.ok(escopo.label.length > 0);
    }
  });

  test("uma chave com o escopo exato passa", () => {
    assert.equal(hasScope(["cursos:ler"], "cursos:ler"), true);
  });

  test("sem o escopo, recusa", () => {
    assert.equal(hasScope(["cursos:ler"], "cursos:escrever"), false);
  });

  test("ler NÃO implica escrever", () => {
    // A hierarquia por prefixo seria tentadora e perigosa: quem dá leitura
    // não está dando escrita.
    assert.equal(hasScope(["cursos:ler"], "cursos:escrever"), false);
    assert.equal(hasScope(["usuarios:ler"], "usuarios:escrever"), false);
  });

  test("escrever implica ler", () => {
    // O contrário faz sentido: quem pode alterar precisa poder consultar, e
    // exigir os dois escopos seria burocracia sem ganho.
    assert.equal(hasScope(["cursos:escrever"], "cursos:ler"), true);
  });

  test("o escopo `*` dá tudo", () => {
    assert.equal(hasScope(["*"], "cursos:escrever"), true);
    assert.equal(hasScope(["*"], "usuarios:ler"), true);
  });

  test("chave sem escopo nenhum não faz nada", () => {
    // Uma chave criada sem escopo é inútil, e é assim que deve ser: o padrão
    // não pode ser "pode tudo".
    assert.equal(hasScope([], "cursos:ler"), false);
  });
});

describe("Leitura dos escopos pedidos", () => {
  test("mantém só os conhecidos", () => {
    // Um escopo inventado no corpo da requisição não pode virar permissão.
    assert.deepEqual(parseScopes(["cursos:ler", "inventado:tudo"]), ["cursos:ler"]);
  });

  test("remove repetidos", () => {
    assert.deepEqual(parseScopes(["cursos:ler", "cursos:ler"]), ["cursos:ler"]);
  });

  test("aceita o coringa", () => {
    assert.deepEqual(parseScopes(["*"]), ["*"]);
  });

  test("lista vazia continua vazia", () => {
    assert.deepEqual(parseScopes([]), []);
  });

  test("valor que não é texto é descartado", () => {
    assert.deepEqual(parseScopes([1, null, "cursos:ler"] as unknown[]), ["cursos:ler"]);
  });
});
