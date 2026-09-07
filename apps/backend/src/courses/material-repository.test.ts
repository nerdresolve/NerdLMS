import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { formatSize } from "./material-repository.ts";

describe("Tamanho legível do material", () => {
  test("abaixo de 1 MB mostra em KB", () => {
    assert.equal(formatSize(120 * 1024), "120 KB");
  });

  test("a partir de 1 MB mostra em MB, com uma casa", () => {
    assert.equal(formatSize(Math.round(2.4 * 1024 * 1024)), "2,4 MB");
  });

  test("usa vírgula decimal, não ponto", () => {
    // pt-BR. Um "2.4 MB" numa tela em português é ruído de localização.
    assert.ok(formatSize(Math.round(1.5 * 1024 * 1024)).includes(","));
  });

  test("arquivo minúsculo não vira 0 KB", () => {
    // Um anexo de 300 bytes existe e tem tamanho; exibir "0 KB" faria parecer
    // arquivo corrompido.
    assert.equal(formatSize(300), "1 KB");
  });

  test("tamanho inválido não quebra a tela", () => {
    // Vem de `bigint` convertido; dado velho ou importação podem trazer lixo.
    for (const ruim of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(formatSize(ruim), "0 KB");
    }
  });
});
