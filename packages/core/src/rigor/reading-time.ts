/**
 * Tempo estimado de leitura de um documento.
 *
 * Serve a uma pergunta só: quem clicou em "concluir" depois de trinta segundos
 * num documento de vinte páginas leu mesmo? A resposta honesta é "provavelmente
 * não", e o produto pergunta em vez de afirmar — porque leitura em diagonal
 * existe, releitura existe, e alguém pode ter aberto o mesmo PDF ontem.
 *
 * POR ISSO É CONFIRMAÇÃO, NÃO BLOQUEIO.
 *
 * Travar a conclusão por tempo puniria quem lê rápido e não impediria quem
 * quer burlar — bastaria deixar a aba aberta. O modal cumpre o que uma trava
 * não cumpre: faz a pessoa afirmar que leu, e deixa isso registrado.
 */

/**
 * Palavras por minuto.
 *
 * 200 é a média para leitura atenta em português, de material técnico. Leitura
 * de lazer passa de 250; documento normativo, com termos que exigem parar para
 * pensar, fica abaixo. O número é conservador de propósito: superestimar o
 * tempo faria o modal aparecer para quem leu de verdade, e um aviso que sempre
 * aparece é um aviso que ninguém lê.
 */
const PALAVRAS_POR_MINUTO = 200;

/**
 * Palavras por página, quando só se sabe a contagem de páginas.
 *
 * 300 é a média de uma página A4 de texto corrido com espaçamento 1,5. Slides
 * têm muito menos; manuais com tabela, menos ainda. Como o produto não abre o
 * PDF para contar, a estimativa é declaradamente grosseira — e é por isso que
 * ela alimenta uma pergunta, não uma trava.
 */
const PALAVRAS_POR_PAGINA = 300;

export interface ReadingEstimate {
  /** Segundos estimados para a leitura completa. */
  seconds: number;
  /** Como o texto aparece na tela: "cerca de 8 minutos". */
  label: string;
}

/** Estimativa a partir da contagem de palavras. */
export function estimateFromWords(palavras: number): ReadingEstimate {
  const segundos = Math.max(0, Math.round((palavras / PALAVRAS_POR_MINUTO) * 60));
  return { seconds: segundos, label: descrever(segundos) };
}

/** Estimativa a partir do número de páginas. */
export function estimateFromPages(paginas: number): ReadingEstimate {
  return estimateFromWords(Math.max(0, paginas) * PALAVRAS_POR_PAGINA);
}

/**
 * O texto que a pessoa lê.
 *
 * Arredondado para cima em minutos: "cerca de 3 minutos" é uma estimativa e
 * deve soar como uma. "2 minutos e 47 segundos" daria uma precisão que o
 * cálculo não tem.
 */
export function descrever(segundos: number): string {
  if (segundos < 60) return "menos de um minuto";

  const minutos = Math.ceil(segundos / 60);
  if (minutos < 60) return `cerca de ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (resto === 0) return `cerca de ${horas} ${horas === 1 ? "hora" : "horas"}`;

  return `cerca de ${horas}h${String(resto).padStart(2, "0")}`;
}

export interface ConfirmDecision {
  /** Perguntar antes de concluir? */
  confirm: boolean;
  /** O que dizer, quando perguntar. */
  message: string;
}

/**
 * Quanto do tempo estimado basta para não perguntar.
 *
 * Metade. Quem leu em 55% do tempo estimado leu rápido, e o cálculo já é
 * conservador — perguntar ali seria duvidar de quem fez o esperado. Abaixo da
 * metade, a leitura completa fica improvável o bastante para valer a pergunta.
 */
const FRACAO_SEM_PERGUNTA = 0.5;

/**
 * A pessoa deve confirmar que leu?
 *
 * `tempoNaPagina` é quanto ela ficou com o documento aberto. Não é medida de
 * leitura — é o que dá para medir, e o modal existe justamente porque a
 * medida é imperfeita.
 */
export function decideConfirm(
  tempoNaPagina: number,
  estimativa: ReadingEstimate,
  ligado: boolean,
): ConfirmDecision {
  if (!ligado || estimativa.seconds <= 0) {
    return { confirm: false, message: "" };
  }

  if (tempoNaPagina >= estimativa.seconds * FRACAO_SEM_PERGUNTA) {
    return { confirm: false, message: "" };
  }

  return {
    confirm: true,
    message: `O tempo estimado de leitura deste documento é de ${estimativa.label}. Você tem certeza de que já terminou?`,
  };
}
