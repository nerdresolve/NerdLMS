import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { avancoPossivel, MAX_PLAYBACK_RATE, podeConcluirVideo } from "./watch-guard.ts";

describe("Trava do player, avanço plausível", () => {
  test("assistir na velocidade normal passa inteiro", () => {
    /* O player reporta a cada 15 segundos de conteúdo; a 1× isso são 15
       segundos de relógio. */
    const r = avancoPossivel({ de: 100, para: 115, decorridoSegundos: 15 });
    assert.equal(r.aceito, 115);
    assert.equal(r.cortado, false);
  });

  test("assistir acelerado continua valendo, é o ponto", () => {
    /* A 2×, 15 segundos de conteúdo passam em 7,5 de relógio. Recusar isso
       puniria o uso legítimo de um recurso que o próprio player oferece. */
    const r = avancoPossivel({ de: 100, para: 115, decorridoSegundos: 7.5 });
    assert.equal(r.aceito, 115);
    assert.equal(r.cortado, false);
  });

  test("o salto para o fim é cortado", () => {
    /* É o ataque que a trava existe para impedir: arrastar a barra até o fim,
       ou mandar a duração inteira por requisição direta. */
    const r = avancoPossivel({ de: 10, para: 3000, decorridoSegundos: 5 });
    assert.equal(r.cortado, true);
    assert.ok(r.aceito < 100, `aceitou ${r.aceito}`);
  });

  test("esperar não vira crédito", () => {
    /* Sem teto no tempo decorrido, deixar a aba aberta uma hora daria duas
       horas de vídeo num envio só — o tempo parado viraria moeda. */
    const umaHora = avancoPossivel({ de: 0, para: 7200, decorridoSegundos: 3600 });
    assert.equal(umaHora.cortado, true);
    assert.ok(umaHora.aceito <= 400, `aceitou ${umaHora.aceito}`);
  });

  test("o ritmo sustentado não passa do dobro do tempo real", () => {
    /* A garantia que importa: para chegar ao fim é preciso GASTAR o tempo.
       Simula alguém enviando sem parar, no melhor caso possível para ele. */
    const DURACAO = 1800;
    const JANELA = 60;

    let posicao = 0;
    let relogio = 0;

    while (posicao < DURACAO && relogio < 4000) {
      posicao = avancoPossivel({ de: posicao, para: DURACAO, decorridoSegundos: JANELA }).aceito;
      relogio += JANELA;
    }

    assert.ok(posicao >= DURACAO, "não chegou ao fim");
    /* Metade da duração é o piso teórico a 2×; a tolerância por envio dá uma
       folga pequena, e é ela que faz o número ficar abaixo de 900. */
    assert.ok(relogio >= DURACAO / 2 - JANELA, `chegou ao fim em ${relogio}s de relógio`);
  });

  test("insistir não rende: o corte não move a âncora", () => {
    /* A REGRA QUE FALTAVA. Este teste existia antes com um limiar escolhido
       olhando o resultado (`<= 1500`), e passava — enquanto no navegador cem
       requisições instantâneas chegavam a 81% de uma aula de 32 minutos.

       O que fecha o buraco não está nesta função: é o caso de uso NÃO GRAVAR
       quando houve corte. Sem gravar, o carimbo de tempo não avança e toda
       tentativa seguinte mede o decorrido a partir do mesmo instante. Aqui se
       verifica a consequência: repetir com a mesma origem e o mesmo decorrido
       devolve sempre o mesmo teto, e não um pouco mais a cada vez. */
    const primeira = avancoPossivel({ de: 0, para: 100000, decorridoSegundos: 0 });
    assert.equal(primeira.cortado, true);

    for (let i = 0; i < 100; i += 1) {
      const outra = avancoPossivel({ de: 0, para: 100000, decorridoSegundos: 0 });
      assert.equal(outra.aceito, primeira.aceito, `envio ${i} rendeu a mais`);
    }
  });

  test("retroceder é sempre aceito", () => {
    /* Rever um trecho é uso legítimo, e posição menor não aumenta consumo. */
    const r = avancoPossivel({ de: 500, para: 120, decorridoSegundos: 0 });
    assert.equal(r.aceito, 120);
    assert.equal(r.cortado, false);
  });

  test("número inválido não vira posição maluca", () => {
    assert.equal(avancoPossivel({ de: 10, para: Number.NaN, decorridoSegundos: 5 }).aceito, 10);
    assert.equal(
      avancoPossivel({ de: 10, para: 20, decorridoSegundos: Number.NaN }).cortado,
      false,
      "decorrido inválido conta como zero, e a tolerância cobre 10 segundos",
    );
  });

  test("a velocidade máxima da regra é a que o player oferece", () => {
    /* Se o player passar a oferecer 3× e esta constante ficar em 2, quem
       assistir acelerado terá progresso cortado sem ter feito nada de errado. */
    assert.equal(MAX_PLAYBACK_RATE, 2);
  });
});

