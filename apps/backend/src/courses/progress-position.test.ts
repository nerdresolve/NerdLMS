import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { decideProgress } from "@nerdlms/core/courses/progress-update.ts";

/**
 * A regra do retrocesso — F1-01.
 *
 * O caso de uso trata `no_progress` gravando só a posição. Estes testes fixam
 * a razão de isso ser necessário: `decideProgress` recusa o retrocesso, e essa
 * recusa é correta para o CONSUMO e errada para a POSIÇÃO.
 */

describe("Retroceder o vídeo não é avanço de consumo", () => {
  test("voltar para rever é recusado como progresso", () => {
    // Assistiu até 480s, voltou para 120s. O consumo não avançou.
    const d = decideProgress({ lessonId: "l1", watchedSeconds: 120 }, 600, 480);

    assert.equal(d.accept, false);
    assert.equal(d.accept === false && d.reason, "no_progress");
  });

  test("a mesma posição também não avança", () => {
    const d = decideProgress({ lessonId: "l1", watchedSeconds: 300 }, 600, 300);
    assert.equal(d.accept === false && d.reason, "no_progress");
  });

  test("avançar de verdade é aceito", () => {
    const d = decideProgress({ lessonId: "l1", watchedSeconds: 500 }, 600, 480);
    assert.equal(d.accept, true);
  });

  test("posição além do fim é limitada à duração", () => {
    // O teto que impede conclusão forjada por um POST com número grande.
    const d = decideProgress({ lessonId: "l1", watchedSeconds: 99999 }, 600, 0);
    assert.equal(d.accept === true && d.watchedSeconds, 600);
  });

  test("entrada inválida é rejeitada como erro, não como 'sem progresso'", () => {
    // A distinção importa: `no_progress` grava a posição, `invalid_input` não.
    for (const ruim of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const d = decideProgress({ lessonId: "l1", watchedSeconds: ruim }, 600, 0);
      assert.equal(d.accept, false);
      assert.notEqual(d.accept === false && d.reason, "no_progress");
    }
  });
});
