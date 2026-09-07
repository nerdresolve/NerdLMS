import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { gradeAnswer, type GradableQuestion } from "./grading.ts";

/**
 * Correção automática — F3-04.
 *
 * Sete dos oito tipos corrigem sozinhos; a dissertativa vai para correção
 * manual. Cada caso aqui é uma decisão sobre o que conta como acerto.
 */

const questao = (over: Partial<GradableQuestion>): GradableQuestion => ({
  id: "q1",
  kind: "single_choice",
  points: 10,
  options: [],
  ...over,
});

describe("Múltipla escolha (uma correta)", () => {
  const q = questao({
    kind: "single_choice",
    options: [
      { id: "a", text: "Certa", isCorrect: true, position: 1 },
      { id: "b", text: "Errada", isCorrect: false, position: 2 },
    ],
  });

  test("a certa vale tudo", () => {
    assert.equal(gradeAnswer(q, ["a"]).points, 10);
  });

  test("a errada vale zero", () => {
    assert.equal(gradeAnswer(q, ["b"]).points, 0);
  });

  test("sem resposta vale zero", () => {
    assert.equal(gradeAnswer(q, null).points, 0);
  });

  test("marcar duas numa questão de uma resposta é erro", () => {
    // Não é "acertou parcialmente": a questão pede UMA, e marcar todas seria a
    // forma trivial de sempre acertar.
    assert.equal(gradeAnswer(q, ["a", "b"]).points, 0);
  });
});

describe("Múltiplas respostas", () => {
  const q = questao({
    kind: "multiple_choice",
    points: 12,
    options: [
      { id: "a", text: "Certa 1", isCorrect: true, position: 1 },
      { id: "b", text: "Certa 2", isCorrect: true, position: 2 },
      { id: "c", text: "Errada", isCorrect: false, position: 3 },
    ],
  });

  test("todas as certas, nenhuma errada, vale tudo", () => {
    assert.equal(gradeAnswer(q, ["a", "b"]).points, 12);
  });

  test("acerto parcial vale proporcional", () => {
    // Uma de duas certas = metade. O parcial existe porque exigir tudo-ou-nada
    // numa questão de cinco alternativas pune quem sabe quase tudo igual a
    // quem não sabe nada.
    assert.equal(gradeAnswer(q, ["a"]).points, 6);
  });

  test("marcar uma errada DESCONTA", () => {
    // Sem desconto, marcar todas as alternativas garantiria nota cheia.
    // Uma certa (+0.5) menos uma errada (-0.5) = zero.
    assert.equal(gradeAnswer(q, ["a", "c"]).points, 0);
  });

  test("nunca fica negativo", () => {
    // Duas erradas não podem gerar nota negativa que contamine a prova.
    const comMaisErradas = questao({
      kind: "multiple_choice",
      points: 10,
      options: [
        { id: "a", text: "Certa", isCorrect: true, position: 1 },
        { id: "b", text: "Errada", isCorrect: false, position: 2 },
        { id: "c", text: "Errada", isCorrect: false, position: 3 },
      ],
    });

    assert.equal(gradeAnswer(comMaisErradas, ["b", "c"]).points, 0);
  });

  test("marcar todas não garante nota", () => {
    assert.equal(gradeAnswer(q, ["a", "b", "c"]).points, 6);
  });
});

describe("Verdadeiro ou falso", () => {
  const q = questao({
    kind: "true_false",
    points: 5,
    options: [
      { id: "v", text: "Verdadeiro", isCorrect: true, position: 1 },
      { id: "f", text: "Falso", isCorrect: false, position: 2 },
    ],
  });

  test("acerta", () => assert.equal(gradeAnswer(q, ["v"]).points, 5));
  test("erra", () => assert.equal(gradeAnswer(q, ["f"]).points, 0));
});

describe("Resposta curta", () => {
  const q = questao({
    kind: "short_answer",
    points: 8,
    options: [
      { id: "a", text: "cloro", isCorrect: true, position: 1 },
      { id: "b", text: "hipoclorito", isCorrect: true, position: 2 },
    ],
  });

  test("qualquer resposta aceita vale tudo", () => {
    assert.equal(gradeAnswer(q, "cloro").points, 8);
    assert.equal(gradeAnswer(q, "hipoclorito").points, 8);
  });

  test("ignora caixa e espaço nas pontas", () => {
    // Punir por "  Cloro " seria avaliar digitação, não conhecimento.
    assert.equal(gradeAnswer(q, "  CLORO  ").points, 8);
  });

  test("ignora acento", () => {
    // Teclado sem acento é comum em campo.
    const comAcento = questao({
      kind: "short_answer",
      points: 8,
      options: [{ id: "a", text: "válvula", isCorrect: true, position: 1 }],
    });

    assert.equal(gradeAnswer(comAcento, "valvula").points, 8);
  });

  test("resposta diferente vale zero", () => {
    assert.equal(gradeAnswer(q, "flúor").points, 0);
  });

  test("vazio vale zero", () => {
    assert.equal(gradeAnswer(q, "   ").points, 0);
  });
});

