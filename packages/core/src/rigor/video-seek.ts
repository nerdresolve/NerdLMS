/**
 * Trava de avanço do vídeo.
 *
 * O problema real: numa aula obrigatória, arrastar a barra até o fim marca a
 * aula como vista sem ninguém ter visto. Em treinamento de segurança isso não
 * é detalhe — é a diferença entre o registro dizer a verdade e não dizer.
 *
 * O QUE A TRAVA FAZ, E O QUE ELA NÃO FAZ
 *
 * Impede avançar para trecho ainda não assistido. NÃO impede voltar: rever é
 * parte de estudar, e travar isso puniria justamente quem está prestando
 * atenção.
 *
 * O PONTO MAIS DISTANTE JÁ ASSISTIDO é o limite, e ele só cresce. Guardá-lo
 * separado da posição atual é o que permite voltar e avançar de novo até onde
 * a pessoa já tinha chegado — sem isso, quem voltasse para rever ficaria preso
 * lá atrás.
 */

export interface SeekDecision {
  /** A posição que o player deve assumir. */
  position: number;
  /** O salto foi barrado? A tela avisa quando sim. */
  blocked: boolean;
}

/**
 * Tolerância, em segundos.
 *
 * O `timeupdate` do navegador dispara a cada 250ms mais ou menos, e o
 * `currentTime` avança sozinho entre um e outro. Sem folga, a reprodução
 * normal seria confundida com um salto — e o vídeo travaria sozinho, o que é
 * pior que não ter trava nenhuma.
 */
const TOLERANCIA = 2;

/**
 * Para onde o player vai depois de uma tentativa de salto.
 *
 * `alvo` é onde a pessoa tentou ir; `maximoVisto` é o ponto mais distante que
 * ela já alcançou assistindo.
 */
export function decideSeek(
  alvo: number,
  maximoVisto: number,
  travado: boolean,
): SeekDecision {
  if (!travado) return { position: alvo, blocked: false };

  /* Voltar é sempre livre. */
  if (alvo <= maximoVisto + TOLERANCIA) {
    return { position: alvo, blocked: false };
  }

  /* Avançar além do visto: o player volta para onde a pessoa parou. Deixá-lo
     onde está travaria a reprodução num ponto que ela não alcançou. */
  return { position: maximoVisto, blocked: true };
}

/**
 * O novo ponto máximo, depois de um instante de reprodução.
 *
 * SÓ CRESCE, e nunca por salto — é o que impede a trava de ser burlada por ela
 * mesma: se pular para o fim atualizasse o máximo, o primeiro salto liberaria
 * o vídeo inteiro.
 */
export function avancaMaximo(
  maximoAtual: number,
  posicao: number,
  velocidade = 1,
): number {
  /* O passo aceito ACOMPANHA A VELOCIDADE de reprodução.

     O `timeupdate` dispara a cada 250ms de tempo real, mas a 2× o vídeo andou
     meio segundo nesse intervalo — e a 16×, quatro segundos. Um limite fixo
     confundiria reprodução acelerada com salto: quem assistisse em 2× veria o
     máximo parar de crescer, e ao voltar para rever ficaria preso no começo.
     Foi o que aconteceu no primeiro teste em navegador.

     O `Math.max` com 1 protege o caso de velocidade zero ou negativa, que
     alguns navegadores relatam durante o buffering. */
  const passoAceito = TOLERANCIA * Math.max(1, velocidade);

  if (posicao > maximoAtual + passoAceito) return maximoAtual;

  return Math.max(maximoAtual, posicao);
}

/**
 * A aula pode ser concluída?
 *
 * Com a trava ligada, exige ter chegado ao fim — com folga para os últimos
 * segundos, que raramente são assistidos: créditos, silêncio, o instante em
 * que a pessoa fecha a aba. Exigir 100% mostraria "não assistiu" a quem viu
 * tudo.
 */
export function podeConcluirVideo(
  maximoVisto: number,
  duracao: number,
  travado: boolean,
): boolean {
  if (!travado) return true;
  if (duracao <= 0) return true;

  return maximoVisto >= duracao * 0.95;
}
