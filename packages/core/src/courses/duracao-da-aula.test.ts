import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  aulasNecessarias,
  cabeNumaAula,
  MAXIMO_DA_AULA_SEGUNDOS,
} from "./duracao-da-aula.ts";

describe("Teto de duração da aula", () => {
  test("dentro do limite passa", () => {
    assert.equal(cabeNumaAula(MAXIMO_DA_AULA_SEGUNDOS).aceita, true);
    assert.equal(cabeNumaAula(600).aceita, true);
  });

  test("a folga cobre o vídeo que passou por poucos segundos", () => {
    /* 15min02s é quinze minutos para quem gravou, e recusar por dois segundos
       seria pedantismo que a pessoa não tem como resolver sem reeditar. */
    assert.equal(cabeNumaAula(15 * 60 + 2).aceita, true);
    assert.equal(cabeNumaAula(15 * 60 + 29).aceita, true);
  });

  test("a folga não abre caminho para vídeo longo", () => {
    assert.equal(cabeNumaAula(20 * 60).aceita, false);
    assert.equal(cabeNumaAula(56 * 60).aceita, false);
  });

  test("a mensagem diz o tamanho real e o que fazer", () => {
    const r = cabeNumaAula(56 * 60 + 30);
    assert.equal(r.aceita, false);
    assert.ok(!r.aceita && r.mensagem.includes("56min30"));
    assert.ok(!r.aceita && r.mensagem.includes("15 minutos"));
  });

  test("duração desconhecida PASSA", () => {
    /* O navegador nem sempre lê os metadados antes do envio, e recusar por
       isso trancaria quem não tem culpa. Esta conferência ajuda quem monta o
       curso; ela não protege contra quem chama a API direto. */
    assert.equal(cabeNumaAula(null).aceita, true);
    assert.equal(cabeNumaAula(0).aceita, true);
    assert.equal(cabeNumaAula(Number.NaN).aceita, true);
  });

  test("sugere em quantas aulas dividir", () => {
    assert.equal(aulasNecessarias(56 * 60), 4);
    assert.equal(aulasNecessarias(30 * 60), 2);
    assert.equal(aulasNecessarias(15 * 60), 1);
  });

  test("vídeo curto continua sendo uma aula só", () => {
    assert.equal(aulasNecessarias(60), 1);
    assert.equal(aulasNecessarias(0), 1);
  });
});
