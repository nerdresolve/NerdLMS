import { COMPLETION_THRESHOLD } from "./progress.ts";

/**
 * A trava que impede concluir uma aula sem assistir.
 *
 * O PROBLEMA, EM UMA FRASE: qualquer trava de tela é decoração. Com o console
 * aberto, um `POST /api/progresso` com `complete: true` marcava a aula como
 * concluída sem o vídeo nunca ter sido aberto — e arrastar a barra até o fim
 * fazia o mesmo pela interface.
 *
 * Não adianta o player travar o arrasto: ele roda na máquina de quem está
 * sendo travado. A garantia tem de morar aqui, onde o servidor decide.
 *
 * SÃO DUAS REGRAS, E CADA UMA SOZINHA NÃO BASTA
 *
 *   COBERTURA — a posição alcançada precisa chegar ao fim. Sozinha, cai no
 *   ataque óbvio: um único envio com a duração inteira.
 *
 *   PLAUSIBILIDADE NO TEMPO — a posição não pode andar mais rápido que o
 *   relógio permite. Entre dois envios, o avanço é limitado pelo tempo real
 *   decorrido vezes a velocidade máxima que o player oferece. Pular do segundo
 *   10 para o 3000 numa requisição é recusado porque é fisicamente impossível.
 *
 * Juntas, elas dizem: para concluir, é preciso GASTAR o tempo. Acelerar
 * continua valendo — a 2× chega-se ao fim na metade do tempo, e o servidor
 * aceita, porque 2× é o teto que ele conhece. O que deixa de funcionar é o
 * salto.
 *
 * O QUE ISTO CUSTA, e é bom estar dito: pular deixa de ser possível mesmo para
 * quem já sabe o conteúdo. Em treinamento obrigatório costuma ser o desejado;
 * é a razão de a regra existir.
 */

/**
 * A maior velocidade que o player oferece.
 *
 * Precisa acompanhar `RATES` em `video-player.tsx`. Um valor menor aqui
 * recusaria quem assiste acelerado — punindo o uso legítimo do recurso.
 */
export const MAX_PLAYBACK_RATE = 2;

/**
 * Folga por envio, em segundos.
 *
 * O player reporta a cada 15 segundos de CONTEÚDO, o que a 2× são 7,5 segundos
 * de relógio — exatamente no limite da conta. Sem folga, qualquer atraso de
 * rede ou variação do temporizador cortaria progresso de quem está assistindo
 * de verdade. Errar para o lado de aceitar é o certo: o custo de recusar
 * alguém honesto é maior que o de conceder alguns segundos a quem tenta
 * burlar, e a cobertura ainda tem de fechar.
 */
const TOLERANCIA_SEGUNDOS = 15;

/**
 * Teto do tempo decorrido que conta a favor.
 *
 * Sem ele, deixar a aba aberta por uma hora daria crédito de duas horas de
 * vídeo num único envio — o tempo parado viraria moeda. Com o teto, esperar
 * não rende: o avanço máximo por envio fica limitado, e o ritmo sustentado não
 * passa de duas vezes o tempo real, que é o que se queria garantir.
 */
const MAXIMO_DECORRIDO_SEGUNDOS = 180;

export interface AvancoInput {
  /** Posição já registrada, em segundos. */
  de: number;
  /** Posição que o cliente afirma ter alcançado. */
  para: number;
  /** Segundos de RELÓGIO desde o último registro. */
  decorridoSegundos: number;
  /**
   * A trava vale neste curso?
   *
   * Ausente significa SIM, e não por descuido: o padrão precisa ser o
   * comportamento restritivo. Uma chamada que esqueça de informar o campo
   * mantém a trava; o contrário liberaria o avanço em silêncio, e ninguém
   * descobriria pelo teste que passou.
   */
  travado?: boolean;
}

export interface Avanco {
  /** A posição que o servidor aceita — nunca maior que a pedida. */
  aceito: number;
  /** `true` quando o pedido foi maior que o possível e teve de ser cortado. */
  cortado: boolean;
}

/**
 * Quanto do avanço pedido é fisicamente possível.
 *
 * Não recusa: CORTA. Recusar devolveria erro a quem assiste com rede ruim, e o
 * player reenvia a posição a cada janela — o corte se corrige sozinho no envio
 * seguinte, quando o relógio já andou. Quem saltou fica com o que era
 * possível ter assistido, que é exatamente a intenção.
 *
 * Retroceder é sempre aceito: rever um trecho é uso legítimo, e a posição
 * menor não aumenta consumo nenhum.
 */
export function avancoPossivel(input: AvancoInput): Avanco {
  const { de, para } = input;

  if (!Number.isFinite(de) || !Number.isFinite(para)) {
    return { aceito: de, cortado: false };
  }

  /* Curso sem trava aceita a posição como veio. O progresso continua sendo
     GRAVADO: o que se abre mão é de provar que o tempo foi gasto, não do
     registro. Não registrar nada seria pior para qualquer relatório. */
  if (input.travado === false) return { aceito: para, cortado: false };

  if (para <= de) return { aceito: para, cortado: false };

  const decorrido = Number.isFinite(input.decorridoSegundos)
    ? Math.max(0, Math.min(input.decorridoSegundos, MAXIMO_DECORRIDO_SEGUNDOS))
    : 0;

  const maximo = decorrido * MAX_PLAYBACK_RATE + TOLERANCIA_SEGUNDOS;
  const pedido = para - de;

  if (pedido <= maximo) return { aceito: para, cortado: false };

  return { aceito: de + maximo, cortado: true };
}

export interface ConclusaoInput {
  watchedSeconds: number;
  durationSeconds: number;
  /** Ausente significa travado, pelo mesmo motivo de `AvancoInput`. */
  travado?: boolean;
}

export type ConclusaoVeredito =
  | { pode: true }
  | { pode: false; faltamSegundos: number; exigidoSegundos: number };

/**
 * Pode marcar esta aula de vídeo como concluída?
 *
 * O limiar é o mesmo que já governa a conclusão automática
 * (`COMPLETION_THRESHOLD`), e de propósito: duas definições de "assistiu o
 * bastante" divergiriam, e a aula concluiria por um caminho e não pelo outro.
 *
 * Aula sem duração conhecida — importada sem metadados, por exemplo — passa.
 * Recusar seria trancar quem não tem culpa por causa de um campo vazio, e a
 * regra de plausibilidade já impede o salto de qualquer jeito.
 */
export function podeConcluirVideo(input: ConclusaoInput): ConclusaoVeredito {
  const { watchedSeconds, durationSeconds } = input;

  /* Sem trava, concluir é decisão de quem assiste. A conclusão automática em
     90% continua valendo por cima: quem assistir de fato fecha sozinho. */
  if (input.travado === false) return { pode: true };

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return { pode: true };

  const exigido = Math.ceil(durationSeconds * COMPLETION_THRESHOLD);
  const assistido = Number.isFinite(watchedSeconds) ? Math.max(0, watchedSeconds) : 0;

  if (assistido >= exigido) return { pode: true };

  return {
    pode: false,
    faltamSegundos: exigido - assistido,
    exigidoSegundos: exigido,
  };
}
