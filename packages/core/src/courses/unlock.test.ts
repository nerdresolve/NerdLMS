import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { evaluateUnlock, lessonUnlockState, type UnlockContext, type UnlockRule } from "./unlock.ts";
import { makeCourse, makeEnrollment, makeLesson, makeModule } from "./test-fixtures.ts";

const contexto = (over: Partial<UnlockContext> = {}): UnlockContext => ({
  completedCourses: new Set(),
  completedModules: new Set(),
  completedLessons: new Set(),
  classIds: new Set(),
  today: "2026-03-15",
  ...over,
});

describe("Um critério de cada vez", () => {
  test("curso concluído libera", () => {
    const regra: UnlockRule = { kind: "course_completed", requiredCourseId: "c1" };
    assert.equal(evaluateUnlock([regra], contexto({ completedCourses: new Set(["c1"]) })).unlocked, true);
  });

  test("curso NÃO concluído bloqueia", () => {
    const regra: UnlockRule = { kind: "course_completed", requiredCourseId: "c1" };
    assert.equal(evaluateUnlock([regra], contexto()).unlocked, false);
  });

  test("aula concluída libera", () => {
    const regra: UnlockRule = { kind: "lesson_completed", requiredLessonId: "l1" };
    assert.equal(evaluateUnlock([regra], contexto({ completedLessons: new Set(["l1"]) })).unlocked, true);
  });

  test("data futura bloqueia, data passada libera", () => {
    assert.equal(evaluateUnlock([{ kind: "date", requiredDate: "2026-06-01" }], contexto()).unlocked, false);
    assert.equal(evaluateUnlock([{ kind: "date", requiredDate: "2026-01-01" }], contexto()).unlocked, true);
  });

  test("a data de hoje já libera", () => {
    // "Disponível a partir de 15/03" precisa abrir NO dia 15, não no 16.
    assert.equal(evaluateUnlock([{ kind: "date", requiredDate: "2026-03-15" }], contexto()).unlocked, true);
  });

  test("pertencer à turma libera", () => {
    const regra: UnlockRule = { kind: "class_member", requiredClassId: "t1" };
    assert.equal(evaluateUnlock([regra], contexto({ classIds: new Set(["t1"]) })).unlocked, true);
  });
});

describe("Critérios COMBINADOS, o que o guia §11 pede", () => {
  test("todos precisam ser atendidos", () => {
    const regras: UnlockRule[] = [
      { kind: "course_completed", requiredCourseId: "c1" },
      { kind: "date", requiredDate: "2026-01-01" },
    ];

    assert.equal(evaluateUnlock(regras, contexto({ completedCourses: new Set(["c1"]) })).unlocked, true);
  });

  test("um critério não atendido basta para bloquear", () => {
    const regras: UnlockRule[] = [
      { kind: "course_completed", requiredCourseId: "c1" },
      { kind: "date", requiredDate: "2026-12-01" },
    ];

    const r = evaluateUnlock(regras, contexto({ completedCourses: new Set(["c1"]) }));
    assert.equal(r.unlocked, false);
  });

  test("sem regra nenhuma, está liberado", () => {
    // A ausência de regra é o caso normal: a maioria do conteúdo é aberta.
    assert.equal(evaluateUnlock([], contexto()).unlocked, true);
  });

  test("o motivo do bloqueio é o PRIMEIRO não atendido", () => {
    // A tela mostra uma frase, e listar cinco pendências de uma vez seria pior
    // que apontar a próxima.
    const regras: UnlockRule[] = [
      { kind: "date", requiredDate: "2026-12-01" },
      { kind: "course_completed", requiredCourseId: "c1" },
    ];

    const r = evaluateUnlock(regras, contexto());
    assert.equal(r.unlocked === false && r.blockedBy.kind, "date");
  });
});

describe("Critérios que ainda não têm como ser avaliados", () => {
  test("nota mínima bloqueia enquanto avaliação não existe", () => {
    // F3 ainda não chegou. O erro perigoso seria liberar por não saber avaliar:
    // um curso que exige nota 70 ficaria aberto a quem não fez prova nenhuma.
    const regra: UnlockRule = { kind: "min_grade", requiredCourseId: "c1", requiredGrade: 70 };
    assert.equal(evaluateUnlock([regra], contexto()).unlocked, false);
  });

  test("competência bloqueia pelo mesmo motivo", () => {
    assert.equal(evaluateUnlock([{ kind: "competency" }], contexto()).unlocked, false);
  });
});

describe("Liberação sequencial: F2-05", () => {
  const curso = makeCourse({
    id: "c1",
    modules: [
      makeModule({
        id: "m1",
        lessons: [
          makeLesson({ id: "l1", title: "Aula 1" }),
          makeLesson({ id: "l2", title: "Aula 2" }),
          makeLesson({ id: "l3", title: "Aula 3" }),
        ],
      }),
    ],
  });

  const sequencial = { ...curso, contentRelease: "sequential" as const };

  test("a primeira aula está sempre liberada", () => {
    // Sem isto o curso sequencial não teria por onde começar.
    const e = makeEnrollment({ courseId: "c1", course: curso });
    assert.equal(lessonUnlockState(sequencial, e, "l1", []).unlocked, true);
  });

  test("a segunda só abre depois da primeira", () => {
    const semNada = makeEnrollment({ courseId: "c1", course: curso });
    assert.equal(lessonUnlockState(sequencial, semNada, "l2", []).unlocked, false);

    const comPrimeira = makeEnrollment({ courseId: "c1", course: curso, progress: { l1: 600 } });
    assert.equal(lessonUnlockState(sequencial, comPrimeira, "l2", []).unlocked, true);
  });

  test("pular uma aula não libera a seguinte", () => {
    // Concluiu a 1 e a 3 (por acesso direto na URL, digamos). A 3 continua
    // dependendo da 2 — senão a sequência não é sequência.
    const e = makeEnrollment({ courseId: "c1", course: curso, progress: { l1: 600 } });
    assert.equal(lessonUnlockState(sequencial, e, "l3", []).unlocked, false);
  });

  test("curso aberto libera tudo, em qualquer ordem", () => {
    const e = makeEnrollment({ courseId: "c1", course: curso });
    assert.equal(lessonUnlockState(curso, e, "l3", []).unlocked, true);
  });

  test("regra explícita vale MESMO em curso aberto", () => {
    // As duas coisas se somam: a liberação sequencial é um atalho para o caso
    // comum, não um substituto das regras.
    const e = makeEnrollment({ courseId: "c1", course: curso });
    const regras: UnlockRule[] = [{ kind: "date", requiredDate: "2026-12-01" }];

    assert.equal(lessonUnlockState(curso, e, "l1", regras, "2026-03-15").unlocked, false);
  });
});
