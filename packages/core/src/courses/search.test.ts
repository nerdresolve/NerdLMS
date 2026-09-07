import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { searchCourses } from "./search.ts";
import { makeCourse, makeModule } from "./test-fixtures.ts";

const cloro = makeCourse({
  id: "c1",
  slug: "seguranca",
  title: "Segurança em Operações de Campo",
  summary: "Risco, EPI e resposta a emergência.",
  modules: [
    makeModule({
      id: "m1",
      title: "Emergências",
      lessons: [
        { id: "l1", title: "Vazamento de cloro", durationSeconds: 600 },
        { id: "l2", title: "Evacuação", durationSeconds: 600 },
      ],
    }),
  ],
});

const perdas = makeCourse({
  id: "c2",
  slug: "perdas",
  title: "Gestão de Perdas na Distribuição",
  summary: "Balanço hídrico e pesquisa de vazamento.",
  modules: [
    makeModule({
      id: "m2",
      title: "Campo",
      lessons: [{ id: "l3", title: "Geofonamento", durationSeconds: 600 }],
    }),
  ],
});

const catalogo = [cloro, perdas];

describe("Busca global, encontra curso e aula", () => {
  test("termo vazio não devolve nada", () => {
    // Sem isto, abrir a busca listaria o catálogo inteiro como se fosse
    // resultado de uma pergunta que ninguém fez.
    assert.deepEqual(searchCourses(catalogo, ""), []);
    assert.deepEqual(searchCourses(catalogo, "   "), []);
  });

  test("acha a AULA, não só o curso", () => {
    // É a razão de existir desta busca: quem procura "cloro" quer a aula que
    // fala de cloro, não o curso inteiro de segurança.
    const hits = searchCourses(catalogo, "cloro");

    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.kind, "lesson");
    assert.equal(hits[0]!.title, "Vazamento de cloro");
    assert.equal(hits[0]!.href, "/aulas/l1");
  });

  test("o contexto diz onde a aula vive", () => {
    // Uma lista de títulos soltos não ajuda: "Evacuação" pode ser de qualquer
    // curso, e sem o contexto a pessoa clica para descobrir.
    const hits = searchCourses(catalogo, "evacuacao");
    assert.equal(hits[0]!.context, "Segurança em Operações de Campo · Emergências");
  });

  test("ignora acento e caixa", () => {
    // O catálogo é pt-BR: quem digita sem acento precisa achar o mesmo.
    const comAcento = searchCourses(catalogo, "Segurança");
    const sem = searchCourses(catalogo, "seguranca");
    assert.deepEqual(
      comAcento.map((hit) => hit.id),
      sem.map((hit) => hit.id),
    );
    assert.ok(sem.length > 0);
  });

  test("todos os termos precisam casar", () => {
    // "gestao perdas" acha; "gestao cloro" não, porque nenhum item tem os dois.
    assert.ok(searchCourses(catalogo, "gestao perdas").length > 0);
    assert.equal(searchCourses(catalogo, "gestao cloro").length, 0);
  });

  test("título pesa mais que resumo", () => {
    // "vazamento" está no título de uma aula e no resumo de um curso. A aula
    // vem antes: casar no título é sinal mais forte do que casar no meio de
    // um parágrafo.
    const hits = searchCourses(catalogo, "vazamento");
    assert.equal(hits[0]!.kind, "lesson");
    assert.equal(hits[0]!.title, "Vazamento de cloro");
  });

  test("respeita o limite", () => {
    assert.equal(searchCourses(catalogo, "a", 1).length <= 1, true);
  });

  test("busca só o que recebe", () => {
    // O recorte de permissão é de quem chama. Curso fora da lista não aparece,
    // e é assim que rascunho e curso de outro projeto ficam invisíveis.
    assert.equal(searchCourses([perdas], "cloro").length, 0);
  });
});
