import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  decideConfirm,
  descrever,
  estimateFromPages,
  estimateFromWords,
} from "./reading-time.ts";

describe("Tempo de leitura — a estimativa", () => {
  test("200 palavras dão um minuto", () => {
    assert.equal(estimateFromWords(200).seconds, 60);
  });

  test("uma página vale 300 palavras", () => {
    assert.equal(estimateFromPages(1).seconds, estimateFromWords(300).seconds);
  });

  test("dez páginas dão quinze minutos", () => {
    assert.equal(estimateFromPages(10).seconds, 900);
  });

  test("documento vazio não estima nada", () => {
    assert.equal(estimateFromWords(0).seconds, 0);
    assert.equal(estimateFromPages(0).seconds, 0);
  });

  test("número negativo não vira tempo negativo", () => {
    assert.equal(estimateFromPages(-5).seconds, 0);
  });
});

describe("Tempo de leitura — como o tempo é dito", () => {
  test("abaixo de um minuto não recebe número", () => {
    /* "cerca de 0 minutos" não diz nada a ninguém. */
    assert.equal(descrever(30), "menos de um minuto");
  });

  test("arredonda para cima, em minutos", () => {
    /* É uma estimativa e deve soar como uma. "2 minutos e 47 segundos" daria
       uma precisão que o cálculo não tem. */
    assert.equal(descrever(167), "cerca de 3 minutos");
    assert.equal(descrever(60), "cerca de 1 minuto");
  });

  test("acima de uma hora, muda a unidade", () => {
    assert.equal(descrever(3600), "cerca de 1 hora");
    assert.equal(descrever(7200), "cerca de 2 horas");
    assert.equal(descrever(5400), "cerca de 1h30");
  });
});

describe("Tempo de leitura — quando perguntar", () => {
  const dezMinutos = estimateFromPages(20);

  test("quem concluiu em trinta segundos é perguntado", () => {
    const r = decideConfirm(30, dezMinutos, true);

    assert.equal(r.confirm, true);
    assert.match(r.message, /tempo estimado de leitura/i);
    assert.match(r.message, /certeza/i);
  });

  test("quem passou metade do tempo estimado não é perguntado", () => {
    /* O cálculo já é conservador. Perguntar a quem leu rápido seria duvidar
       de quem fez o esperado. */
    const r = decideConfirm(dezMinutos.seconds * 0.6, dezMinutos, true);
    assert.equal(r.confirm, false);
  });

  test("com a funcionalidade desligada, nunca pergunta", () => {
    assert.equal(decideConfirm(1, dezMinutos, false).confirm, false);
  });

  test("documento sem estimativa não gera pergunta", () => {
    /* Sem páginas nem palavras, não há o que estimar — e uma pergunta sem
       número seria um obstáculo sem informação. */
    assert.equal(decideConfirm(1, estimateFromPages(0), true).confirm, false);
  });

  test("a mensagem traz o tempo, não o percentual", () => {
    /* "Você leu 12% do tempo estimado" é sobre a métrica; "o tempo estimado é
       de 15 minutos" é sobre o documento. */
    const r = decideConfirm(10, estimateFromPages(10), true);

    assert.match(r.message, /15 minutos/);
    assert.ok(!r.message.includes("%"));
  });
});
