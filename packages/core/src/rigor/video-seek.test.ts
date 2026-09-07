import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { avancaMaximo, decideSeek, podeConcluirVideo } from "./video-seek.ts";

describe("Trava de vídeo — o que ela impede", () => {
  test("avançar para trecho não assistido é barrado", () => {
    /* O problema que a trava resolve: arrastar a barra até o fim marca a aula
       como vista sem ninguém ter visto. */
    const r = decideSeek(600, 120, true);

    assert.equal(r.blocked, true);
    assert.equal(r.position, 120);
  });

  test("voltar é sempre livre", () => {
    /* Rever é parte de estudar. Travar isso puniria quem está prestando
       atenção. */
    const r = decideSeek(30, 300, true);

    assert.equal(r.blocked, false);
    assert.equal(r.position, 30);
  });

  test("avançar até onde já viu é livre", () => {
    /* Quem voltou para rever precisa poder adiantar de volta. */
    const r = decideSeek(280, 300, true);

    assert.equal(r.blocked, false);
    assert.equal(r.position, 280);
  });

  test("com a trava desligada, tudo passa", () => {
    const r = decideSeek(9999, 0, false);

    assert.equal(r.blocked, false);
    assert.equal(r.position, 9999);
  });

  test("a reprodução normal não é confundida com salto", () => {
    /* O `timeupdate` dispara a cada 250ms e o tempo avança sozinho entre um e
       outro. Sem folga, o vídeo travaria sozinho — pior que não ter trava. */
    const r = decideSeek(121.5, 120, true);
    assert.equal(r.blocked, false);
  });
});

describe("Trava de vídeo — o ponto máximo", () => {
  test("cresce conforme a pessoa assiste", () => {
    let max = 0;
    for (const t of [1, 2, 3, 4, 5]) max = avancaMaximo(max, t);

    assert.equal(max, 5);
  });

  test("NÃO cresce por salto", () => {
    /* É o que impede a trava de ser burlada por ela mesma: se pular para o
       fim atualizasse o máximo, o primeiro salto liberaria o vídeo inteiro. */
    assert.equal(avancaMaximo(60, 600), 60);
  });

  test("nunca diminui quando a pessoa volta", () => {
    assert.equal(avancaMaximo(300, 10), 300);
  });

  test("um passo pequeno conta como reprodução", () => {
    assert.equal(avancaMaximo(60, 61), 61);
  });

  test("reprodução acelerada não é confundida com salto", () => {
    /* O `timeupdate` dispara a cada 250ms de tempo REAL: a 2× o vídeo andou
       meio segundo; a 16×, quatro. Um limite fixo faria o máximo parar de
       crescer para quem assiste rápido, e ao voltar para rever a pessoa
       ficaria presa no começo — foi o que aconteceu no primeiro teste em
       navegador. */
    assert.equal(avancaMaximo(60, 64, 16), 64);
    assert.equal(avancaMaximo(60, 63, 2), 63);
  });

  test("mesmo acelerado, um salto grande continua barrado", () => {
    /* A folga acompanha a velocidade, não a dispensa. */
    assert.equal(avancaMaximo(60, 600, 2), 60);
  });

  test("velocidade zero não encolhe a tolerância", () => {
    /* Alguns navegadores relatam `playbackRate` zero durante o buffering. */
    assert.equal(avancaMaximo(60, 61, 0), 61);
  });
});

describe("Trava de vídeo — concluir", () => {
  test("com a trava ligada, exige ter chegado ao fim", () => {
    assert.equal(podeConcluirVideo(100, 600, true), false);
    assert.equal(podeConcluirVideo(580, 600, true), true);
  });

  test("os últimos segundos são perdoados", () => {
    /* Créditos, silêncio, o instante em que a pessoa fecha a aba. Exigir 100%
       mostraria "não assistiu" a quem viu tudo. */
    assert.equal(podeConcluirVideo(570, 600, true), true);
  });

  test("com a trava desligada, conclui sempre", () => {
    assert.equal(podeConcluirVideo(0, 600, false), true);
  });

  test("vídeo sem duração conhecida não trava ninguém", () => {
    /* Acontece com transmissão e com arquivo que o navegador ainda não leu.
       Barrar aqui deixaria a aula impossível de concluir. */
    assert.equal(podeConcluirVideo(0, 0, true), true);
  });
});
