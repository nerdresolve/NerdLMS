import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { moveItem, reorderPositions } from "@nerdlms/core/courses/reorder.ts";

/**
 * A validação que protege a reordenação — F2-06.
 *
 * O caso de uso exige que a lista recebida seja uma permutação exata da atual.
 * Estes testes fixam o porquê, reproduzindo a mesma comparação.
 */

function mesmaColecao(atual: string[], recebida: string[]): boolean {
  if (atual.length !== recebida.length) return false;
  const conjunto = new Set(recebida);
  if (conjunto.size !== recebida.length) return false;
  return atual.every((id) => conjunto.has(id));
}

describe("A ordem recebida precisa ser uma permutação da atual", () => {
  const atual = ["a", "b", "c"];

  test("a mesma coleção em outra ordem é aceita", () => {
    assert.equal(mesmaColecao(atual, ["c", "a", "b"]), true);
  });

  test("id de outro curso é recusado", () => {
    // Sem esta checagem, um POST com o id de um módulo alheio o reposicionaria
    // — e a permissão sobre o curso próprio não teria impedido nada.
    assert.equal(mesmaColecao(atual, ["a", "b", "intruso"]), false);
  });

  test("id repetido é recusado", () => {
    // Dois iguais gravariam duas aulas na mesma posição, e a ordem do curso
    // passaria a depender do desempate do banco.
    assert.equal(mesmaColecao(atual, ["a", "a", "b"]), false);
  });

  test("faltando um item é recusado", () => {
    // A lista parcial deixaria o item de fora com a posição antiga, que agora
    // colide com outro.
    assert.equal(mesmaColecao(atual, ["a", "b"]), false);
  });

  test("lista maior é recusada", () => {
    assert.equal(mesmaColecao(atual, ["a", "b", "c", "d"]), false);
  });
});

describe("Mover e numerar, juntos", () => {
  test("subir a última aula produz as posições certas", () => {
    const depois = moveItem(["a1", "a2", "a3"], 2, 1);
    assert.deepEqual(reorderPositions(depois), [
      { id: "a1", position: 1 },
      { id: "a3", position: 2 },
      { id: "a2", position: 3 },
    ]);
  });

  test("a numeração começa em 1, como a 001 gravou", () => {
    const posicoes = reorderPositions(["x", "y"]);
    assert.equal(posicoes[0]?.position, 1);
  });
});
