import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  alvoEmPalavras,
  chaveDoAlvo,
  matrizDeTreinamento,
  trilhaAlcanca,
} from "./alvo-da-trilha.ts";

describe("Alvo da trilha: a chave de comparação", () => {
  test("ignora caixa, acento e espaço em volta", () => {
    assert.equal(chaveDoAlvo("  Operador de Campo "), "operador de campo");
    assert.equal(chaveDoAlvo("OPERADOR DE CAMPO"), "operador de campo");
    assert.equal(chaveDoAlvo("Unidade Norte"), "unidade norte");
    assert.equal(chaveDoAlvo("UNIDADE NORTE"), "unidade norte");
  });

  test("vazio, só-espaços, nulo e ausente são a mesma coisa", () => {
    /* Os quatro significam "não informado". Tratar `" "` diferente de `null`
       faria uma trilha com um espaço no campo desaparecer sem explicação. */
    assert.equal(chaveDoAlvo(""), null);
    assert.equal(chaveDoAlvo("   "), null);
    assert.equal(chaveDoAlvo(null), null);
    assert.equal(chaveDoAlvo(undefined), null);
  });
});

describe("Alvo da trilha: quem a trilha alcança", () => {
  const operadorUnidadeNorte = { project: "Unidade Norte", jobTitle: "Operador de Campo" };
  const operadorRiachuelo = { project: "Riachuelo", jobTitle: "Operador de Campo" };
  const supervisorUnidadeNorte = { project: "Unidade Norte", jobTitle: "Supervisor" };

  test("sem local e sem função, alcança a organização inteira", () => {
    /* Campo em branco é ausência de filtro, não filtro que não casa. O inverso
       seria uma trilha nova invisível para todo mundo, sem nada explicando. */
    const geral = {};

    assert.ok(trilhaAlcanca(geral, operadorUnidadeNorte));
    assert.ok(trilhaAlcanca(geral, supervisorUnidadeNorte));
    assert.ok(trilhaAlcanca(geral, { project: null, jobTitle: null }));
  });

  test("só função: alcança a função em qualquer unidade", () => {
    const alvo = { jobTitle: "Operador de Campo" };

    assert.ok(trilhaAlcanca(alvo, operadorUnidadeNorte));
    assert.ok(trilhaAlcanca(alvo, operadorRiachuelo));
    assert.equal(trilhaAlcanca(alvo, supervisorUnidadeNorte), false);
  });

  test("só local: alcança qualquer função da unidade", () => {
    const alvo = { project: "Unidade Norte" };

    assert.ok(trilhaAlcanca(alvo, operadorUnidadeNorte));
    assert.ok(trilhaAlcanca(alvo, supervisorUnidadeNorte));
    assert.equal(trilhaAlcanca(alvo, operadorRiachuelo), false);
  });

  test("os dois: é o cruzamento, e só ele", () => {
    const alvo = { project: "Unidade Norte", jobTitle: "Operador de Campo" };

    assert.ok(trilhaAlcanca(alvo, operadorUnidadeNorte));
    assert.equal(trilhaAlcanca(alvo, operadorRiachuelo), false);
    assert.equal(trilhaAlcanca(alvo, supervisorUnidadeNorte), false);
  });

  test("quem está sem função não é alcançado por trilha de função", () => {
    const semFuncao = { project: "Unidade Norte", jobTitle: null };

    assert.equal(trilhaAlcanca({ jobTitle: "Operador de Campo" }, semFuncao), false);
    /* Mas continua recebendo o que vale para todos — é o que impede uma
       pendência de cadastro de deixar a pessoa sem treinamento nenhum. */
    assert.ok(trilhaAlcanca({}, semFuncao));
    assert.ok(trilhaAlcanca({ project: "Unidade Norte" }, semFuncao));
  });

  test("um espaço a mais no cadastro não some com a trilha", () => {
    const alvo = { project: " unidade norte ", jobTitle: "OPERADOR DE CAMPO" };
    assert.ok(trilhaAlcanca(alvo, operadorUnidadeNorte));
  });
});

describe("Alvo da trilha: como a tela descreve", () => {
  test("as quatro combinações têm frase própria", () => {
    assert.equal(alvoEmPalavras({}), "Toda a organização");
    assert.equal(alvoEmPalavras({ project: "Unidade Norte" }), "Qualquer função, em Unidade Norte");
    assert.equal(alvoEmPalavras({ jobTitle: "Operador" }), "Operador, em qualquer unidade");
    assert.equal(
      alvoEmPalavras({ project: "Unidade Norte", jobTitle: "Operador" }),
      "Operador · Unidade Norte",
    );
  });

  test("campo só com espaço conta como vazio também aqui", () => {
    assert.equal(alvoEmPalavras({ project: "  ", jobTitle: "  " }), "Toda a organização");
  });
});

describe("Matriz de treinamento", () => {
  const pessoas = [
    { id: "1", project: "Unidade Norte", jobTitle: "Operador de Campo" },
    { id: "2", project: "Riachuelo", jobTitle: "Operador de Campo" },
    { id: "3", project: "Unidade Norte", jobTitle: "Supervisor" },
    { id: "4", project: "Unidade Norte", jobTitle: null },
  ];

  const trilhas = [
    { title: "Integração", project: null, jobTitle: null },
    { title: "Operação segura", project: null, jobTitle: "Operador de Campo" },
    { title: "Permissão de trabalho", project: "Unidade Norte", jobTitle: "Supervisor" },
  ];

  test("uma linha por função, com a contagem de gente", () => {
    const matriz = matrizDeTreinamento(pessoas, trilhas);

    assert.equal(matriz.length, 3);
    assert.deepEqual(
      matriz.map((linha) => [linha.funcao, linha.pessoas]),
      [["Operador de Campo", 2], ["Supervisor", 1], [null, 1]],
    );
  });

  test("cada função vê o que a alcança", () => {
    const matriz = matrizDeTreinamento(pessoas, trilhas);
    const porFuncao = new Map(matriz.map((linha) => [linha.funcao, linha.trilhas]));

    assert.deepEqual(porFuncao.get("Operador de Campo"), ["Integração", "Operação segura"]);
    assert.deepEqual(porFuncao.get("Supervisor"), ["Integração", "Permissão de trabalho"]);
  });

  test("quem está sem função aparece, e por último", () => {
    /* É a linha que interessa a quem for arrumar o cadastro: essas pessoas só
       recebem as trilhas gerais. Escondê-las esconderia o problema. */
    const matriz = matrizDeTreinamento(pessoas, trilhas);
    const ultima = matriz[matriz.length - 1];

    assert.equal(ultima?.funcao, null);
    assert.deepEqual(ultima?.trilhas, ["Integração"]);
  });

  test("a função aparece como foi cadastrada, não normalizada", () => {
    const matriz = matrizDeTreinamento(
      [{ id: "1", jobTitle: "Operador de Campo" }, { id: "2", jobTitle: "operador de campo" }],
      [],
    );

    assert.equal(matriz.length, 1, "as duas grafias são a mesma função");
    assert.equal(matriz[0]?.funcao, "Operador de Campo");
    assert.equal(matriz[0]?.pessoas, 2);
  });

  test("sem trilha nenhuma, as linhas continuam existindo", () => {
    const matriz = matrizDeTreinamento(pessoas, []);

    assert.equal(matriz.length, 3);
    assert.ok(matriz.every((linha) => linha.trilhas.length === 0));
  });
});
