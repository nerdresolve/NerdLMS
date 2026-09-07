/**
 * Economia social dos comentários.
 *
 * Inspirada no modelo de TabCoins do TabNews: votar custa, receber voto
 * recompensa, e não existe voto negativo. O que muda em relação ao TabNews, e
 * por quê:
 *
 * **Lá, a moeda só compra visibilidade. Aqui ela também compra recompensa
 * real** (dia de folga, kit, vale-livro). Se a mesma moeda pagasse os dois,
 * dar um voto custaria um pedaço de um prêmio — e ninguém votaria. A economia
 * criada para gerar interação a mataria.
 *
 * Por isso são **duas moedas separadas**:
 *
 * - **Moedas**: ganhas aprendendo e recebendo votos. Gastas na loja.
 * - **Votos da semana**: orçamento semanal fixo, que **não acumula**. Serve só
 *   para votar. Não gastar é perder — o incentivo é usar, não guardar.
 *
 * Consequência: votar é de graça em termos de prêmio, mas é escasso em termos
 * de atenção. É exatamente o comportamento que se quer premiar — ler os
 * comentários e escolher os bons.
 */

import type { Comment } from "./types.ts";

/** Votos que cada pessoa recebe por semana. Não acumulam. */
export const WEEKLY_VOTE_BUDGET = 10;

/** Moedas que o autor ganha por voto recebido. */
export const COINS_PER_UPVOTE = 5;

/** Quantos comentários ganham destaque de relevância. */
export const RELEVANT_COUNT = 5;

/** Votos mínimos para um comentário ser considerado relevante. */
export const RELEVANCE_THRESHOLD = 1;

export interface VoteState {
  /** Votos já usados na semana corrente. */
  used: number;
  /** Ids de comentário em que esta pessoa já votou. */
  votedOn: string[];
}

export interface VotableComment extends Comment {
  upvotes: number;
}

export function votesLeft(state: VoteState): number {
  return Math.max(0, WEEKLY_VOTE_BUDGET - state.used);
}

export type VoteRefusal = "sem-votos" | "ja-votou" | "proprio-comentario";

export interface VoteCheck {
  allowed: boolean;
  reason?: VoteRefusal;
}

/**
 * Decide se a pessoa pode votar num comentário.
 *
 * As três recusas existem por motivos diferentes: orçamento protege a escassez,
 * voto único evita empilhar, e o bloqueio ao próprio comentário evita a fraude
 * mais óbvia da economia inteira.
 */
export function canUpvote(state: VoteState, comment: VotableComment, voterId: string): VoteCheck {
  if (comment.authorId === voterId) return { allowed: false, reason: "proprio-comentario" };
  if (state.votedOn.includes(comment.id)) return { allowed: false, reason: "ja-votou" };
  if (votesLeft(state) <= 0) return { allowed: false, reason: "sem-votos" };
  return { allowed: true };
}

export const REFUSAL_MESSAGE: Record<VoteRefusal, string> = {
  "sem-votos": "Seus votos da semana acabaram. Eles voltam na segunda-feira.",
  "ja-votou": "Você já votou neste comentário.",
  "proprio-comentario": "Não é possível votar no próprio comentário.",
};

/** Aplica o voto. Devolve o novo estado e as moedas que o autor ganhou. */
export function applyUpvote(
  state: VoteState,
  comment: VotableComment,
  voterId: string,
): { state: VoteState; comment: VotableComment; coinsToAuthor: number } | null {
  if (!canUpvote(state, comment, voterId).allowed) return null;

  return {
    state: { used: state.used + 1, votedOn: [...state.votedOn, comment.id] },
    comment: { ...comment, upvotes: comment.upvotes + 1 },
    coinsToAuthor: COINS_PER_UPVOTE,
  };
}

/**
 * Ids dos comentários em destaque.
 *
 * Vale para respostas também: uma boa resposta do colega merece o mesmo
 * destaque de um bom comentário raiz. Empate é desfeito pelo mais antigo —
 * quem escreveu primeiro e continua sendo útil não perde lugar para um
 * recém-chegado com a mesma pontuação.
 */
export function relevantIds(comments: VotableComment[]): string[] {
  return comments
    .filter((comment) => comment.upvotes >= RELEVANCE_THRESHOLD)
    .slice()
    .sort((a, b) => (b.upvotes === a.upvotes ? a.createdAt.localeCompare(b.createdAt) : b.upvotes - a.upvotes))
    .slice(0, RELEVANT_COUNT)
    .map((comment) => comment.id);
}

/** Ordena mantendo os destaques no topo, sem esconder o resto. */
export function sortByRelevance(comments: VotableComment[]): VotableComment[] {
  const destaque = new Set(relevantIds(comments));

  return comments.slice().sort((a, b) => {
    const aDestaque = destaque.has(a.id);
    const bDestaque = destaque.has(b.id);
    if (aDestaque !== bDestaque) return aDestaque ? -1 : 1;
    if (aDestaque && bDestaque && b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export interface Highlight {
  userId: string;
  userName: string;
  /** Votos recebidos no período. */
  upvotesReceived: number;
  comments: number;
}

/**
 * Destaques do período, por **contribuição** — não por quantidade de aulas.
 *
 * A distinção é deliberada: ranquear conclusão de treinamento obrigatório
 * expõe quem está atrasado e transforma exigência em competição. Reconhecer
 * quem ajudou os colegas premia algo voluntário e não constrange ninguém.
 * Ver.
 */
export function highlights(
  comments: VotableComment[],
  names: Map<string, string>,
  limit = 3,
): Highlight[] {
  const byAuthor = new Map<string, Highlight>();

  for (const comment of comments) {
    const current = byAuthor.get(comment.authorId) ?? {
      userId: comment.authorId,
      userName: names.get(comment.authorId) ?? comment.authorName,
      upvotesReceived: 0,
      comments: 0,
    };
    current.upvotesReceived += comment.upvotes;
    current.comments += 1;
    byAuthor.set(comment.authorId, current);
  }

  return [...byAuthor.values()]
    .filter((item) => item.upvotesReceived > 0)
    .sort((a, b) =>
      b.upvotesReceived === a.upvotesReceived
        ? a.userName.localeCompare(b.userName, "pt-BR")
        : b.upvotesReceived - a.upvotesReceived,
    )
    .slice(0, limit);
}

/** Moedas ganhas com votos recebidos. */
export function coinsFromUpvotes(comments: VotableComment[], userId: string): number {
  return comments
    .filter((comment) => comment.authorId === userId)
    .reduce((total, comment) => total + comment.upvotes * COINS_PER_UPVOTE, 0);
}
