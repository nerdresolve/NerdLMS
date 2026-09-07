import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  LIMITE_DE_CHAVE,
  LIMITE_DE_NOME,
  LIMITE_DE_TEXTO,
  textoDeEntrada,
} from "./texto.ts";

describe("textoDeEntrada", () => {
  test("devolve o texto aparado", () => {
    assert.equal(textoDeEntrada("  Segurança  ", LIMITE_DE_NOME), "Segurança");
  });

  test("aceita exatamente o limite", () => {
    const valor = "a".repeat(LIMITE_DE_NOME);
    assert.equal(textoDeEntrada(valor, LIMITE_DE_NOME), valor);
  });

  test("recusa um caractere acima do limite", () => {
    assert.equal(textoDeEntrada("a".repeat(LIMITE_DE_NOME + 1), LIMITE_DE_NOME), null);
  });

  test("recusa o que não é texto", () => {
    for (const valor of [null, undefined, 42, {}, [], true]) {
      assert.equal(textoDeEntrada(valor, LIMITE_DE_NOME), null, String(valor));
    }
  });

  test("não corta em silêncio: ou passa inteiro, ou é nulo", () => {
    const longo = "a".repeat(LIMITE_DE_NOME + 50);
    const saida = textoDeEntrada(longo, LIMITE_DE_NOME);
    assert.equal(saida, null);
    assert.notEqual(saida, longo.slice(0, LIMITE_DE_NOME));
  });

  test("o teto vale sobre o texto cru, antes de aparar", () => {
    /* Um corpo de espaço em branco custa a mesma rede e o mesmo parse que um
       corpo de letras. Aparar antes de medir deixaria isso passar. */
    const soEspaco = " ".repeat(LIMITE_DE_NOME + 1);
    assert.equal(textoDeEntrada(soEspaco, LIMITE_DE_NOME), null);
  });

  test("o ataque que motivou o módulo: 1 MB num campo de nome", () => {
    assert.equal(textoDeEntrada("A".repeat(1024 * 1024), LIMITE_DE_NOME), null);
  });

  test("os limites crescem do mais estreito ao mais largo", () => {
    assert.ok(LIMITE_DE_NOME < LIMITE_DE_CHAVE);
    assert.ok(LIMITE_DE_CHAVE < LIMITE_DE_TEXTO);
  });
});
