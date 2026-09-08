import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { catalogCounts, normalizeForSearch, queryCatalog, toCatalogEntries } from "@nerdlms/core/courses/catalog.ts";
import { courses, enrollments } from "../../mocks/data.ts";

const entries = toCatalogEntries(courses, enrollments);
const titles = (list: ReturnType<typeof queryCatalog>) => list.map((entry) => entry.course.title);

describe("normalizeForSearch", () => {
  test("ignora acento, caixa e espaço redundante", () => {
    assert.equal(normalizeForSearch("  Óleo   e GÁS "), "oleo e gas");
    assert.equal(normalizeForSearch("Manutenção"), "manutencao");
  });
});

describe("toCatalogEntries", () => {
  test("só inclui cursos com matrícula", () => {
    assert.equal(entries.length, enrollments.length);
    const semMatricula = toCatalogEntries(courses, []);
    assert.deepEqual(semMatricula, []);
  });

  test("deriva percentual e status de cada curso", () => {
    const primeiro = entries.find((entry) => entry.course.id === "c1");
    assert.equal(primeiro?.summary.percent, 72);
    assert.equal(primeiro?.summary.status, "in_progress");
  });
});

describe("queryCatalog, filtros", () => {
  test("em andamento exclui não iniciados e concluídos", () => {
    const list = queryCatalog(entries, { filter: "in_progress" });
    assert.ok(list.every((entry) => entry.summary.status === "in_progress"));
    assert.ok(list.length > 0);
  });

  test("concluídos traz apenas 100%", () => {
    const list = queryCatalog(entries, { filter: "completed" });
    assert.deepEqual(list.map((entry) => entry.summary.percent), [100]);
  });

  test("salvos respeita a marcação do aluno", () => {
    const list = queryCatalog(entries, { filter: "saved" });
    assert.ok(list.every((entry) => entry.saved));
    assert.equal(list.length, 2);
  });
});

describe("queryCatalog, busca", () => {
  test("encontra sem acento", () => {
    /* "pratica" acha "Prática": é o caso que a normalização existe para cobrir,
       porque ninguém digita acento na busca. */
    assert.deepEqual(titles(queryCatalog(entries, { search: "pratica" })), ["TypeScript na Prática"]);
  });

  test("exige todos os termos, em qualquer ordem", () => {
    assert.equal(queryCatalog(entries, { search: "typescript pratica" }).length, 1);
    assert.equal(queryCatalog(entries, { search: "pratica typescript" }).length, 1);
    assert.equal(queryCatalog(entries, { search: "typescript inexistente" }).length, 0);
  });

  test("busca também no resumo do curso", () => {
    /* "deploy" não está em nenhum título — só no resumo de Fundamentos de Web
       Moderna. É o que prova que a busca alcança o resumo. */
    assert.ok(queryCatalog(entries, { search: "deploy" }).length >= 1);
  });

  test("busca vazia ou só espaços não filtra nada", () => {
    assert.equal(queryCatalog(entries, { search: "   " }).length, entries.length);
  });

  test("busca combina com filtro", () => {
    assert.equal(queryCatalog(entries, { filter: "completed", search: "pratica" }).length, 0);
  });
});

describe("queryCatalog, ordenação", () => {
  test("continue coloca em andamento primeiro e concluídos por último", () => {
    const list = queryCatalog(entries, { sort: "continue" });
    assert.equal(list[0]?.summary.status, "in_progress");
    assert.equal(list.at(-1)?.summary.status, "completed");
  });

  test("alfabética usa a collation pt-BR", () => {
    const list = titles(queryCatalog(entries, { sort: "alphabetical" }));
    assert.deepEqual(list, [...list].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  test("maior progresso ordena do maior para o menor", () => {
    const list = queryCatalog(entries, { sort: "progress" }).map((entry) => entry.summary.percent);
    assert.deepEqual(list, [...list].sort((a, b) => b - a));
  });

  test("não altera o array recebido", () => {
    const antes = entries.map((entry) => entry.course.id);
    queryCatalog(entries, { sort: "alphabetical" });
    assert.deepEqual(entries.map((entry) => entry.course.id), antes);
  });
});

describe("catalogCounts", () => {
  test("conta cada aba sobre o conjunto completo", () => {
    const counts = catalogCounts(entries);
    assert.equal(counts.all, entries.length);
    assert.equal(counts.all, counts.in_progress + counts.completed + entries.filter((e) => e.summary.status === "not_started").length);
  });
});
