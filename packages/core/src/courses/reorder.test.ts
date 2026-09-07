import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { moveItem, reorderPositions } from "./reorder.ts";

describe("Mover um item na lista", () => {
  const lista = ["a", "b", "c", "d"];

  test("desce uma posição", () => {
    assert.deepEqual(moveItem(lista, 0, 1), ["b", "a", "c", "d"]);
  });

  test("sobe uma posição", () => {
    assert.deepEqual(moveItem(lista, 2, 1), ["a", "c", "b", "d"]);
  });

  test("vai para o fim", () => {
    assert.deepEqual(moveItem(lista, 0, 3), ["b", "c", "d", "a"]);
  });

  test("vai para o começo", () => {
    assert.deepEqual(moveItem(lista, 3, 0), ["d", "a", "b", "c"]);
  });

  test("mover para a própria posição não muda nada", () => {
    assert.deepEqual(moveItem(lista, 1, 1), lista);
  });

  test("índice fora da lista devolve a lista intacta", () => {
    // O botão "subir" da primeira aula e o "descer" da última chegariam aqui.
    // Devolver a lista como está é melhor que lançar: a tela não tem o que
    // fazer com um erro que ela mesma poderia ter evitado.
    assert.deepEqual(moveItem(lista, -1, 2), lista);
    assert.deepEqual(moveItem(lista, 0, 99), lista);
    assert.deepEqual(moveItem(lista, 99, 0), lista);
  });

  test("não modifica a lista original", () => {
    const original = ["a", "b", "c"];
    moveItem(original, 0, 2);
    assert.deepEqual(original, ["a", "b", "c"]);
  });

  test("lista vazia ou de um item não quebra", () => {
    assert.deepEqual(moveItem([], 0, 0), []);
    assert.deepEqual(moveItem(["só"], 0, 0), ["só"]);
  });
});

describe("Posições a gravar", () => {
  test("numera de 1 em diante, na ordem da lista", () => {
    // `position` começa em 1 no banco (a 001 grava `index + 1`), e uma
    // renumeração que começasse em 0 embaralharia a ordem de todo curso já
    // existente.
    assert.deepEqual(reorderPositions(["x", "y", "z"]), [
      { id: "x", position: 1 },
      { id: "y", position: 2 },
      { id: "z", position: 3 },
    ]);
  });

  test("lista vazia não gera atualização nenhuma", () => {
    assert.deepEqual(reorderPositions([]), []);
  });

  test("renumera sem buracos, mesmo vindo tortuoso", () => {
    // O banco pode ter posições 1, 5, 9 por causa de remoções antigas. Depois
    // de reordenar, precisa sair 1, 2, 3 — senão a próxima inserção calcula a
    // posição errada.
    const saida = reorderPositions(["a", "b", "c", "d"]);
    assert.deepEqual(
      saida.map((item) => item.position),
      [1, 2, 3, 4],
    );
  });
});
