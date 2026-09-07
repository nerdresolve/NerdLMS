import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  canCompleteInteractive,
  checkAnswer,
  itemAtSecond,
  publicOptions,
  requiredCount,
  summarize,
  toPublicItem,
  type InteractiveContent,
  type InteractiveItem,
} from "./interactive.ts";

function item(over: Partial<InteractiveItem> = {}): InteractiveItem {
  return {
    id: "i1",
    position: 0,
    atSeconds: null,
    xPercent: null,
    yPercent: null,
    prompt: "Qual a pressão mínima na rede?",
    body: null,
    options: [],
    blocking: true,
    ...over,
  };
}

function content(over: Partial<InteractiveContent> = {}): InteractiveContent {
  return {
    id: "c1",
    kind: "interactive_video",
    title: "Operação de bombas",
    mediaUrl: "https://x/video.mp4",
    requiredInteractions: null,
    items: [],
    ...over,
  };
}

describe("Conteúdo interativo — F6-05", () => {
  test("o gabarito NUNCA vai para o navegador", () => {
    /* É a garantia que faz a interação valer alguma coisa: com o gabarito no
       HTML, a resposta certa apareceria no código-fonte da página. */
    const pergunta = item({
      options: [
        { text: "10 mca", correct: false, feedback: "Baixo demais." },
        { text: "15 mca", correct: true, feedback: "Isso." },
      ],
      body: "A NBR 12218 define 10 mca como mínimo dinâmico.",
    });

    const publico = toPublicItem(pergunta);
    const serializado = JSON.stringify(publico);

    assert.equal(serializado.includes("correct"), false);
    assert.equal(serializado.includes("Isso."), false);
    assert.equal(serializado.includes("NBR 12218"), false, "a explicação vazou antes de responder");

    /* Mas o texto das alternativas TEM de ir — sem ele não há o que escolher. */
    assert.deepEqual(publicOptions(pergunta), [{ text: "10 mca" }, { text: "15 mca" }]);
  });

  test("o verso do flashcard VAI — ele é o conteúdo, não o gabarito", () => {
    /* Esconder o verso tornaria o cartão inútil. */
    const cartao = item({ options: [], body: "Pressão mínima dinâmica: 10 mca." });

    assert.equal(toPublicItem(cartao).body, "Pressão mínima dinâmica: 10 mca.");
  });

  test("confere a resposta e devolve o feedback da alternativa escolhida", () => {
    const pergunta = item({
      options: [
        { text: "A", correct: false, feedback: "Reveja o módulo 2." },
        { text: "B", correct: true, feedback: "Correto." },
      ],
    });

    assert.deepEqual(checkAnswer(pergunta, "1"), { kind: "correct", feedback: "Correto." });
    assert.deepEqual(checkAnswer(pergunta, "0"), {
      kind: "incorrect",
      feedback: "Reveja o módulo 2.",
    });
  });

  test("índice inválido é resposta errada, não erro", () => {
    /* O cliente pode mandar qualquer coisa; responder 400 faria uma resposta
       absurda parecer falha da plataforma. */
    const pergunta = item({ options: [{ text: "A", correct: true }] });

    for (const resposta of ["99", "-1", "abc", "", null]) {
      assert.equal(checkAnswer(pergunta, resposta).kind, "incorrect");
    }
  });

  test("item sem alternativas é só reconhecido", () => {
    assert.deepEqual(checkAnswer(item({ options: [] }), null), { kind: "acknowledged" });
  });

  test("conclusão conta RESPONDIDAS, não acertadas", () => {
    /* O objetivo é aprender: quem errou e tentou de novo interagiu com o
       material. Exigir acerto transformaria a aula numa prova disfarçada. */
    const c = content({ items: [item({ id: "a" }), item({ id: "b" })] });

    const soErrou = [
      { itemId: "a", answer: "0", correct: false, attempts: 3 },
      { itemId: "b", answer: "1", correct: false, attempts: 1 },
    ];

    assert.deepEqual(canCompleteInteractive(c, soErrou), { allow: true });
  });

  test("faltando responder, diz quantas faltam", () => {
    const c = content({ items: [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })] });

    assert.deepEqual(
      canCompleteInteractive(c, [{ itemId: "a", answer: "0", correct: true, attempts: 1 }]),
      { allow: false, remaining: 2, total: 3 },
    );
  });

  test("mínimo parcial: responda 2 de 5", () => {
    const c = content({
      requiredInteractions: 2,
      items: ["a", "b", "c", "d", "e"].map((id) => item({ id })),
    });

    assert.equal(requiredCount(c), 2);
    assert.deepEqual(
      canCompleteInteractive(c, [
        { itemId: "a", answer: null, correct: null, attempts: 1 },
        { itemId: "b", answer: null, correct: null, attempts: 1 },
      ]),
      { allow: true },
    );
  });

  test("mínimo maior que o total não trava a aula", () => {
    /* Acontece quando alguém apaga itens depois de definir o mínimo. */
    const c = content({ requiredInteractions: 10, items: [item({ id: "a" })] });

    assert.equal(requiredCount(c), 1);
    assert.deepEqual(
      canCompleteInteractive(c, [{ itemId: "a", answer: null, correct: null, attempts: 1 }]),
      { allow: true },
    );
  });

  test("aula sem interação nenhuma conclui como qualquer outra", () => {
    assert.deepEqual(canCompleteInteractive(content({ items: [] }), []), { allow: true });
  });

  test("resposta de item apagado não faz a conta fechar", () => {
    /* Senão a aula concluiria por causa de conteúdo que ninguém vê mais. */
    const c = content({ items: [item({ id: "a" }), item({ id: "b" })] });

    const resposta = [
      { itemId: "a", answer: "0", correct: true, attempts: 1 },
      { itemId: "APAGADO", answer: "0", correct: true, attempts: 1 },
    ];

    assert.deepEqual(canCompleteInteractive(c, resposta), {
      allow: false,
      remaining: 1,
      total: 2,
    });
  });

  test("a pergunta do vídeo aparece mesmo depois de um salto", () => {
    /* O player reporta posição a cada segundo; um salto de 3s pularia a
       pergunta marcada no meio se a regra fosse "exatamente agora". */
    const c = content({
      items: [
        item({ id: "a", atSeconds: 30 }),
        item({ id: "b", atSeconds: 90 }),
        item({ id: "c", atSeconds: 150 }),
      ],
    });

    assert.equal(itemAtSecond(c, 10, new Set())?.id, undefined);
    assert.equal(itemAtSecond(c, 33, new Set())?.id, "a");

    /* Pulou de 10 para 95: a de 30 ainda aparece, porque não foi respondida. */
    assert.equal(itemAtSecond(c, 95, new Set())?.id, "a");
    assert.equal(itemAtSecond(c, 95, new Set(["a"]))?.id, "b");
    assert.equal(itemAtSecond(c, 95, new Set(["a", "b"])), null);
  });

  test("o percentual é sobre o EXIGIDO, não sobre o total", () => {
    /* Numa aula de "responda 3 de 10", responder 3 é 100% do que se pede.
       Mostrar 30% diria à pessoa que ela está atrasada quando já cumpriu. */
    const c = content({
      requiredInteractions: 3,
      items: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) => item({ id })),
    });

    const tres = ["a", "b", "c"].map((itemId) => ({
      itemId,
      answer: "0",
      correct: true,
      attempts: 1,
    }));

    const resumo = summarize(c, tres);
    assert.equal(resumo.percent, 100);
    assert.equal(resumo.total, 3);
    assert.equal(resumo.correct, 3);
  });

  test("responder mais que o exigido não passa de 100%", () => {
    const c = content({
      requiredInteractions: 2,
      items: ["a", "b", "c"].map((id) => item({ id })),
    });

    const todas = ["a", "b", "c"].map((itemId) => ({
      itemId,
      answer: "0",
      correct: false,
      attempts: 1,
    }));

    assert.equal(summarize(c, todas).percent, 100);
  });
});
