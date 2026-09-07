import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { courseEngagement, engagementSummary, learnerRows } from "./engagement.ts";
import type { Course, Enrollment } from "./types.ts";
import { makeCourse, makeEnrollment } from "./test-fixtures.ts";

function curso(id: string, aulas: number): Course {
  return makeCourse({ id, authorId: "u2", lessonCount: aulas });
}

/* `aulas` não é mais parâmetro: os ids das aulas vêm do id do curso, e o
   número total nunca era usado aqui. Era argumento morto. */
function matricula(courseId: string, learnerId: string, concluidas: number): Enrollment {
  return makeEnrollment({
    courseId,
    learnerId,
    progress: Object.fromEntries(
      Array.from({ length: concluidas }, (_, index) => [`${courseId}-m1-l${index + 1}`, 600]),
    ),
  });
}

describe("courseEngagement", () => {
  const a = curso("a", 4);

  test("conta matriculados e classifica por situação", () => {
    const dados = courseEngagement(a, [
      matricula("a", "s1", 0),
      matricula("a", "s2", 2),
      matricula("a", "s3", 4),
    ]);
    assert.equal(dados.learners, 3);
    assert.equal(dados.notStarted, 1);
    assert.equal(dados.inProgress, 1);
    assert.equal(dados.completed, 1);
  });

  test("média é ponderada por aula concluída, não por aluno", () => {
    // 0 + 2 + 4 = 6 de 12 aulas possíveis = 50%
    const dados = courseEngagement(a, [
      matricula("a", "s1", 0),
      matricula("a", "s2", 2),
      matricula("a", "s3", 4),
    ]);
    assert.equal(dados.averagePercent, 50);
    assert.equal(dados.lessonsCompleted, 6);
  });

  test("curso sem matrícula é 0%, não divide por zero", () => {
    const dados = courseEngagement(a, []);
    assert.equal(dados.learners, 0);
    assert.equal(dados.averagePercent, 0);
  });

  test("ignora matrícula de outro curso", () => {
    const dados = courseEngagement(a, [matricula("b", "s1", 4)]);
    assert.equal(dados.learners, 0);
  });
});

describe("engagementSummary", () => {
  const a = curso("a", 4);
  const b = curso("b", 20);

  test("conta pessoas distintas, não matrículas", () => {
    const dados = engagementSummary(
      [a, b],
      [matricula("a", "s1", 1), matricula("b", "s1", 1), matricula("a", "s2", 0)],
    );
    assert.equal(dados.learners, 2, "s1 faz dois cursos e conta uma vez");
    assert.equal(dados.enrollments, 3);
  });

  test("a média não é média de médias: o curso maior pesa mais", () => {
    // Curso a: 4 de 4 aulas = 100%. Curso b: 0 de 20 = 0%.
    // Média de médias daria 50%; a ponderada dá 4/24 = 17%.
    const dados = engagementSummary([a, b], [matricula("a", "s1", 4), matricula("b", "s2", 0)]);
    assert.equal(dados.averagePercent, 17);
  });

  test("soma conclusões entre cursos", () => {
    const dados = engagementSummary([a, b], [matricula("a", "s1", 4), matricula("b", "s2", 20)]);
    assert.equal(dados.completions, 2);
  });

  test("ordena os cursos por número de alunos", () => {
    const dados = engagementSummary(
      [a, b],
      [matricula("a", "s1", 0), matricula("b", "s2", 0), matricula("b", "s3", 0)],
    );
    assert.equal(dados.courses[0]?.course.id, "b");
  });

  test("sem cursos nem matrículas não quebra", () => {
    const dados = engagementSummary([], []);
    assert.deepEqual(dados, { courses: [], learners: 0, enrollments: 0, averagePercent: 0, completions: 0 });
  });
});

describe("learnerRows", () => {
  test("uma linha por matrícula, com percentual e situação", () => {
    const a = curso("a", 4);
    const linhas = learnerRows([a], [matricula("a", "s1", 2), matricula("a", "s2", 4)]);
    assert.deepEqual(linhas, [
      { learnerId: "s1", courseId: "a", percent: 50, status: "in_progress" },
      { learnerId: "s2", courseId: "a", percent: 100, status: "completed" },
    ]);
  });

  test("descarta matrícula de curso fora do recorte — é assim que o instrutor não vê turma alheia", () => {
    const a = curso("a", 4);
    assert.deepEqual(learnerRows([a], [matricula("z", "s1", 4)]), []);
  });
});
