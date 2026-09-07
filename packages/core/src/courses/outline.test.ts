import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { courseOutline } from "./outline.ts";
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
    makeModule({
      id: "m2",
      title: "Módulo 2",
      lessons: [
        makeLesson({ id: "l3", title: "Aula 3", durationSeconds: 1800 }),
        makeLesson({ id: "l4", title: "Aula 4", durationSeconds: 1800 }),
      ],
    }),
  ],
});

function enrollment(progress: Record<string, number>, lastLessonId?: string): Enrollment {
  return makeEnrollment({
    courseId: course.id,
    progress,
    ...(lastLessonId === undefined ? {} : { lastLessonId }),
  });
}

function states(outline: ReturnType<typeof courseOutline>) {
  return outline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.state));
}

describe("courseOutline", () => {
  test("numera as aulas continuamente entre módulos", () => {
    const outline = courseOutline(course, enrollment({}));
    assert.deepEqual(
      outline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.index)),
      [1, 2, 3, 4],
    );
    assert.equal(outline.lessonCount, 4);
  });

  test("marca exatamente uma aula como atual", () => {
    const outline = courseOutline(course, enrollment({ l1: 600, l2: 120 }));
    assert.deepEqual(states(outline), ["done", "current", "todo", "todo"]);
    assert.equal(states(outline).filter((state) => state === "current").length, 1);
  });

  test("a aula atual respeita a última aula aberta", () => {
    const outline = courseOutline(course, enrollment({ l1: 600 }, "l3"));
    assert.equal(outline.currentLessonId, "l3");
    assert.deepEqual(states(outline), ["done", "todo", "current", "todo"]);
  });

  test("curso concluído não tem aula atual", () => {
    const outline = courseOutline(course, enrollment({ l1: 600, l2: 600, l3: 1800, l4: 1800 }));
    assert.equal(outline.currentLessonId, null);
    assert.deepEqual(states(outline), ["done", "done", "done", "done"]);
    assert.equal(outline.progress.percent, 100);
  });

  test("abre por padrão o módulo que contém a aula atual", () => {
    assert.equal(courseOutline(course, enrollment({ l1: 600, l2: 600 })).defaultOpenModuleId, "m2");
    assert.equal(courseOutline(course, enrollment({})).defaultOpenModuleId, "m1");
  });

  test("curso concluído cai no primeiro módulo, sem quebrar", () => {
    const outline = courseOutline(course, enrollment({ l1: 600, l2: 600, l3: 1800, l4: 1800 }));
    assert.equal(outline.defaultOpenModuleId, "m1");
  });

  test("progresso e duração são calculados por módulo", () => {
    const outline = courseOutline(course, enrollment({ l1: 600, l2: 600 }));
    assert.equal(outline.modules[0]?.progress.percent, 100);
    assert.equal(outline.modules[1]?.progress.percent, 0);
    assert.equal(outline.modules[0]?.duration, "20min");
    assert.equal(outline.modules[1]?.duration, "1h");
    assert.equal(outline.duration, "1h 20min");
  });

  test("curso sem módulos não quebra a tela", () => {
    const outline = courseOutline({ ...course, modules: [] }, enrollment({}));
    assert.deepEqual(outline.modules, []);
    assert.equal(outline.defaultOpenModuleId, null);
    assert.equal(outline.currentLessonId, null);
    assert.equal(outline.progress.percent, 0);
  });
});
