import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  aproveitamentoPorTentativa,
  lerAproveitamento,
  type TentativaDoAluno,
} from "./aproveitamento.ts";

const passou = (na: number, tentativas = na): TentativaDoAluno => ({
  passouNa: na,
  tentativas,
});
const reprovou = (tentativas: number): TentativaDoAluno => ({ passouNa: null, tentativas });

describe("Aproveitamento por tentativa", () => {
  test("distribui pela tentativa em que cada um passou", () => {
    const r = aproveitamentoPorTentativa([
      passou(1),
      passou(1),
      passou(2),
      passou(3),
      reprovou(1),
    ]);

    const pessoasNa = (n: number | null) =>
      r.faixas.find((faixa) => faixa.tentativa === n)?.pessoas;

    assert.equal(pessoasNa(1), 2);
    assert.equal(pessoasNa(2), 1);
    assert.equal(pessoasNa(3), 1);
    assert.equal(pessoasNa(null), 1);
  });

  test("as faixas somam quem tentou", () => {
    /* Sem a faixa de quem não passou, a tabela não fecha, e quem lê procura o
       resto. */
    const r = aproveitamentoPorTentativa([passou(1), passou(2), reprovou(2), reprovou(1)]);
    const soma = r.faixas.reduce((total, faixa) => total + faixa.pessoas, 0);
    assert.equal(soma, r.tentaram);
  });

  test("quem nunca tentou fica de fora da conta", () => {
    /* Matriculado que não abriu a prova não é reprovado. Contá-lo derrubaria a
       taxa de aprovação sem nenhum aluno ter ido mal. */
    const r = aproveitamentoPorTentativa([passou(1), { passouNa: null, tentativas: 0 }]);
    assert.equal(r.tentaram, 1);
    assert.equal(r.taxaDeAprovacao, 100);
  });

  test("as três primeiras faixas aparecem mesmo zeradas", () => {
    /* Omitir a faixa vazia faz "ninguém passou de primeira" parecer com "a
       métrica não existe". */
    const r = aproveitamentoPorTentativa([passou(3)]);
    assert.deepEqual(
      r.faixas.map((faixa) => faixa.tentativa),
      [1, 2, 3, null],
    );
  });

  test("a faixa aberta só aparece quando tem gente nela", () => {
    const sem = aproveitamentoPorTentativa([passou(1)]);
    assert.ok(!sem.faixas.some((faixa) => faixa.tentativa === 4));

    const com = aproveitamentoPorTentativa([passou(5)]);
    const aberta = com.faixas.find((faixa) => faixa.tentativa === 4);
    assert.equal(aberta?.pessoas, 1);
    assert.match(aberta?.rotulo ?? "", /4ª em diante/);
  });

  test("a média conta só quem passou", () => {
    /* Incluir quem ainda deve a prova misturaria "gastou três e conseguiu" com
       "gastou três e continua devendo". */
    const r = aproveitamentoPorTentativa([passou(1), passou(3), reprovou(9)]);
    assert.equal(r.mediaAteAprovar, 2);
  });

  test("sem ninguém, nada explode e tudo é zero", () => {
    const r = aproveitamentoPorTentativa([]);
    assert.equal(r.tentaram, 0);
    assert.equal(r.taxaDeAprovacao, 0);
    assert.equal(r.mediaAteAprovar, 0);
    assert.equal(r.faixas.every((faixa) => faixa.pessoas === 0), true);
  });
});

describe("A leitura do aproveitamento", () => {
  test("com poucos dados, não arrisca leitura", () => {
    /* Quatro pessoas não sustentam conclusão sobre calibragem de prova. */
    const r = aproveitamentoPorTentativa([passou(1), passou(1), passou(1), reprovou(1)]);
    assert.equal(lerAproveitamento(r), null);
  });

  test("quase todos de primeira sugere prova fácil demais", () => {
    const alunos = Array.from({ length: 10 }, () => passou(1));
    const texto = lerAproveitamento(aproveitamentoPorTentativa(alunos));
    assert.match(texto ?? "", /primeira tentativa/);
  });

  test("poucos de primeira e muitos depois aponta para a aula", () => {
    /* É a leitura que o número sozinho esconde: 80% de aprovação parecendo
       saudável enquanto quase ninguém passa sem refazer. */
    const alunos = [...Array.from({ length: 3 }, () => passou(1)), ...Array.from({ length: 7 }, () => passou(2))];
    const texto = lerAproveitamento(aproveitamentoPorTentativa(alunos));
    assert.match(texto ?? "", /não prepara para a prova/);
  });

  test("aprovação baixa aponta para prova e conteúdo, não para o aluno", () => {
    const alunos = [...Array.from({ length: 3 }, () => passou(1)), ...Array.from({ length: 7 }, () => reprovou(1))];
    const texto = lerAproveitamento(aproveitamentoPorTentativa(alunos));
    assert.match(texto ?? "", /revisar a prova/);
  });
});
