import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { WEIGHTS, recommend } from "./recommendations.ts";
import type { Track } from "./tracks.ts";
import type { Course, Enrollment } from "./types.ts";
import { makeCourse, makeEnrollment, makeLesson, makeModule, makeUser, type CourseOptions } from "./test-fixtures.ts";

const aluno = makeUser({ id: "u1", fullName: "Maria Souza", project: "Unidade Leste" });

/** Aluno sem projeto — a chave é **omitida**, não atribuída como undefined. */
const semProjeto = makeUser({ id: "u2", fullName: "Sem Projeto" });

function curso(id: string, over: Omit<CourseOptions, "id"> = {}): Course {
  return makeCourse({
    id,
    authorId: "autor-a",
    modules: [makeModule({ id: `${id}-m`, title: "M", lessons: [makeLesson({ id: `${id}-l1`, title: "A1" })] })],
    ...over,
  });
}

function matricula(courseId: string, learnerId = "u1", concluido = false): Enrollment {
  return makeEnrollment({
    courseId,
    learnerId,
    progress: concluido ? { [`${courseId}-l1`]: 600 } : {},
  });
}

const semTrilhas: Track[] = [];

describe("O que nunca deve ser recomendado", () => {
  test("curso em que a pessoa já está matriculada", () => {
    const cursos = [curso("a"), curso("b")];
    const lista = recommend({
      user: aluno,
      courses: cursos,
      enrollments: [matricula("a")],
      allEnrollments: [matricula("a")],
      tracks: semTrilhas,
    });
    assert.deepEqual(lista.map((item) => item.course.id), ["b"]);
  });

  test("curso em rascunho", () => {
    const cursos = [curso("a", { status: "draft" }), curso("b")];
    const lista = recommend({ user: aluno, courses: cursos, enrollments: [], allEnrollments: [], tracks: semTrilhas });
    assert.deepEqual(lista.map((item) => item.course.id), ["b"]);
  });
});

describe("Prioridades", () => {
  test("treinamento obrigatório vence qualquer outro sinal", () => {
    const cursos = [
      curso("livre", { project: "Unidade Leste" }),
      curso("obrigatorio", { enrollmentMode: "assigned" }),
    ];
    const lista = recommend({ user: aluno, courses: cursos, enrollments: [], allEnrollments: [], tracks: semTrilhas });
    assert.equal(lista[0]?.course.id, "obrigatorio");
    assert.equal(lista[0]?.reason, "Treinamento obrigatório pendente");
  });

  test("próximo passo da trilha pesa mais que apenas fazer parte dela", () => {
    const cursos = [curso("a"), curso("b"), curso("c")];
    const trilha: Track = {
      id: "t",
      slug: "t",
      title: "Operação de Água",
      summary: "",
      courseIds: ["a", "b", "c"],
      mode: "sequential",
    };
    const lista = recommend({
      user: aluno,
      courses: cursos,
      // Concluiu o "a": o próximo da trilha é o "b".
      enrollments: [matricula("a", "u1", true)],
      allEnrollments: [matricula("a", "u1", true)],
      tracks: [trilha],
    });
    assert.equal(lista[0]?.course.id, "b");
    assert.equal(lista[0]?.reason, "Próximo passo da trilha Operação de Água");
  });

  test("curso do mesmo projeto sobe na lista", () => {
    const cursos = [curso("outro", { project: "Unidade Sul" }), curso("meu", { project: "Unidade Leste" })];
    const lista = recommend({ user: aluno, courses: cursos, enrollments: [], allEnrollments: [], tracks: semTrilhas });
    assert.equal(lista[0]?.course.id, "meu");
    assert.match(lista[0]!.reason, /Unidade Leste/);
  });

  test("popularidade entre colegas conta, mas não domina", () => {
    const cursos = [curso("popular"), curso("doProjeto", { project: "Unidade Leste" })];
    const colegas = ["s1", "s2", "s3"].map((id) => matricula("popular", id));
    const lista = recommend({
      user: aluno,
      courses: cursos,
      enrollments: [],
      allEnrollments: colegas,
      tracks: semTrilhas,
    });
    assert.equal(lista[0]?.course.id, "doProjeto", "projeto pesa mais que popularidade");
    assert.ok(WEIGHTS.sameProject > WEIGHTS.popular);
  });
});

describe("Explicabilidade", () => {
  test("toda recomendação tem motivo não vazio", () => {
    const cursos = [curso("a"), curso("b", { enrollmentMode: "assigned" })];
    for (const item of recommend({ user: aluno, courses: cursos, enrollments: [], allEnrollments: [], tracks: semTrilhas })) {
      assert.ok(item.reason.length > 0, item.course.id);
    }
  });

  test("curso sem nenhum sinal ainda recebe um motivo honesto", () => {
    // Ausência de projeto dos dois lados. Com `exactOptionalPropertyTypes`,
    // `{ project: undefined }` é "presente e indefinido", que é outra coisa —
    // e o que o teste quer verificar é a ausência.
    const lista = recommend({
      user: semProjeto,
      courses: [curso("a")],
      enrollments: [],
      allEnrollments: [],
      tracks: semTrilhas,
    });
    assert.equal(lista[0]?.reason, "Novo no catálogo");
    assert.equal(lista[0]?.score, 0);
  });
});

describe("Robustez", () => {
  test("respeita o limite pedido", () => {
    const cursos = ["a", "b", "c", "d", "e"].map((id) => curso(id));
    assert.equal(recommend({ user: aluno, courses: cursos, enrollments: [], allEnrollments: [], tracks: semTrilhas }, 2).length, 2);
  });

  test("catálogo vazio devolve lista vazia, não quebra", () => {
    assert.deepEqual(recommend({ user: aluno, courses: [], enrollments: [], allEnrollments: [], tracks: semTrilhas }), []);
  });

  test("sem colegas, popularidade não divide por zero", () => {
    const lista = recommend({ user: aluno, courses: [curso("a")], enrollments: [], allEnrollments: [], tracks: semTrilhas });
    assert.equal(Number.isFinite(lista[0]!.score), true);
  });

  test("empate de pontuação é desempatado pelo título, não pela ordem do array", () => {
    const cursos = [curso("z", { title: "Zebra" }), curso("a", { title: "Abelha" })];
    const lista = recommend({ user: aluno, courses: cursos, enrollments: [], allEnrollments: [], tracks: semTrilhas });
    assert.deepEqual(lista.map((item) => item.course.title), ["Abelha", "Zebra"]);
  });
});
