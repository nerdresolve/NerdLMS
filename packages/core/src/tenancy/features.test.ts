import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FEATURE_CATALOG,
  ancestorsOf,
  isFeatureEnabled,
  resolveFeatures,
} from "./features.ts";

const nada = new Map<string, boolean>();

describe("Catálogo de funcionalidades", () => {
  test("sem escolha do cliente, vale o padrão", () => {
    assert.equal(isFeatureEnabled("comentarios", nada), true);
  });

  test("chave fora do catálogo é sempre falsa", () => {
    // Um typo não pode fazer uma tela aparecer. Melhor não mostrar por engano
    // do que mostrar por engano.
    assert.equal(isFeatureEnabled("comentarios.inventado", nada), false);
    assert.equal(isFeatureEnabled("naoexiste", nada), false);
  });

  test("toda chave do catálogo tem rótulo e descrição", () => {
    // A tela de administração mostra os dois; um catálogo com campo vazio
    // vira uma linha em branco que ninguém entende.
    for (const f of FEATURE_CATALOG) {
      assert.ok(f.label.trim().length > 0, `sem rótulo: ${f.key}`);
      assert.ok(f.description.trim().length > 0, `sem descrição: ${f.key}`);
    }
  });

  test("todo filho declarado tem pai no catálogo", () => {
    // `comentarios.upvotes` sem `comentarios` seria órfão: a herança subiria
    // para uma chave inexistente, que é sempre falsa, e o filho nunca ligaria.
    const chaves = new Set(FEATURE_CATALOG.map((f) => f.key));
    for (const f of FEATURE_CATALOG) {
      for (const pai of ancestorsOf(f.key)) {
        assert.ok(chaves.has(pai), `${f.key} não tem o pai ${pai}`);
      }
    }
  });
});

describe("Herança, o caso que motivou a árvore", () => {
  test("desligar o upvote NÃO derruba os comentários", () => {
    // É o pedido do cliente, literalmente: "podem querer tirar a opção dos
    // upvotes de comentários, alguns podem nem querer comentários".
    const overrides = new Map([["comentarios.upvotes", false]]);

    assert.equal(isFeatureEnabled("comentarios", overrides), true);
    assert.equal(isFeatureEnabled("comentarios.respostas", overrides), true);
    assert.equal(isFeatureEnabled("comentarios.upvotes", overrides), false);
  });

  test("desligar o pai desliga TODOS os filhos", () => {
    // Sem precisar tocar em cada um: o cliente que não quer comentários
    // desliga uma chave, não quatro.
    const overrides = new Map([["comentarios", false]]);

    assert.equal(isFeatureEnabled("comentarios", overrides), false);
    assert.equal(isFeatureEnabled("comentarios.respostas", overrides), false);
    assert.equal(isFeatureEnabled("comentarios.upvotes", overrides), false);
  });

  test("filho ligado NÃO sobrepõe pai desligado", () => {
    // A garantia mais importante do modelo. Se o filho vencesse, "este cliente
    // não tem comentários" deixaria de ser verdade — o upvote apareceria numa
    // seção que não existe, e o contrato com o cliente estaria quebrado.
    const overrides = new Map([
      ["comentarios", false],
      ["comentarios.upvotes", true],
    ]);

    assert.equal(isFeatureEnabled("comentarios.upvotes", overrides), false);
  });

  test("a herança atravessa mais de um nível", () => {
    const overrides = new Map([["gamificacao", false]]);
    assert.equal(isFeatureEnabled("gamificacao.distintivos", overrides), false);
    assert.equal(isFeatureEnabled("gamificacao.loja", overrides), false);
  });

  test("desligar um ramo não afeta o outro", () => {
    const overrides = new Map([["gamificacao", false]]);
    assert.equal(isFeatureEnabled("comentarios", overrides), true);
    assert.equal(isFeatureEnabled("trilhas", overrides), true);
  });
});

describe("Ancestrais", () => {
  test("do mais próximo ao mais distante", () => {
    assert.deepEqual(ancestorsOf("a.b.c"), ["a.b", "a"]);
  });

  test("chave raiz não tem ancestral", () => {
    assert.deepEqual(ancestorsOf("comentarios"), []);
  });
});

describe("Resolução em lote", () => {
  test("devolve todas as chaves do catálogo", () => {
    const mapa = resolveFeatures(nada);
    assert.equal(mapa.size, FEATURE_CATALOG.length);
  });

  test("o lote concorda com a consulta individual", () => {
    // A tela de administração usa o lote; as páginas usam a individual. Se os
    // dois divergissem, a tela mostraria um estado e o produto outro.
    const overrides = new Map([
      ["comentarios", false],
      ["gamificacao.loja", false],
    ]);
    const mapa = resolveFeatures(overrides);

    for (const f of FEATURE_CATALOG) {
      assert.equal(mapa.get(f.key), isFeatureEnabled(f.key, overrides), f.key);
    }
  });
});
