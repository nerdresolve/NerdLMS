import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  COINS_PER_UPVOTE,
  WEEKLY_VOTE_BUDGET,
  applyUpvote,
  canUpvote,
  coinsFromUpvotes,
  highlights,
  relevantIds,
  sortByRelevance,
  votesLeft,
  type VotableComment,
  type VoteState,
} from "./social.ts";

function comentario(id: string, upvotes: number, authorId = "outro", createdAt = "2026-08-01T10:00:00-03:00"): VotableComment {
  return {
    id,
    lessonId: "l1",
    authorId,
    authorName: authorId,
    body: "texto",
    createdAt,
    highlighted: false,
    upvotes,
    /* O estado do botão para quem vê. Estes testes medem a REGRA de voto
       (orçamento, voto repetido, comentário próprio), não o estado visual —
       por isso `false` fixo em vez de virar parâmetro. */
    votedByViewer: false,
  };
}

const semVotos: VoteState = { used: 0, votedOn: [] };

describe("Orçamento semanal", () => {
  test("começa cheio", () => {
    assert.equal(votesLeft(semVotos), WEEKLY_VOTE_BUDGET);
  });

  test("diminui a cada voto e não fica negativo", () => {
    assert.equal(votesLeft({ used: WEEKLY_VOTE_BUDGET, votedOn: [] }), 0);
    assert.equal(votesLeft({ used: 99, votedOn: [] }), 0);
  });
});

describe("Quem pode votar", () => {
  test("não vota no próprio comentário — é a fraude mais óbvia da economia", () => {
    const meu = comentario("c1", 0, "u1");
    assert.deepEqual(canUpvote(semVotos, meu, "u1"), { allowed: false, reason: "proprio-comentario" });
  });

  test("não vota duas vezes no mesmo comentário", () => {
    const estado: VoteState = { used: 1, votedOn: ["c1"] };
    assert.deepEqual(canUpvote(estado, comentario("c1", 1), "u1"), { allowed: false, reason: "ja-votou" });
  });

  test("sem votos na semana, não vota", () => {
    const estado: VoteState = { used: WEEKLY_VOTE_BUDGET, votedOn: [] };
    assert.deepEqual(canUpvote(estado, comentario("c9", 0), "u1"), { allowed: false, reason: "sem-votos" });
  });

  test("caso normal é permitido", () => {
    assert.deepEqual(canUpvote(semVotos, comentario("c1", 0), "u1"), { allowed: true });
  });
});

describe("Aplicar o voto", () => {
  test("consome um voto, soma no comentário e rende moedas ao autor", () => {
    const resultado = applyUpvote(semVotos, comentario("c1", 2), "u1");
    assert.equal(resultado?.state.used, 1);
    assert.deepEqual(resultado?.state.votedOn, ["c1"]);
    assert.equal(resultado?.comment.upvotes, 3);
    assert.equal(resultado?.coinsToAuthor, COINS_PER_UPVOTE);
  });

  test("voto recusado não altera nada", () => {
    assert.equal(applyUpvote(semVotos, comentario("c1", 0, "u1"), "u1"), null);
  });

  test("não muta o estado nem o comentário recebidos", () => {
    const estado: VoteState = { used: 0, votedOn: [] };
    const alvo = comentario("c1", 2);
    applyUpvote(estado, alvo, "u1");
    assert.equal(estado.used, 0);
    assert.equal(alvo.upvotes, 2);
  });
});

describe("Relevância", () => {
  test("destaca no máximo cinco, os mais votados", () => {
    const lista = Array.from({ length: 8 }, (_, i) => comentario(`c${i}`, i + 1));
    const ids = relevantIds(lista);
    assert.equal(ids.length, 5);
    assert.deepEqual(ids, ["c7", "c6", "c5", "c4", "c3"]);
  });

  test("comentário sem voto não vira destaque", () => {
    assert.deepEqual(relevantIds([comentario("c1", 0)]), []);
  });

  test("empate vai para o mais antigo — quem ajudou primeiro não perde lugar", () => {
    const antigo = comentario("antigo", 3, "a", "2026-08-01T09:00:00-03:00");
    const novo = comentario("novo", 3, "b", "2026-08-05T09:00:00-03:00");
    assert.deepEqual(relevantIds([novo, antigo]), ["antigo", "novo"]);
  });

  test("resposta também pode ser destaque", () => {
    const resposta: VotableComment = { ...comentario("r1", 9), parentId: "c1" };
    assert.ok(relevantIds([comentario("c1", 1), resposta]).includes("r1"));
  });

  test("ordenar por relevância não esconde ninguém", () => {
    const lista = [comentario("sem", 0), comentario("com", 4)];
    const ordenada = sortByRelevance(lista);
    assert.equal(ordenada.length, 2);
    assert.equal(ordenada[0]?.id, "com");
  });
});

describe("Destaques do período", () => {
  const nomes = new Map([["a", "Ana"], ["b", "Bruno"]]);

  test("ranqueia por votos recebidos, não por volume de comentários", () => {
    const lista = [
      comentario("1", 10, "a"),
      comentario("2", 0, "b"),
      comentario("3", 0, "b"),
      comentario("4", 1, "b"),
    ];
    const top = highlights(lista, nomes);
    assert.equal(top[0]?.userId, "a");
    assert.equal(top[0]?.upvotesReceived, 10);
    assert.equal(top[1]?.userId, "b");
  });

  test("quem não recebeu voto não aparece — a lista reconhece, não expõe", () => {
    assert.deepEqual(highlights([comentario("1", 0, "b")], nomes), []);
  });

  test("respeita o limite", () => {
    const lista = ["a", "b", "c", "d"].map((id, i) => comentario(String(i), 5, id));
    assert.equal(highlights(lista, nomes, 2).length, 2);
  });
});

describe("Moedas por voto recebido", () => {
  test("soma os votos de todos os comentários da pessoa", () => {
    const lista = [comentario("1", 3, "a"), comentario("2", 1, "a"), comentario("3", 9, "b")];
    assert.equal(coinsFromUpvotes(lista, "a"), 4 * COINS_PER_UPVOTE);
  });

  test("quem não comentou não ganha nada", () => {
    assert.equal(coinsFromUpvotes([comentario("1", 5, "a")], "z"), 0);
  });
});
