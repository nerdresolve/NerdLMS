import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { completionSeconds, decideProgress } from "./progress-update.ts";
import { COMPLETION_THRESHOLD } from "./progress.ts";

const AULA = 600; // 10 minutos

describe("Avanço de progresso", () => {
  test("avançar grava a nova posição", () => {
    const decision = decideProgress({ lessonId: "l1", watchedSeconds: 120 }, AULA, 60);
    assert.equal(decision.accept, true);
    assert.equal(decision.accept && decision.watchedSeconds, 120);
  });

  test("o progresso nunca retrocede", () => {
    // Rever um trecho não pode apagar o que já foi assistido. Sem esta regra,
    // arrastar o vídeo para trás zeraria a conclusão.
    const decision = decideProgress({ lessonId: "l1", watchedSeconds: 30 }, AULA, 300);
    assert.equal(decision.accept, false);
    assert.equal(decision.accept === false && decision.reason, "no_progress");
  });

  test("a mesma posição não gera gravação", () => {
    // O player envia posição periodicamente; sem isto, o banco receberia
    // escrita a cada segundo de vídeo pausado.
    const decision = decideProgress({ lessonId: "l1", watchedSeconds: 300 }, AULA, 300);
    assert.equal(decision.accept, false);
    assert.equal(decision.accept === false && decision.reason, "no_progress");
  });

  test("a posição é limitada à duração da aula", () => {
    // Um cliente adulterado enviando 10 horas numa aula de 10 minutos ganharia
    // conclusão de graça, e o percentual do curso passaria de 100%.
    const decision = decideProgress({ lessonId: "l1", watchedSeconds: 36000 }, AULA, 0);
    assert.equal(decision.accept, true);
    assert.equal(decision.accept && decision.watchedSeconds, AULA);
  });

  test("90% conclui, 89% não", () => {
    const quase = Math.floor(AULA * COMPLETION_THRESHOLD) - 1;
    const passou = Math.ceil(AULA * COMPLETION_THRESHOLD);

    const a = decideProgress({ lessonId: "l1", watchedSeconds: quase }, AULA, 0);
    const b = decideProgress({ lessonId: "l1", watchedSeconds: passou }, AULA, 0);
    assert.equal(a.accept && a.completed, false);
    assert.equal(b.accept && b.completed, true);
  });

  test("entrada inválida é recusada, sem lançar", () => {
    for (const valor of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const decision = decideProgress({ lessonId: "l1", watchedSeconds: valor }, AULA, 0);
      assert.equal(decision.accept, false, String(valor));
      assert.equal(decision.accept === false && decision.reason, "invalid_input", String(valor));
    }
  });

  test("aula sem duração conhecida não aceita progresso", () => {
    // Duração zero viria de aula corrompida; aceitar dividiria por zero no
    // cálculo de percentual adiante.
    const decision = decideProgress({ lessonId: "l1", watchedSeconds: 10 }, 0, 0);
    assert.equal(decision.accept, false);
    assert.equal(decision.accept === false && decision.reason, "unknown_lesson");
  });

  test("a posição é arredondada para segundo inteiro", () => {
    const decision = decideProgress({ lessonId: "l1", watchedSeconds: 12.7 }, AULA, 0);
    assert.equal(decision.accept && decision.watchedSeconds, 13);
  });

  test("concluir registra a duração inteira, não o limiar", () => {
    // Gravar 90% faria a barra parar perto do fim para sempre.
    assert.equal(completionSeconds(AULA), AULA);
    assert.equal(completionSeconds(1799.6), 1800);
  });
});
