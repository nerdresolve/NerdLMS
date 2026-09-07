/**
 * Conteúdo interativo — F6-05 (guia §4 e §6).
 *
 * Três tipos, escolhidos por serem os que respondem ao que o guia chama de
 * "conteúdo interativo" — conteúdo que a pessoa RESPONDE, não só assiste:
 *
 *   `interactive_video` — vídeo com perguntas em pontos do tempo
 *   `image_hotspots`    — imagem com regiões clicáveis
 *   `flashcards`        — cartões frente/verso
 *
 * **NÃO é H5P de verdade.** Não importa `.h5p` nem roda os 50+ tipos da
 * biblioteca oficial — que é GPL, e a proposta exclui licença de terceiro.
 * Uma instituição com conteúdo H5P pronto não vai conseguir trazê-lo, e isso
 * está registrado como lacuna.
 */

export type InteractiveKind = "interactive_video" | "image_hotspots" | "flashcards";

export const INTERACTIVE_LABEL: Record<InteractiveKind, string> = {
  interactive_video: "Vídeo interativo",
  image_hotspots: "Imagem com pontos",
  flashcards: "Cartões de memorização",
};

export interface InteractiveOption {
  text: string;
  correct: boolean;
  /** O que dizer a quem escolheu esta alternativa. */
  feedback?: string;
}

export interface InteractiveItem {
  id: string;
  position: number;
  /** Segundo do vídeo em que aparece. */
  atSeconds: number | null;
  xPercent: number | null;
  yPercent: number | null;
  prompt: string;
  body: string | null;
  options: InteractiveOption[];
  blocking: boolean;
}

export interface InteractiveContent {
  id: string;
  kind: InteractiveKind;
  title: string;
  mediaUrl: string | null;
  /** Nulo é "todas". */
  requiredInteractions: number | null;
  items: InteractiveItem[];
}

export interface ResponseRecord {
  itemId: string;
  answer: string | null;
  correct: boolean | null;
  attempts: number;
}

/**
 * Quantas interações a pessoa precisa responder para concluir.
 *
 * `null` no conteúdo significa TODAS. Um número menor permite "responda 3 de
 * 5", que é o que faz sentido em flashcards — decorar 3 cartões já demonstra
 * estudo, e exigir os 20 transformaria a aula em obstáculo.
 */
export function requiredCount(content: InteractiveContent): number {
  const total = content.items.length;

  if (content.requiredInteractions === null) return total;

  /* Exigir mais do que existe travaria a aula para sempre. Acontece quando
     alguém apaga itens depois de definir o mínimo. */
  return Math.min(content.requiredInteractions, total);
}

export type InteractiveDecision =
  | { allow: true }
  | { allow: false; remaining: number; total: number };

/**
 * A pessoa pode concluir a aula?
 *
 * Conta interações RESPONDIDAS, não acertadas. O objetivo do conteúdo
 * interativo é aprender: quem errou e tentou de novo interagiu com o material,
 * e exigir acerto transformaria a aula numa prova disfarçada — que é o que a
 * prova já faz, com regras próprias.
 */
export function canCompleteInteractive(
  content: InteractiveContent,
  responses: ResponseRecord[],
): InteractiveDecision {
  const exigidas = requiredCount(content);

  /* Sem interação nenhuma, a aula é só a mídia: conclui como qualquer outra. */
  if (exigidas === 0) return { allow: true };

  /* Só respostas de itens que AINDA EXISTEM. Um item apagado depois de
     respondido não pode contar — senão a conta fecharia por causa de conteúdo
     que ninguém vê mais. */
  const existentes = new Set(content.items.map((item) => item.id));
  const respondidas = new Set(
    responses.filter((r) => existentes.has(r.itemId)).map((r) => r.itemId),
  );

  if (respondidas.size >= exigidas) return { allow: true };

  return {
    allow: false,
    remaining: exigidas - respondidas.size,
    total: exigidas,
  };
}

export type AnswerResult =
  | { kind: "correct"; feedback: string | null }
  | { kind: "incorrect"; feedback: string | null }
  /** Flashcard e hotspot: não há certo nem errado, só visto. */
  | { kind: "acknowledged" };

