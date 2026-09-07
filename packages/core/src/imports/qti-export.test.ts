import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { escaparXml, letraDe, podeExportar, questaoParaQti, questoesParaQti } from "./qti-export.ts";
import { parseQtiItem, planQtiImport } from "./qti-import.ts";

function questao(over: Partial<Parameters<typeof questaoParaQti>[0]> = {}) {
  return {
    id: "3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071",
    kind: "single_choice",
    prompt: "Qual é o agente de desinfecção da água?",
    points: 2,
    explanation: "O cloro é o padrão no tratamento.",
    alternativas: [
      { texto: "Sulfato de alumínio", correta: false },
      { texto: "Cloro", correta: true },
      { texto: "Cal hidratada", correta: false },
    ],
    ...over,
  };
}

describe("QTI, a ida e a volta", () => {
  test("exportar e reimportar preserva a questão", () => {
    /* É o teste que dá sentido aos dois módulos: se o que sai não volta igual,
       a exportação é decorativa. */
    const original = questao();
    const xml = questaoParaQti(original);
    const devolta = parseQtiItem(xml, 1);

    assert.equal(devolta.situacao, "criar", devolta.erro ?? "");
    assert.equal(devolta.tipo, "single_choice");
    assert.equal(devolta.enunciado, original.prompt);
    assert.equal(devolta.pontos, original.points);
    assert.deepEqual(
      devolta.alternativas.map((a) => [a.texto, a.correta]),
      original.alternativas.map((a) => [a.texto, a.correta]),
    );
  });

  test("a explicação sobrevive à ida e à volta", () => {
    const devolta = parseQtiItem(questaoParaQti(questao()), 1);
    assert.match(devolta.explicacao ?? "", /cloro é o padrão/i);
  });

  test("múltipla resposta volta como múltipla resposta", () => {
    /* Com `cardinality="single"`, o destino aceitaria só a primeira marcada — e
       a questão passaria a ser corrigida errado. */
    const original = questao({
      kind: "multiple_choice",
      alternativas: [
        { texto: "Cloro", correta: true },
        { texto: "Ozônio", correta: true },
        { texto: "Areia", correta: false },
      ],
    });

    const devolta = parseQtiItem(questaoParaQti(original), 1);
    assert.equal(devolta.tipo, "multiple_choice");
    assert.equal(devolta.alternativas.filter((a) => a.correta).length, 2);
  });

  test("verdadeiro/falso volta como verdadeiro/falso", () => {
    const original = questao({
      kind: "true_false",
      alternativas: [
        { texto: "Verdadeiro", correta: true },
        { texto: "Falso", correta: false },
      ],
    });

    assert.equal(parseQtiItem(questaoParaQti(original), 1).tipo, "true_false");
  });

  test("a dissertativa volta como dissertativa", () => {
    const original = questao({ kind: "essay", alternativas: [] });
    const devolta = parseQtiItem(questaoParaQti(original), 1);

    assert.equal(devolta.tipo, "essay");
    assert.equal(devolta.alternativas.length, 0);
  });

  test("texto com caracteres de XML atravessa intacto", () => {
    /* `<`, `>` e `&` num enunciado de química ou matemática são comuns, e um
       escape errado quebra o arquivo inteiro no destino. */
    const original = questao({
      prompt: "A vazão é > 10 m³/h & a pressão < 2 bar?",
      alternativas: [
        { texto: '"Sim", disse o operador', correta: true },
        { texto: "Não & talvez", correta: false },
      ],
    });

    const devolta = parseQtiItem(questaoParaQti(original), 1);

    assert.equal(devolta.enunciado, original.prompt);
    assert.equal(devolta.alternativas[0]!.texto, '"Sim", disse o operador');
    assert.equal(devolta.alternativas[1]!.texto, "Não & talvez");
  });
});

describe("QTI, o banco inteiro", () => {
  test("várias questões num arquivo, e a volta reconhece todas", () => {
    const banco = [
      questao(),
      questao({ id: "aaaa1111-2222-3333-4444-555566667777", kind: "essay", alternativas: [] }),
    ];

    const { xml, exportadas, omitidas } = questoesParaQti(banco);

    assert.equal(exportadas, 2);
    assert.equal(omitidas, 0);

    const devolta = planQtiImport(xml);
    assert.equal(devolta.linhas.length, 2);
    assert.equal(devolta.criar, 2, devolta.linhas.map((l) => l.erro).join(" | "));
  });

  test("o que o QTI não representa é OMITIDO, não exportado torto", () => {
    /* Exportar uma questão de associação como escolha simples mudaria o que
       está sendo perguntado, e ninguém notaria até a correção. */
    const banco = [questao(), questao({ id: "b", kind: "matching", alternativas: [] })];
    const { exportadas, omitidas } = questoesParaQti(banco);

    assert.equal(exportadas, 1);
    assert.equal(omitidas, 1);
  });

  test("os tipos que o produto exporta", () => {
    assert.equal(podeExportar("single_choice"), true);
    assert.equal(podeExportar("essay"), true);
    assert.equal(podeExportar("matching"), false);
    assert.equal(podeExportar("ordering"), false);
  });
});

describe("QTI, detalhes que quebram em silêncio", () => {
  test("o escape de & vem primeiro", () => {
    /* Depois dos outros, transformaria o `&` que ele mesmo escreveu em
       `&amp;lt;`, e o destino mostraria `&lt;` literal na tela. */
    assert.equal(escaparXml("a < b & c"), "a &lt; b &amp; c");
  });

  test("as letras das alternativas não se repetem depois de Z", () => {
    /* Repetir "A" na alternativa 27 quebraria o gabarito em silêncio. */
    assert.equal(letraDe(0), "A");
    assert.equal(letraDe(25), "Z");
    assert.equal(letraDe(26), "AA");
    assert.equal(letraDe(27), "AB");

    const trinta = Array.from({ length: 30 }, (_, i) => letraDe(i));
    assert.equal(new Set(trinta).size, 30);
  });
});
