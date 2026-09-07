import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { HOME, areaDoPapel, rotuloDoPainel } from "./home.ts";
import type { Role } from "./permissions.ts";

const PAPEIS: Role[] = ["admin", "manager", "instructor", "learner"];

describe("Porta de entrada", () => {
  test("o papel não entra no endereço de entrada", () => {
    /* A regra que este teste guarda: o site serve diferente conforme o papel,
       o papel não muda conforme o endereço. Um `HOME` que variasse por papel
       deixaria um atalho quebrado para quem trocasse de função, e um link
       compartilhado levaria o colega a uma recusa. */
    assert.equal(HOME, "/dashboard");
    assert.doesNotMatch(HOME, /admin|instrutor|gestor/);
  });

  test("cada papel nomeia o próprio painel", () => {
    const rotulos = PAPEIS.map(rotuloDoPainel);

    /* Mesmo destino, nomes diferentes: é a tela que muda, e o menu diz qual. */
    assert.equal(new Set(rotulos).size, PAPEIS.length);
    assert.equal(rotuloDoPainel("learner"), "Meu painel");
    assert.equal(rotuloDoPainel("instructor"), "Painel do instrutor");
  });

  test("o menu inteiro fala português", () => {
    /* O rótulo do aluno era "Dashboard", a única palavra em inglês de um menu
       todo em português. Vale para os quatro, porque o próximo papel a nascer
       vai ser escrito olhando para estes. */
    for (const rotulo of PAPEIS.map(rotuloDoPainel)) {
      assert.doesNotMatch(rotulo, /dashboard|home|overview/i, rotulo);
    }
  });

  test("quem só estuda não tem área de trabalho", () => {
    assert.equal(areaDoPapel("learner"), null);
  });

  test("a área de trabalho é um caminho absoluto quando existe", () => {
    for (const papel of PAPEIS) {
      const area = areaDoPapel(papel);
      if (area !== null) assert.match(area, /^\/[a-z]/, papel);
    }
  });

  test("nenhuma área de trabalho colide com a porta de entrada", () => {
    /* Se coincidissem, o menu mostraria o mesmo destino duas vezes — o defeito
       que este arranjo veio corrigir. */
    for (const papel of PAPEIS) {
      assert.notEqual(areaDoPapel(papel), HOME, papel);
    }
  });
});