/**
 * Confere uma resposta.
 *
 * A conferência é no SERVIDOR, sempre. As alternativas chegam ao navegador com
 * o texto, mas o gabarito não — mandá-lo junto faria a resposta certa aparecer
 * no código-fonte da página, e a interação viraria decoração.
 */
export function checkAnswer(item: InteractiveItem, answer: string | null): AnswerResult {
  /* Sem alternativas, não há o que conferir: o item é um cartão ou um ponto
     na imagem, e o que importa é ter sido aberto. */
  if (item.options.length === 0) return { kind: "acknowledged" };

  /* `Number("")` é 0, e `Number(null)` também.
   
     Sem esta guarda, resposta VAZIA escolheria a primeira alternativa — e numa
     pergunta cuja primeira opção é a certa, quem não respondesse nada
     acertaria. */
  if (answer === null || answer.trim() === "") {
    return { kind: "incorrect", feedback: null };
  }

  const indice = Number(answer);

  if (!Number.isInteger(indice) || indice < 0 || indice >= item.options.length) {
    /* Índice inválido é resposta errada, não erro: o cliente pode mandar
       qualquer coisa, e responder 400 faria uma resposta absurda parecer falha
       da plataforma. */
    return { kind: "incorrect", feedback: null };
  }

  const escolhida = item.options[indice]!;

  return {
    kind: escolhida.correct ? "correct" : "incorrect",
    feedback: escolhida.feedback ?? null,
  };
}

/**
 * O item que aparece neste segundo do vídeo.
 *
 * Devolve o PRIMEIRO ainda não respondido cuja marca já passou. "Já passou" e
 * não "é exatamente agora" porque o player reporta a posição a cada segundo, e
 * um salto de 3 segundos pularia a pergunta marcada no meio.
 */
export function itemAtSecond(
  content: InteractiveContent,
  segundo: number,
  respondidas: Set<string>,
): InteractiveItem | null {
  const candidatos = content.items
    .filter((item) => item.atSeconds !== null && item.atSeconds <= segundo)
    .filter((item) => !respondidas.has(item.id))
    .sort((a, b) => (a.atSeconds ?? 0) - (b.atSeconds ?? 0));

  return candidatos[0] ?? null;
}

export interface InteractiveSummary {
  total: number;
  answered: number;
  correct: number;
  /** 0 a 100. */
  percent: number;
}

/** O resumo do que a pessoa fez, para a tela mostrar progresso. */
export function summarize(
  content: InteractiveContent,
  responses: ResponseRecord[],
): InteractiveSummary {
  const existentes = new Set(content.items.map((item) => item.id));
  const validas = responses.filter((r) => existentes.has(r.itemId));

  const exigidas = requiredCount(content);
  const respondidas = validas.length;

  return {
    total: exigidas,
    answered: respondidas,
    correct: validas.filter((r) => r.correct === true).length,
    /* Sobre o EXIGIDO, não sobre o total: numa aula de "responda 3 de 10",
       responder 3 é 100% do que se pede. Mostrar 30% diria à pessoa que ela
       está atrasada quando já cumpriu. */
    percent: exigidas === 0 ? 100 : Math.min(100, Math.round((respondidas / exigidas) * 100)),
  };
}

/**
 * As alternativas SEM o gabarito, para mandar ao navegador.
 *
 * É a função que impede o vazamento: `options` guarda `correct` e `feedback`,
 * e serializar o item inteiro colocaria a resposta certa no HTML.
 */
export function publicOptions(item: InteractiveItem): Array<{ text: string }> {
  return item.options.map((opcao) => ({ text: opcao.text }));
}

/** O item como ele vai para o navegador — sem gabarito. */
export function toPublicItem(item: InteractiveItem): Record<string, unknown> {
  return {
    id: item.id,
    position: item.position,
    atSeconds: item.atSeconds,
    xPercent: item.xPercent,
    yPercent: item.yPercent,
    prompt: item.prompt,
    /* O `body` do flashcard é o VERSO — e o verso é o conteúdo, não o
       gabarito. Escondê-lo tornaria o cartão inútil. Já numa pergunta, o
       `body` é a explicação, que só faz sentido depois de responder: por isso
       ele só vai quando não há alternativas. */
    body: item.options.length === 0 ? item.body : null,
    options: publicOptions(item),
    blocking: item.blocking,
  };
}
