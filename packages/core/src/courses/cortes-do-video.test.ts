import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  TETO_DA_AULA_SEGUNDOS,
  duracoesDoPlano,
  nomeDaParte,
  planoDeCorte,
} from "./cortes-do-video.ts";

const TETO = TETO_DA_AULA_SEGUNDOS;

/** Quadros-chave de 2 em 2 segundos, como num MP4 comum. */
function aCada(intervalo: number, ate: number): number[] {
  const saida: number[] = [];
  for (let t = 0; t < ate; t += intervalo) saida.push(t);
  return saida;
}

describe("Corte do vídeo: nenhuma parte passa do teto", () => {
  test("vídeo que cabe não é cortado", () => {
    const plano = planoDeCorte(600, aCada(2, 600));

    assert.equal(plano.partes.length, 1);
    assert.deepEqual(plano.partes[0], { inicio: 0, fim: 600, excedeu: false });
    assert.equal(plano.temExcesso, false);
  });

  test("exatamente no teto ainda é uma parte só", () => {
    const plano = planoDeCorte(TETO, aCada(2, TETO));
    assert.equal(plano.partes.length, 1);
  });

  test("NENHUMA parte passa do teto — o defeito que isto corrige", () => {
    /* As aulas ficaram com 901 e 902 segundos porque o `-segment_time` do
       ffmpeg escolhe o primeiro quadro-chave DEPOIS do limite. Aqui o corte é
       o último ANTES, e o teto passa a valer. */
    const duracao = 56 * 60;
    const plano = planoDeCorte(duracao, aCada(2, duracao));

    for (const parte of plano.partes) {
      const tamanho = parte.fim - parte.inicio;
      assert.ok(tamanho <= TETO, `parte de ${tamanho}s passou do teto de ${TETO}s`);
    }

    assert.equal(plano.temExcesso, false);
  });

  test("as partes cobrem o vídeo inteiro, sem buraco e sem sobra", () => {
    const duracao = 56 * 60;
    const plano = planoDeCorte(duracao, aCada(2, duracao));

    assert.equal(plano.partes[0]?.inicio, 0);
    assert.equal(plano.partes[plano.partes.length - 1]?.fim, duracao);

    for (let i = 1; i < plano.partes.length; i++) {
      assert.equal(plano.partes[i]!.inicio, plano.partes[i - 1]!.fim, "as partes se encostam");
    }
  });

  test("corta no último quadro-chave possível, não em qualquer um antes", () => {
    /* Intervalo de 70s de propósito: 900 não é múltiplo dele, então o teto cai
       ENTRE dois quadros-chave — 840 e 910. O corte tem de ser 840, e não 770:
       a parte mais longa que cabe é a que gera menos partes. */
    const duracao = 30 * 60;
    const plano = planoDeCorte(duracao, aCada(70, duracao));

    assert.equal(plano.partes[0]?.fim, 840);
  });

  test("quadro-chave exatamente no teto é aproveitado", () => {
    const duracao = 20 * 60;
    const plano = planoDeCorte(duracao, [0, TETO]);

    assert.equal(plano.partes[0]?.fim, TETO);
    assert.equal(plano.partes.length, 2);
  });
});

describe("Corte do vídeo: quando a cópia não dá conta", () => {
  test("sem quadro-chave na janela, a parte excede E DIZ que excedeu", () => {
    /* Quadros-chave a cada 20 minutos: nenhum corte por cópia respeita o teto.
       Fingir que coube seria o defeito de novo, com outra origem. */
    const duracao = 40 * 60;
    const plano = planoDeCorte(duracao, [0, 20 * 60]);

    assert.equal(plano.temExcesso, true);
    assert.ok(plano.partes.some((parte) => parte.excedeu));
  });

  test("vídeo sem nenhum quadro-chave vira uma parte só, marcada", () => {
    const plano = planoDeCorte(40 * 60, []);

    assert.equal(plano.partes.length, 1);
    assert.equal(plano.partes[0]?.excedeu, true);
    assert.equal(plano.temExcesso, true);
  });

  test("não entra em laço infinito quando não há corte possível", () => {
    /* O `break` existe por isto: sem ele, a ausência de quadro-chave seguinte
       repetiria a mesma janela para sempre. */
    const plano = planoDeCorte(10 * 3600, [0]);
    assert.equal(plano.partes.length, 1);
  });
});

describe("Corte do vídeo: entradas malformadas", () => {
  test("duração zero ou negativa não produz parte nenhuma", () => {
    assert.deepEqual(planoDeCorte(0, [0]).partes, []);
    assert.deepEqual(planoDeCorte(-5, [0]).partes, []);
  });

  test("quadros-chave repetidos, fora de ordem ou fora do vídeo são ignorados", () => {
    const duracao = 30 * 60;
    /* Repetido, negativo, NaN, além da duração, e fora de ordem: tudo o que um
       `ffprobe` de um arquivo estranho pode devolver. */
    const bagunçados = [1500, 840, 840, -3, Number.NaN, 5000, 0, 300];

    const plano = planoDeCorte(duracao, bagunçados);

    assert.equal(plano.partes[0]?.fim, 840, "o último quadro-chave até o teto");
    assert.equal(plano.partes[1]?.fim, 1500, "e o seguinte, dentro da janela");
    assert.equal(plano.temExcesso, false);
  });
});

describe("Corte do vídeo: durações e nomes", () => {
  test("as durações saem em segundos inteiros", () => {
    const plano = planoDeCorte(1000.7, [0, 500.4]);
    assert.deepEqual(duracoesDoPlano(plano), [500, 500]);
  });

  test("o nome diz qual parte é, e de quantas", () => {
    /* Sem o total, quem abre a primeira não sabe se faltam duas ou dez. */
    assert.equal(nomeDaParte("Segurança", 0, 4), "Segurança (parte 1 de 4)");
    assert.equal(nomeDaParte("Segurança", 3, 4), "Segurança (parte 4 de 4)");
  });

  test("uma parte só mantém o título original", () => {
    /* "Parte 1 de 1" sugeriria uma segunda parte que não existe. */
    assert.equal(nomeDaParte("Segurança", 0, 1), "Segurança");
  });
});
