import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { trackView, visibleTracks, type Track } from "./tracks.ts";
import type { Course, Enrollment } from "./types.ts";
import { makeCourse } from "./test-fixtures.ts";

function curso(id: string, aulas: number): Course {
  return makeCourse({ id, authorId: "u2", lessonCount: aulas });
}

function matricula(courseId: string, concluidas: number): Enrollment {
  return {
    courseId,
    learnerId: "u1",
    enrolledBy: "self",
    progress: Object.fromEntries(
      Array.from({ length: concluidas }, (_, i) => [
        `${courseId}-m1-l${i + 1}`,
        /* Conclusão é fato registrado desde a 006 (guia §5): assistir muito
           não conclui sozinho. Este helper diz "N aulas CONCLUÍDAS", então
           grava a conclusão em vez de torcer para o cálculo inferi-la. */
        {
          lessonId: `${courseId}-m1-l${i + 1}`,
          watchedSeconds: 600,
          lastPositionSeconds: 600,
          completedAt: "2026-01-01T00:00:00.000Z",
          completionSource: "auto" as const,
        },
      ]),
    ),
  };
}

const cursos = [curso("a", 2), curso("b", 4), curso("c", 4)];

const sequencial: Track = {
  id: "t1",
  slug: "t1",
  title: "Trilha",
  summary: "",
  courseIds: ["a", "b", "c"],
  mode: "sequential",
};

describe("Trilha sequencial", () => {
  test("sem progresso: o primeiro é o atual e os demais ficam bloqueados", () => {
    const view = trackView(sequencial, cursos, []);
    assert.deepEqual(view.steps.map((s) => s.state), ["current", "locked", "locked"]);
    assert.equal(view.nextCourseId, "a");
  });

  test("concluir o primeiro libera o segundo", () => {
    const view = trackView(sequencial, cursos, [matricula("a", 2)]);
    assert.deepEqual(view.steps.map((s) => s.state), ["completed", "current", "locked"]);
    assert.equal(view.nextCourseId, "b");
  });

  test("progresso parcial não libera o próximo", () => {
    const view = trackView(sequencial, cursos, [matricula("a", 1)]);
    assert.deepEqual(view.steps.map((s) => s.state), ["current", "locked", "locked"]);
  });

  test("trilha inteira concluída não tem próximo curso", () => {
    const view = trackView(sequencial, cursos, [matricula("a", 2), matricula("b", 4), matricula("c", 4)]);
    assert.deepEqual(view.steps.map((s) => s.state), ["completed", "completed", "completed"]);
    assert.equal(view.nextCourseId, null);
    assert.equal(view.percent, 100);
  });
});

describe("Trilha livre", () => {
  const livre: Track = { ...sequencial, mode: "free" };

  test("nada fica bloqueado", () => {
    const view = trackView(livre, cursos, []);
    assert.deepEqual(view.steps.map((s) => s.state), ["current", "available", "available"]);
  });

  test("o atual é o primeiro não concluído, mesmo pulando a ordem", () => {
    const view = trackView(livre, cursos, [matricula("b", 4)]);
    assert.deepEqual(view.steps.map((s) => s.state), ["current", "completed", "available"]);
  });
});

describe("Percentual da trilha", () => {
  test("é por aula concluída, não média de cursos", () => {
    // a: 2/2 = 100%. b: 0/4. c: 0/4. Média de cursos daria 33%; por aula, 20%.
    const view = trackView(sequencial, cursos, [matricula("a", 2)]);
    assert.equal(view.percent, 20);
    assert.equal(view.completedCourses, 1);
    assert.equal(view.totalCourses, 3);
  });

  test("trilha sem curso é 0%, não divide por zero", () => {
    const vazia: Track = { ...sequencial, courseIds: [] };
    const view = trackView(vazia, cursos, []);
    assert.equal(view.percent, 0);
    assert.equal(view.nextCourseId, null);
  });
});

describe("Robustez", () => {
  test("curso removido do catálogo some da trilha em vez de quebrar", () => {
    const comFantasma: Track = { ...sequencial, courseIds: ["a", "inexistente", "b"] };
    const view = trackView(comFantasma, cursos, []);
    assert.equal(view.steps.length, 2);
    assert.deepEqual(view.steps.map((s) => s.course.id), ["a", "b"]);
  });

  test("posição reflete a ordem declarada, não a ordem exibida", () => {
    const view = trackView(sequencial, cursos, []);
    assert.deepEqual(view.steps.map((s) => s.position), [1, 2, 3]);
  });
});

describe("visibleTracks", () => {
  const geral: Track = { ...sequencial, id: "geral" };
  const dePrologos: Track = { ...sequencial, id: "prolagos", project: "Prolagos" };

  test("trilha sem projeto aparece para todos", () => {
    assert.deepEqual(visibleTracks([geral], undefined).map((t) => t.id), ["geral"]);
  });

  test("trilha de projeto só aparece para quem é do projeto", () => {
    assert.deepEqual(visibleTracks([geral, dePrologos], "Prolagos").map((t) => t.id), ["geral", "prolagos"]);
    assert.deepEqual(visibleTracks([geral, dePrologos], "Escola Social").map((t) => t.id), ["geral"]);
  });
});
