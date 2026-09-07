import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseTable } from "./csv-parse.ts";
import {
  MODELO_QUESTOES,
  parseGabarito,
  planQuestionsImport,
} from "./questions-import.ts";
import { toCsv } from "../reports/csv.ts";

function doCsv(texto: string) {
  return parseTable(texto).rows;
}

const CABECALHO = "Tipo;Enunciado;Pontos;Alternativa 1;Alternativa 2;Alternativa 3;Correta";

describe("Importação de questões: F5-05", () => {
  test("lê uma questão de escolha única", () => {
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nunica;Qual a capital?;1;Belo Horizonte;Brasília;Salvador;2`),
    );

    assert.equal(plano.criar, 1);
    const q = plano.linhas[0]!;
    assert.equal(q.tipo, "single_choice");
    assert.equal(q.alternativas.length, 3);
    assert.deepEqual(
      q.alternativas.map((a) => a.correta),
      [false, true, false],
    );
  });

  test("gabarito por letra, por número e com vários separadores", () => {
    assert.deepEqual(parseGabarito("2", 4), [1]);
    assert.deepEqual(parseGabarito("B", 4), [1]);
    assert.deepEqual(parseGabarito("1,3", 4), [0, 2]);
    assert.deepEqual(parseGabarito("A;C", 4), [0, 2]);
    assert.deepEqual(parseGabarito("1 e 4", 4), [0, 3]);

    /* Fora do intervalo não vira alternativa: `5` numa questão de 3 opções é
       erro de digitação, e aceitá-lo criaria gabarito apontando para o nada. */
    assert.deepEqual(parseGabarito("5", 3), []);
  });

  test("V/F cria as duas alternativas e aceita a palavra", () => {
    const plano = planQuestionsImport(
      doCsv("Tipo;Enunciado;Correta\r\nvf;A água ferve a 100 °C;verdadeiro"),
    );

    const q = plano.linhas[0]!;
    assert.equal(q.tipo, "true_false");
    assert.deepEqual(
      q.alternativas.map((a) => a.texto),
      ["Verdadeiro", "Falso"],
    );
    assert.equal(q.alternativas[0]!.correta, true);
    assert.equal(q.alternativas[1]!.correta, false);
  });

  test("dissertativa não exige alternativa nem gabarito", () => {
    /* Quem corrige é uma pessoa: exigir gabarito recusaria a questão pelo que
       ela é. */
    const plano = planQuestionsImport(
      doCsv("Tipo;Enunciado;Pontos\r\ndissertativa;Explique o ciclo da água;3"),
    );

    assert.equal(plano.criar, 1);
    assert.equal(plano.erros, 0);
    assert.equal(plano.linhas[0]!.tipo, "essay");
    assert.equal(plano.linhas[0]!.pontos, 3);
    assert.equal(plano.linhas[0]!.alternativas.length, 0);
  });

  test("questão objetiva sem gabarito é recusada", () => {
    /* Vale zero para todo mundo que responder — o erro só apareceria na
       correção, quando a prova já foi aplicada. */
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nunica;Qual a capital?;1;A;B;C;`),
    );

    assert.equal(plano.erros, 1);
    assert.match(plano.linhas[0]!.erro!, /gabarito/i);
  });

  test("escolha única com dois gabaritos é recusada, não adivinhada", () => {
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nunica;Qual a capital?;1;A;B;C;1,2`),
    );

    assert.equal(plano.erros, 1);
    assert.match(plano.linhas[0]!.erro!, /escolha única/i);
  });

  test("múltipla resposta aceita vários gabaritos", () => {
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nmultipla;Quais são estados?;2;SP;Brasília;RJ;1,3`),
    );

    assert.equal(plano.criar, 1);
    assert.equal(plano.linhas[0]!.tipo, "multiple_choice");
    assert.deepEqual(
      plano.linhas[0]!.alternativas.map((a) => a.correta),
      [true, false, true],
    );
  });

  test('"múltipla escolha" em português é UMA resposta certa', () => {
    /* É o sentido corrente: prova de marcar uma alternativa. Mapear para
       múltipla resposta mudaria como a questão é corrigida. */
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nmúltipla escolha;Qual a capital?;1;A;B;C;2`),
    );

    assert.equal(plano.linhas[0]!.tipo, "single_choice");
  });

  test("menos de duas alternativas é recusado", () => {
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nunica;Qual a capital?;1;Brasília;;;1`),
    );

    assert.equal(plano.erros, 1);
    assert.match(plano.linhas[0]!.erro!, /duas alternativas/i);
  });

  test("aceita colunas A, B, C como alternativas", () => {
    const plano = planQuestionsImport(
      doCsv("Tipo;Enunciado;A;B;C;Correta\r\nunica;Qual?;Um;Dois;Três;C"),
    );

    assert.equal(plano.criar, 1);
    assert.deepEqual(
      plano.linhas[0]!.alternativas.map((a) => a.texto),
      ["Um", "Dois", "Três"],
    );
    assert.equal(plano.linhas[0]!.alternativas[2]!.correta, true);
  });

  test("pontuação com vírgula decimal", () => {
    const plano = planQuestionsImport(
      doCsv("Tipo;Enunciado;Pontos;Correta\r\ndissertativa;Explique;2,5;"),
    );

    assert.equal(plano.linhas[0]!.pontos, 2.5);
  });

  test("pontuação inválida é recusada", () => {
    const plano = planQuestionsImport(
      doCsv("Tipo;Enunciado;Pontos;Correta\r\ndissertativa;Explique;zero;"),
    );

    assert.equal(plano.erros, 1);
    assert.match(plano.linhas[0]!.erro!, /número maior que zero/i);
  });

  test("tipo desconhecido é erro, não vira escolha única em silêncio", () => {
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nassociacao;Ligue as colunas;1;A;B;C;1`),
    );

    assert.equal(plano.erros, 1);
    assert.match(plano.linhas[0]!.erro!, /associacao/i);
  });

  test("sem tipo declarado vale escolha única", () => {
    const plano = planQuestionsImport(
      doCsv("Enunciado;Alternativa 1;Alternativa 2;Correta\r\nQual?;Sim;Não;1"),
    );

    assert.equal(plano.criar, 1);
    assert.equal(plano.linhas[0]!.tipo, "single_choice");
  });

  test("a linha citada é a que a pessoa vê no Excel", () => {
    const plano = planQuestionsImport(
      doCsv(`${CABECALHO}\r\nunica;Boa;1;A;B;C;1\r\nunica;Ruim;1;A;B;C;`),
    );

    assert.equal(plano.linhas[0]!.linha, 2);
    assert.equal(plano.linhas[1]!.linha, 3);
  });

  test("o modelo oferecido importa sem erro", () => {
    /* Um modelo que não passa na própria validação é uma armadilha. */
    const arquivo = toCsv(MODELO_QUESTOES.headers, MODELO_QUESTOES.exemplo);
    const plano = planQuestionsImport(doCsv(arquivo));

    assert.equal(plano.erros, 0);
    assert.equal(plano.criar, 4);

    /* E cobre os quatro tipos, que é o ponto de um modelo. */
    assert.deepEqual(
      plano.linhas.map((l) => l.tipo),
      ["single_choice", "multiple_choice", "true_false", "essay"],
    );
  });
});
