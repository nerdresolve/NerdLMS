import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  canStartAttempt,
  deadlineFor,
  escolhaDaTentativa,
  finalScore,
  isExpired,
  shuffleWithSeed,
  type QuizSettings,
  type TentativaRegistrada,
} from "./quiz-rules.ts";

const prova = (over: Partial<QuizSettings> = {}): QuizSettings => ({
  passingScore: 70,
  gradingMethod: "best",
  graceMinutes: 0,
  ...over,
});

const AGORA = new Date("2026-03-15T14:00:00Z");

describe("Quando se pode começar uma tentativa", () => {
  test("prova sem janela nem limite aceita", () => {
    assert.equal(canStartAttempt(prova(), 0, AGORA).allow, true);
  });

  test("antes da abertura, recusa", () => {
    const p = prova({ opensAt: "2026-03-20T00:00:00Z" });
    const d = canStartAttempt(p, 0, AGORA);
    assert.equal(d.allow === false && d.reason, "not_open");
  });

  test("depois do fechamento, recusa", () => {
    const p = prova({ closesAt: "2026-03-10T00:00:00Z" });
    const d = canStartAttempt(p, 0, AGORA);
    assert.equal(d.allow === false && d.reason, "closed");
  });

  test("dentro da janela, aceita", () => {
    const p = prova({ opensAt: "2026-03-01T00:00:00Z", closesAt: "2026-03-20T00:00:00Z" });
    assert.equal(canStartAttempt(p, 0, AGORA).allow, true);
  });

  test("o grace period estende o fechamento", () => {
    // O guia pede grace period: quem chega no limite não perde a prova por um
    // minuto de relógio.
    const p = prova({ closesAt: "2026-03-15T13:50:00Z", graceMinutes: 15 });
    assert.equal(canStartAttempt(p, 0, AGORA).allow, true);
  });

  test("passado o grace, recusa mesmo assim", () => {
    const p = prova({ closesAt: "2026-03-15T13:40:00Z", graceMinutes: 15 });
    assert.equal(canStartAttempt(p, 0, AGORA).allow, false);
  });

  test("tentativas esgotadas, recusa", () => {
    const d = canStartAttempt(prova({ maxAttempts: 3 }), 3, AGORA);
    assert.equal(d.allow === false && d.reason, "no_attempts_left");
  });

  test("ainda resta tentativa, aceita", () => {
    assert.equal(canStartAttempt(prova({ maxAttempts: 3 }), 2, AGORA).allow, true);
  });

  test("sem limite de tentativas, sempre aceita", () => {
    assert.equal(canStartAttempt(prova(), 99, AGORA).allow, true);
  });

  test("fechada E esgotada informa o fechamento", () => {
    // "Sem tentativas" sugeriria que esperar não resolve; a prova fechada é
    // informação mais útil.
    const p = prova({ closesAt: "2026-03-01T00:00:00Z", maxAttempts: 1 });
    const d = canStartAttempt(p, 1, AGORA);
    assert.equal(d.allow === false && d.reason, "closed");
  });
});

describe("Prazo da tentativa", () => {
  test("sem limite de tempo, não há prazo", () => {
    assert.equal(deadlineFor(prova(), AGORA), null);
  });

  test("o prazo é o início mais o limite", () => {
    const p = prova({ timeLimitMinutes: 30 });
    assert.equal(deadlineFor(p, AGORA)?.toISOString(), "2026-03-15T14:30:00.000Z");
  });

  test("o fechamento da prova encurta o prazo", () => {
    // Começar 30 minutos antes de fechar não dá 60 minutos de prova.
    const p = prova({ timeLimitMinutes: 60, closesAt: "2026-03-15T14:30:00Z" });
    assert.equal(deadlineFor(p, AGORA)?.toISOString(), "2026-03-15T14:30:00.000Z");
  });

  test("o grace period entra no prazo", () => {
    const p = prova({ timeLimitMinutes: 60, closesAt: "2026-03-15T14:30:00Z", graceMinutes: 10 });
    assert.equal(deadlineFor(p, AGORA)?.toISOString(), "2026-03-15T14:40:00.000Z");
  });
});

describe("Tentativa expirada", () => {
  const inicio = new Date("2026-03-15T14:00:00Z");

  test("dentro do tempo, não expirou", () => {
    const p = prova({ timeLimitMinutes: 30 });
    assert.equal(isExpired(p, inicio, new Date("2026-03-15T14:20:00Z")), false);
  });

  test("passado o tempo, expirou", () => {
    const p = prova({ timeLimitMinutes: 30 });
    assert.equal(isExpired(p, inicio, new Date("2026-03-15T14:31:00Z")), true);
  });

  test("sem limite, nunca expira", () => {
    assert.equal(isExpired(prova(), inicio, new Date("2027-01-01T00:00:00Z")), false);
  });
});

