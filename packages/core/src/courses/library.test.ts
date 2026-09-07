import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { toLibraryEntries } from "./catalog.ts";
import { makeCourse, makeEnrollment } from "./test-fixtures.ts";

describe("Biblioteca, o catálogo inteiro, com ou sem matrícula", () => {
  test("curso sem matrícula aparece, com progresso zerado", () => {
    // É a diferença entre a biblioteca e "Meus cursos": aqui o aluno descobre
    // curso novo, então curso não matriculado PRECISA aparecer.
    const curso = makeCourse({ id: "c1", authorId: "u2", lessonCount: 4 });
    const entries = toLibraryEntries([curso], []);

    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.enrolled, false);
    assert.equal(entries[0]!.enrollment, null);
    assert.equal(entries[0]!.summary.percent, 0);
    assert.equal(entries[0]!.summary.completed, 0);
    assert.equal(entries[0]!.saved, false);
  });

  test("curso matriculado mostra o progresso real", () => {
    const curso = makeCourse({ id: "c1", authorId: "u2", lessonCount: 4 });
    const matricula = makeEnrollment({
      courseId: "c1",
      completeFirst: { course: curso, count: 2 },
    });

    const entries = toLibraryEntries([curso], [matricula]);
    assert.equal(entries[0]!.enrolled, true);
    assert.equal(entries[0]!.summary.completed, 2);
    assert.equal(entries[0]!.summary.percent, 50);
  });

  test("o total de aulas aparece mesmo sem matrícula", () => {
    // O card diz "0 de 12 aulas": o denominador vem do curso, não da matrícula.
    const curso = makeCourse({ id: "c1", authorId: "u2", lessonCount: 12 });
    const entries = toLibraryEntries([curso], []);
    assert.equal(entries[0]!.summary.total, 12);
  });

  test("a matrícula de outro curso não vaza para este", () => {
    const a = makeCourse({ id: "c1", authorId: "u2", lessonCount: 4 });
    const b = makeCourse({ id: "c2", authorId: "u2", lessonCount: 4 });
    const matriculaDeA = makeEnrollment({ courseId: "c1" });

    const entries = toLibraryEntries([a, b], [matriculaDeA]);
    assert.equal(entries.find((e) => e.course.id === "c1")!.enrolled, true);
    assert.equal(entries.find((e) => e.course.id === "c2")!.enrolled, false);
  });

  test("catálogo vazio devolve lista vazia, sem quebrar", () => {
    assert.deepEqual(toLibraryEntries([], []), []);
  });

  test("marcador de salvo acompanha a matrícula", () => {
    const curso = makeCourse({ id: "c1", authorId: "u2", lessonCount: 2 });
    const salvo = makeEnrollment({ courseId: "c1", saved: true });
    assert.equal(toLibraryEntries([curso], [salvo])[0]!.saved, true);
  });
});
