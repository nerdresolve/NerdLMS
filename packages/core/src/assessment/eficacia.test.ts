import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ALERTA_EM_DIAS,
  PRAZO_DA_AVALIACAO_DIAS,
  diasRestantes,
  ehVeredito,
  ordemDaFila,
  prazoDaAvaliacao,
  prazoEmPalavras,
  situacaoDaEficacia,
} from "./eficacia.ts";

const dia = (n: number) => new Date(2026, 0, n, 12, 0, 0);

describe("Avaliação de eficácia: prazo", () => {
  test("o prazo é a conclusão mais os dias da regra", () => {
    const concluidoEm = new Date("2026-01-01T12:00:00Z");
    const prazo = prazoDaAvaliacao(concluidoEm);

    const dias = (prazo.getTime() - concluidoEm.getTime()) / (24 * 60 * 60 * 1000);
    assert.equal(dias, PRAZO_DA_AVALIACAO_DIAS);
  });

  test("no dia da conclusão faltam os 90 dias inteiros", () => {
    const concluidoEm = new Date("2026-01-01T12:00:00Z");
    assert.equal(diasRestantes({ concluidoEm, hoje: concluidoEm }), PRAZO_DA_AVALIACAO_DIAS);
  });

  test("fração de dia conta como dia inteiro", () => {
    /* Quem lê "faltam 0 dias" entende que perdeu o prazo. Enquanto sobrar
       qualquer tempo, sobra ao menos um dia. */
    const concluidoEm = new Date("2026-01-01T12:00:00Z");
    const quaseNoPrazo = new Date(prazoDaAvaliacao(concluidoEm).getTime() - 60 * 1000);

    assert.equal(diasRestantes({ concluidoEm, hoje: quaseNoPrazo }), 1);
  });

  test("passado o prazo, os dias ficam negativos", () => {
    const concluidoEm = new Date("2026-01-01T12:00:00Z");
    const depois = new Date(prazoDaAvaliacao(concluidoEm).getTime() + 3 * 24 * 60 * 60 * 1000);

    assert.equal(diasRestantes({ concluidoEm, hoje: depois }), -3);
  });
});

describe("Avaliação de eficácia: situação", () => {
  const concluidoEm = new Date("2026-01-01T12:00:00Z");
  const emDias = (n: number) => new Date(concluidoEm.getTime() + n * 24 * 60 * 60 * 1000);

  test("recém-concluída fica no prazo", () => {
    assert.equal(situacaoDaEficacia({ concluidoEm, hoje: emDias(1) }), "no-prazo");
  });

  test("entra em alerta quando faltam os dias da regra", () => {
    const hoje = emDias(PRAZO_DA_AVALIACAO_DIAS - ALERTA_EM_DIAS);
    assert.equal(situacaoDaEficacia({ concluidoEm, hoje }), "vence-em-breve");
  });

  test("um dia antes do alerta ainda está no prazo", () => {
    const hoje = emDias(PRAZO_DA_AVALIACAO_DIAS - ALERTA_EM_DIAS - 1);
    assert.equal(situacaoDaEficacia({ concluidoEm, hoje }), "no-prazo");
  });

  test("vence quando o prazo passa", () => {
    assert.equal(
      situacaoDaEficacia({ concluidoEm, hoje: emDias(PRAZO_DA_AVALIACAO_DIAS + 1) }),
      "vencida",
    );
  });

  test("avaliada em atraso continua avaliada", () => {
    /* Registrar fora do prazo é melhor que não registrar, e apagar por causa
       da data destruiria justamente a evidência. O atraso aparece na data. */
    const situacao = situacaoDaEficacia({
      concluidoEm,
      avaliadoEm: emDias(PRAZO_DA_AVALIACAO_DIAS + 30),
      hoje: emDias(PRAZO_DA_AVALIACAO_DIAS + 40),
    });

    assert.equal(situacao, "avaliada");
  });
});

describe("Avaliação de eficácia: como a fila fala", () => {
  const concluidoEm = new Date("2026-01-01T12:00:00Z");
  const emDias = (n: number) => new Date(concluidoEm.getTime() + n * 24 * 60 * 60 * 1000);

  test("singular e plural, antes e depois do prazo", () => {
    assert.equal(prazoEmPalavras({ concluidoEm, hoje: emDias(89) }), "Vence amanhã");
    assert.equal(prazoEmPalavras({ concluidoEm, hoje: emDias(80) }), "Faltam 10 dias");
    assert.equal(prazoEmPalavras({ concluidoEm, hoje: emDias(91) }), "Venceu ontem");
    assert.equal(prazoEmPalavras({ concluidoEm, hoje: emDias(95) }), "Venceu há 5 dias");
  });

  test("avaliada não fala de prazo", () => {
    const texto = prazoEmPalavras({ concluidoEm, avaliadoEm: emDias(10), hoje: emDias(200) });
    assert.equal(texto, "Avaliada");
  });
});

describe("Avaliação de eficácia: ordem da fila", () => {
  test("quem concluiu antes aparece antes", () => {
    const itens = [
      { nome: "recente", concluidoEm: dia(20) },
      { nome: "antiga", concluidoEm: dia(2) },
      { nome: "meio", concluidoEm: dia(10) },
    ];

    assert.deepEqual(ordemDaFila(itens).map((i) => i.nome), ["antiga", "meio", "recente"]);
  });

  test("não altera a lista recebida", () => {
    const itens = [{ concluidoEm: dia(20) }, { concluidoEm: dia(2) }];
    ordemDaFila(itens);

    assert.equal(itens[0]?.concluidoEm.getDate(), 20);
  });
});

describe("Avaliação de eficácia: veredito", () => {
  test("reconhece os três vereditos e recusa o resto", () => {
    assert.ok(ehVeredito("efetivo"));
    assert.ok(ehVeredito("parcial"));
    assert.ok(ehVeredito("inefetivo"));

    /* O veredito vem do corpo de uma requisição: aceitar texto livre gravaria
       na evidência de conformidade qualquer coisa que chegasse. */
    assert.equal(ehVeredito("aprovado"), false);
    assert.equal(ehVeredito(""), false);
    assert.equal(ehVeredito(null), false);
    assert.equal(ehVeredito(3), false);
  });
});
