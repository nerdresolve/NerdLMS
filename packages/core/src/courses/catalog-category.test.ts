import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { queryCatalog, toLibraryEntries } from "./catalog.ts";
import { makeCourse, makeEnrollment } from "./test-fixtures.ts";
import type { Course } from "./types.ts";

/**
 * Navegação por categoria e tag no catálogo — F2-01.
 */

const categoria = (id: string, name: string, slug: string, parentName?: string) => ({
  id,
  name,
  slug,
  ...(parentName ? { parentName } : {}),
});

const cursos: Course[] = [
  makeCourse({
    id: "c1",
    title: "NR-10 Básico",
    status: "published",
    category: categoria("cat-el", "Elétrica", "eletrica", "Segurança"),
  }),
  makeCourse({
    id: "c2",
    title: "Trabalho em Altura",
    status: "published",
    category: categoria("cat-alt", "Altura", "altura", "Segurança"),
  }),
  makeCourse({
    id: "c3",
    title: "Tratamento de Água",
    status: "published",
    category: categoria("cat-ta", "Tratamento", "tratamento", "Operação"),
  }),
  makeCourse({ id: "c4", title: "Curso sem categoria", status: "published" }),
];

const entries = toLibraryEntries(cursos, []);

describe("Filtro por categoria", () => {
  test("mostra só os cursos da categoria pedida", () => {
    const lista = queryCatalog(entries, { categorySlug: "eletrica" });
    assert.deepEqual(
      lista.map((e) => e.course.id),
      ["c1"],
    );
  });

  test("sem categoria pedida, mostra tudo", () => {
    assert.equal(queryCatalog(entries, {}).length, 4);
  });

  test("categoria inexistente devolve vazio, não tudo", () => {
    // Um filtro que não casa nada precisa devolver nada. Cair no "mostra tudo"
    // faria o aluno pensar que aquela categoria tem o catálogo inteiro.
    assert.deepEqual(queryCatalog(entries, { categorySlug: "nao-existe" }), []);
  });

  test("curso sem categoria não aparece em filtro de categoria", () => {
    const lista = queryCatalog(entries, { categorySlug: "eletrica" });
    assert.ok(!lista.some((e) => e.course.id === "c4"));
  });
});

describe("Busca alcança categoria e tag", () => {
  test("buscar pelo nome da categoria encontra o curso", () => {
    // Quem digita "elétrica" espera achar o curso de NR-10, mesmo que a palavra
    // não esteja no título nem no resumo.
    const lista = queryCatalog(entries, { search: "eletrica" });
    assert.ok(lista.some((e) => e.course.id === "c1"));
  });

  test("buscar pela categoria mãe encontra as filhas", () => {
    const lista = queryCatalog(entries, { search: "seguranca" });
    assert.deepEqual(
      lista.map((e) => e.course.id).sort(),
      ["c1", "c2"],
    );
  });

  test("busca por título continua funcionando", () => {
    const lista = queryCatalog(entries, { search: "altura" });
    assert.ok(lista.some((e) => e.course.id === "c2"));
  });
});

describe("Curso fora do catálogo (visibility: unlisted)", () => {
  const comOculto = toLibraryEntries(
    [
      ...cursos,
      makeCourse({
        id: "c5",
        title: "Treinamento sigiloso",
        status: "published",
        visibility: "unlisted",
      }),
    ],
    [],
  );

  test("não aparece na listagem", () => {
    // É a razão de `visibility` existir separada de `status`: o curso está
    // publicado e acessível a quem for matriculado, mas fora da vitrine.
    assert.ok(!queryCatalog(comOculto, {}).some((e) => e.course.id === "c5"));
  });

  test("não aparece nem buscando pelo título exato", () => {
    const lista = queryCatalog(comOculto, { search: "sigiloso" });
    assert.equal(lista.length, 0);
  });

  test("mas aparece para quem JÁ está matriculado", () => {
    // Esconder do catálogo não pode esconder de quem já cursa — o curso sumiria
    // de "Meus cursos" e o progresso viraria um link quebrado.
    const comMatricula = toLibraryEntries(
      [
        makeCourse({
          id: "c5",
          title: "Treinamento sigiloso",
          status: "published",
          visibility: "unlisted",
        }),
      ],
      [makeEnrollment({ courseId: "c5" })],
    );

    assert.equal(queryCatalog(comMatricula, {}).length, 1);
  });
});