describe("Numérica", () => {
  const q = questao({
    kind: "numeric",
    points: 10,
    tolerance: 0.5,
    options: [{ id: "a", text: "7.2", isCorrect: true, position: 1 }],
  });

  test("o valor exato acerta", () => {
    assert.equal(gradeAnswer(q, 7.2).points, 10);
  });

  test("dentro da tolerância acerta", () => {
    // Sem tolerância, 3.14 seria errado para 3.14159 e a questão numérica
    // ficaria inutilizável fora de inteiros.
    assert.equal(gradeAnswer(q, 7.5).points, 10);
    assert.equal(gradeAnswer(q, 6.7).points, 10);
  });

  test("fora da tolerância erra", () => {
    assert.equal(gradeAnswer(q, 8.0).points, 0);
  });

  test("sem tolerância declarada, exige o valor exato", () => {
    const exata = questao({
      kind: "numeric",
      points: 10,
      options: [{ id: "a", text: "42", isCorrect: true, position: 1 }],
    });

    assert.equal(gradeAnswer(exata, 42).points, 10);
    assert.equal(gradeAnswer(exata, 42.1).points, 0);
  });

  test("texto no lugar de número vale zero, sem quebrar", () => {
    assert.equal(gradeAnswer(q, "sete" as unknown as number).points, 0);
  });

  test("aceita vírgula decimal", () => {
    // pt-BR: quem digita "7,2" quis dizer 7.2.
    assert.equal(gradeAnswer(q, "7,2" as unknown as number).points, 10);
  });
});

describe("Associação", () => {
  const q = questao({
    kind: "matching",
    points: 9,
    options: [
      { id: "a", text: "Cloro", matchText: "Desinfecção", isCorrect: true, position: 1 },
      { id: "b", text: "Flúor", matchText: "Prevenção de cárie", isCorrect: true, position: 2 },
      { id: "c", text: "Cal", matchText: "Correção de pH", isCorrect: true, position: 3 },
    ],
  });

  test("todos os pares certos valem tudo", () => {
    assert.equal(
      gradeAnswer(q, { a: "Desinfecção", b: "Prevenção de cárie", c: "Correção de pH" }).points,
      9,
    );
  });

  test("acerto parcial vale proporcional", () => {
    assert.equal(gradeAnswer(q, { a: "Desinfecção", b: "Correção de pH", c: "" }).points, 3);
  });

  test("nada certo vale zero", () => {
    assert.equal(gradeAnswer(q, { a: "x", b: "y", c: "z" }).points, 0);
  });
});

describe("Ordenação", () => {
  const q = questao({
    kind: "ordering",
    points: 12,
    options: [
      { id: "a", text: "Captação", isCorrect: true, position: 1 },
      { id: "b", text: "Tratamento", isCorrect: true, position: 2 },
      { id: "c", text: "Distribuição", isCorrect: true, position: 3 },
    ],
  });

  test("a ordem certa vale tudo", () => {
    assert.equal(gradeAnswer(q, ["a", "b", "c"]).points, 12);
  });

  test("ordem errada vale zero", () => {
    // Ordenação é tudo-ou-nada: uma sequência "quase certa" não descreve um
    // processo que funciona. Tratar antes de captar não é 66% correto.
    assert.equal(gradeAnswer(q, ["b", "a", "c"]).points, 0);
  });

  test("lista incompleta vale zero", () => {
    assert.equal(gradeAnswer(q, ["a", "b"]).points, 0);
  });
});

describe("Dissertativa", () => {
  const q = questao({ kind: "essay", points: 20, options: [] });

  test("não corrige sozinha, vai para revisão", () => {
    const r = gradeAnswer(q, "Um texto qualquer.");
    assert.equal(r.needsReview, true);
    assert.equal(r.points, null);
  });

  test("resposta vazia também vai para revisão", () => {
    // Quem não escreveu nada tira zero, mas quem decide é o corretor: um
    // automático dando zero impediria o instrutor de ver que a pessoa tentou.
    assert.equal(gradeAnswer(q, "").needsReview, true);
  });
});

describe("O que a correção nunca faz", () => {
  test("resposta com formato errado não quebra a prova inteira", () => {
    // O cliente pode mandar qualquer coisa; um erro aqui derrubaria o envio de
    // uma prova já respondida.
    const q = questao({
      kind: "single_choice",
      options: [{ id: "a", text: "Certa", isCorrect: true, position: 1 }],
    });

    assert.equal(gradeAnswer(q, { formato: "errado" } as unknown as string[]).points, 0);
    assert.equal(gradeAnswer(q, 42 as unknown as string[]).points, 0);
  });

  test("questão sem alternativa correta vale zero, não a nota cheia", () => {
    // Questão mal cadastrada não pode virar ponto de graça.
    const semGabarito = questao({
      kind: "single_choice",
      options: [{ id: "a", text: "Única", isCorrect: false, position: 1 }],
    });

    assert.equal(gradeAnswer(semGabarito, ["a"]).points, 0);
  });
});