describe("Trava do player, conclusão", () => {
  test("não concluiu quem mal começou", () => {
    const r = podeConcluirVideo({ watchedSeconds: 30, durationSeconds: 600 });
    assert.equal(r.pode, false);
    assert.ok(!r.pode && r.faltamSegundos > 0);
  });

  test("o limiar é o mesmo da conclusão automática", () => {
    /* Duas definições de "assistiu o bastante" divergiriam, e a aula
       concluiria por um caminho e não pelo outro. 90% de 600 são 540. */
    assert.equal(podeConcluirVideo({ watchedSeconds: 539, durationSeconds: 600 }).pode, false);
    assert.equal(podeConcluirVideo({ watchedSeconds: 540, durationSeconds: 600 }).pode, true);
  });

  test("assistir além do fim não atrapalha", () => {
    assert.equal(podeConcluirVideo({ watchedSeconds: 900, durationSeconds: 600 }).pode, true);
  });

  test("aula sem duração conhecida passa", () => {
    /* Importada sem metadados. Trancar quem não tem culpa por um campo vazio
       seria trocar um problema por outro — e o salto continua impedido pela
       regra de plausibilidade. */
    assert.equal(podeConcluirVideo({ watchedSeconds: 0, durationSeconds: 0 }).pode, true);
    assert.equal(podeConcluirVideo({ watchedSeconds: 0, durationSeconds: Number.NaN }).pode, true);
  });

  test("diz quanto falta, para a tela poder explicar", () => {
    const r = podeConcluirVideo({ watchedSeconds: 100, durationSeconds: 600 });
    assert.ok(!r.pode);
    assert.equal(r.exigidoSegundos, 540);
    assert.equal(r.faltamSegundos, 440);
  });
});

describe("A trava desligada, curso a curso", () => {
  test("sem trava, o avanço pedido é aceito inteiro", () => {
    /* É o que permite conteúdo informativo, como o comunicado de uma campanha,
       não exigir que a pessoa gaste o tempo do vídeo. */
    const r = avancoPossivel({ de: 10, para: 3000, decorridoSegundos: 1, travado: false });
    assert.equal(r.aceito, 3000);
    assert.equal(r.cortado, false);
  });

  test("sem trava, concluir não exige cobertura", () => {
    const r = podeConcluirVideo({ watchedSeconds: 0, durationSeconds: 3600, travado: false });
    assert.equal(r.pode, true);
  });

  test("o campo AUSENTE mantém a trava", () => {
    /* O padrão precisa ser o comportamento restritivo. Uma chamada que esqueça
       de informar o campo não pode liberar o avanço em silêncio, porque nenhum
       teste acusaria. */
    const r = avancoPossivel({ de: 10, para: 3000, decorridoSegundos: 1 });
    assert.ok(r.cortado, "sem informar `travado`, o salto tem de ser cortado");

    const c = podeConcluirVideo({ watchedSeconds: 0, durationSeconds: 3600 });
    assert.equal(c.pode, false);
  });

  test("`travado: true` explícito é igual a ausente", () => {
    const a = avancoPossivel({ de: 10, para: 3000, decorridoSegundos: 1, travado: true });
    const b = avancoPossivel({ de: 10, para: 3000, decorridoSegundos: 1 });
    assert.deepEqual(a, b);
  });
});
