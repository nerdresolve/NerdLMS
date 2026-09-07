import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { catalogCounts, queryCatalog, type CatalogItem } from "./catalog.ts";
import { makeCourse } from "./test-fixtures.ts";
import type { EstadoDoCurso } from "./completion.ts";
import type { ProgressSummary } from "./progress.ts";

/**
 * Os filtros do catálogo, e a soma que eles precisam fechar.
 *
 * "Não iniciados" entrou porque as abas anteriores não cobriam o conjunto: um
 * curso matriculado e nunca aberto não aparecia em "Em andamento" nem em
 * "Concluídos", e a soma das abas ficava menor que o total.
 */

const resumo = (status: ProgressSummary["status"], percent = 0): ProgressSummary => ({
  total: 4,
  completed: status === "completed" ? 4 : status === "in_progress" ? 2 : 0,
  percent,
  status,
});

function item(
  id: string,
  status: ProgressSummary["status"],
  extras: { saved?: boolean; estado?: EstadoDoCurso } = {},
): CatalogItem {
  return {
    course: makeCourse({ id, title: `Curso ${id}`, status: "published" }),
    summary: resumo(status, status === "completed" ? 100 : status === "in_progress" ? 50 : 0),
    saved: extras.saved ?? false,
    ...(extras.estado ? { estado: extras.estado } : {}),
  };
}

describe("Filtros do catálogo", () => {
  const entries: CatalogItem[] = [
    item("a", "not_started"),
    item("b", "not_started", { saved: true }),
    item("c", "in_progress"),
    item("d", "completed", { estado: "concluido" }),
    /* Aulas terminadas e prova pendente: o curso NÃO está concluído. */
    item("e", "completed", { estado: "falta-prova" }),
  ];

  test("não iniciados traz só quem nunca abriu", () => {
    const r = queryCatalog(entries, { filter: "not_started" });
    assert.deepEqual(r.map((e) => e.course.id).sort(), ["a", "b"]);
  });

  test("quem deve a prova conta como em andamento, e não como não iniciado", () => {
    /* O estado das aulas diz `completed`; o do curso, `falta-prova`. Se o
       filtro olhasse só as aulas, este curso sumiria das três abas. */
    const andamento = queryCatalog(entries, { filter: "in_progress" });
    assert.ok(andamento.some((e) => e.course.id === "e"));

    const naoIniciados = queryCatalog(entries, { filter: "not_started" });
    assert.ok(!naoIniciados.some((e) => e.course.id === "e"));
  });

  test("os três estados somam o total", () => {
    /* É o motivo de "Não iniciados" existir. Sem ele, a conta não fechava e
       quem olhava as abas concluía que faltavam cursos. */
    const c = catalogCounts(entries);
    assert.equal(c.not_started + c.in_progress + c.completed, c.all);
  });

  test("nenhum curso cai em duas abas de estado ao mesmo tempo", () => {
    for (const entry of entries) {
      const em = ["not_started", "in_progress", "completed"].filter(
        (filtro) =>
          queryCatalog([entry], { filter: filtro as "not_started" }).length === 1,
      );
      assert.equal(em.length, 1, `${entry.course.id} caiu em ${em.join(", ")}`);
    }
  });

  test("salvos atravessa os outros e fica fora da soma", () => {
    /* Um curso salvo continua sendo não iniciado, em andamento ou concluído.
       Somar "Salvos" às outras três contaria o mesmo curso duas vezes. */
    const c = catalogCounts(entries);
    assert.equal(c.saved, 1);
    assert.ok(c.saved <= c.all);
  });
});
