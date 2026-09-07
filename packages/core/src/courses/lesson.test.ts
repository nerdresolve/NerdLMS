import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { formatClock, lessonView } from "./lesson.ts";
import type { Enrollment } from "./types.ts";
import { makeCourse, makeEnrollment, makeLesson, makeModule } from "./test-fixtures.ts";

const course = makeCourse({
  id: "c1",
  slug: "curso",
  title: "Curso",
  summary: "Resumo.",
  artwork: 0,
  modules: [
    makeModule({
      id: "m1",
      title: "Módulo 1",
      lessons: [
        makeLesson({ id: "l1", title: "Aula 1", durationSeconds: 600 }),
        makeLesson({ id: "l2", title: "Aula 2", durationSeconds: 600 }),
      ],
    }),
    {
      id: "m2",
      title: "Módulo 2",
      lessons: [{ id: "l3", title: "Aula 3", durationSeconds: 1800 }],
    },
  ],
});

function enrollment(progress: Record<string, number>, lastLessonId?: string): Enrollment {
  return makeEnrollment({
    courseId: course.id,
    progress,
    ...(lastLessonId === undefined ? {} : { lastLessonId }),
  });
}

describe("lessonView", () => {
  test("resolve a aula, o módulo e a posição no curso", () => {
    const view = lessonView(course, enrollment({}), "l3");
    assert.equal(view?.module.id, "m2");
    assert.equal(view?.index, 3);
    assert.equal(view?.duration, "30min");
  });

  test("aula inexistente devolve null", () => {
    assert.equal(lessonView(course, enrollment({}), "nao-existe"), null);
  });

  test("aponta as aulas vizinhas, com null nas pontas", () => {
    assert.equal(lessonView(course, enrollment({}), "l1")?.previous, null);
    assert.equal(lessonView(course, enrollment({}), "l1")?.next?.id, "l2");
    assert.equal(lessonView(course, enrollment({}), "l3")?.next, null);
    assert.equal(lessonView(course, enrollment({}), "l3")?.previous?.id, "l2");
  });

  test("retoma no segundo assistido", () => {
    assert.equal(lessonView(course, enrollment({ l2: 180 }), "l2")?.resumeAtSeconds, 180);
  });

  test("aula concluída recomeça do zero", () => {
    const view = lessonView(course, enrollment({ l1: 600 }), "l1");
    assert.equal(view?.completed, true);
    assert.equal(view?.resumeAtSeconds, 0);
  });

  test("posição gravada acima da duração é limitada", () => {
    // 5000s numa aula de 1800s já conta como concluída, então volta a zero
    const view = lessonView(course, enrollment({ l3: 5000 }), "l3");
    assert.equal(view?.resumeAtSeconds, 0);
  });

  test("posição negativa gravada não vira tempo negativo", () => {
    assert.equal(lessonView(course, enrollment({ l2: -30 }), "l2")?.resumeAtSeconds, 0);
  });

  test("a trilha marca como atual a aula aberta, não a de retomada", () => {
    const view = lessonView(course, enrollment({ l1: 600, l2: 100 }), "l3");
    const states = view!.outline.modules.flatMap((module) => module.lessons.map((l) => [l.id, l.state]));
    assert.deepEqual(states, [["l1", "done"], ["l2", "todo"], ["l3", "current"]]);
    assert.equal(view?.outline.currentLessonId, "l3");
    assert.equal(view?.outline.defaultOpenModuleId, "m2");
  });

  test("existe no máximo uma aula atual na trilha", () => {
    const view = lessonView(course, enrollment({ l2: 100 }), "l1");
    const current = view!.outline.modules.flatMap((m) => m.lessons).filter((l) => l.state === "current");
    assert.equal(current.length, 1);
    assert.equal(current[0]?.id, "l1");
  });
});

describe("formatClock", () => {
  test("usa mm:ss abaixo de uma hora e h:mm:ss acima", () => {
    assert.equal(formatClock(0), "00:00");
    assert.equal(formatClock(9), "00:09");
    assert.equal(formatClock(65), "01:05");
    assert.equal(formatClock(600), "10:00");
    assert.equal(formatClock(3661), "1:01:01");
  });

  test("entrada inválida vira 00:00", () => {
    for (const value of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(formatClock(value), "00:00", String(value));
    }
  });
});