describe("Nota final entre tentativas", () => {
  const notas = [40, 85, 60];

  test("melhor", () => {
    assert.equal(finalScore(notas, "best"), 85);
  });

  test("última", () => {
    assert.equal(finalScore(notas, "last"), 60);
  });

  test("primeira", () => {
    assert.equal(finalScore(notas, "first"), 40);
  });

  test("média", () => {
    assert.equal(finalScore(notas, "average"), 61.67);
  });

  test("sem tentativa nenhuma, não há nota", () => {
    // Zero seria uma reprovação de quem não fez a prova — coisas diferentes.
    assert.equal(finalScore([], "best"), null);
  });
});

describe("Randomização estável", () => {
  test("a mesma semente dá a mesma ordem", () => {
    // A ordem precisa sobreviver a recarregar a página: sem isso, a questão 3
    // vira outra ao atualizar, e quem respondeu perde a referência.
    const a = shuffleWithSeed(["1", "2", "3", "4", "5"], "tentativa-abc");
    const b = shuffleWithSeed(["1", "2", "3", "4", "5"], "tentativa-abc");
    assert.deepEqual(a, b);
  });

  test("sementes diferentes dão ordens diferentes", () => {
    const a = shuffleWithSeed(["1", "2", "3", "4", "5", "6"], "tentativa-1");
    const b = shuffleWithSeed(["1", "2", "3", "4", "5", "6"], "tentativa-2");
    assert.notDeepEqual(a, b);
  });

  test("não perde nem duplica item", () => {
    const original = ["a", "b", "c", "d", "e"];
    const embaralhado = shuffleWithSeed(original, "x");

    assert.equal(embaralhado.length, original.length);
    assert.deepEqual([...embaralhado].sort(), [...original].sort());
  });

  test("lista vazia ou de um item não quebra", () => {
    assert.deepEqual(shuffleWithSeed([], "x"), []);
    assert.deepEqual(shuffleWithSeed(["só"], "x"), ["só"]);
  });
});

describe("escolhaDaTentativa: o teto que a corrida furava", () => {
  const AGORA = new Date("2026-03-10T12:00:00Z");

  /** Uma prova com uma tentativa e uma hora de cronômetro. */
  const PROVA = prova({ maxAttempts: 1, timeLimitMinutes: 60 });

  function enviada(minutosAtras: number): TentativaRegistrada {
    const inicio = new Date(AGORA.getTime() - minutosAtras * 60_000);
    return { startedAt: inicio, submittedAt: new Date(inicio.getTime() + 60_000) };
  }

  test("sem tentativa nenhuma, cria", () => {
    assert.equal(escolhaDaTentativa(PROVA, [], AGORA), "nova");
  });

  test("com o teto gasto, recusa", () => {
    assert.equal(escolhaDaTentativa(PROVA, [enviada(120)], AGORA), null);
  });

  test("A CORRIDA: com o teto gasto, nenhuma leitura concorrente cria", () => {
    /* Este é o teste que o defeito não tinha. Dezesseis pedidos disparados na
       mesma barreira criaram CINCO tentativas porque cada um contou antes de
       qualquer inserção. Agora a decisão roda dentro da trava, relendo — e a
       relei­tura é esta lista, que já tem a tentativa gasta. Se algum dia ela
       voltar a devolver "nova" aqui, o teto voltou a ser opcional. */
    const gastas = [enviada(120)];

    for (let pedido = 0; pedido < 16; pedido += 1) {
      assert.equal(escolhaDaTentativa(PROVA, gastas, AGORA), null, `pedido ${pedido}`);
    }
  });

  test("tentativa aberta e no prazo volta ELA, sem criar outra", () => {
    const aberta: TentativaRegistrada = { startedAt: new Date(AGORA.getTime() - 10 * 60_000) };
    assert.equal(escolhaDaTentativa(PROVA, [aberta], AGORA), aberta);
  });

  test("recarregar a página dezesseis vezes devolve sempre a MESMA tentativa", () => {
    const aberta: TentativaRegistrada = { startedAt: new Date(AGORA.getTime() - 10 * 60_000) };

    for (let pedido = 0; pedido < 16; pedido += 1) {
      assert.equal(escolhaDaTentativa(PROVA, [aberta], AGORA), aberta, `pedido ${pedido}`);
    }
  });

  test("abandonada e vencida não consome a chance", () => {
    /* Começou há duas horas numa prova de uma hora e nunca enviou: o prazo
       venceu. Não houve envio, então a chance continua de pé. */
    const vencida: TentativaRegistrada = { startedAt: new Date(AGORA.getTime() - 120 * 60_000) };
    assert.equal(escolhaDaTentativa(PROVA, [vencida], AGORA), "nova");
  });

  test("o reteste aprovado entra como teto maior, e vale uma vez só", () => {
    const comReteste = prova({ maxAttempts: 2, timeLimitMinutes: 60 });

    assert.equal(escolhaDaTentativa(comReteste, [enviada(120)], AGORA), "nova");
    assert.equal(escolhaDaTentativa(comReteste, [enviada(120), enviada(100)], AGORA), null);
  });
});
