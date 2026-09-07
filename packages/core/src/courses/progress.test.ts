import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  COMPLETION_THRESHOLD,
  courseDurationSeconds,
  courseProgress,
  formatDuration,
  greeting,
  isLessonCompleted,
  lessonStatus,
  moduleProgress,
  resumePoint,
} from "./progress.ts";
import type { Course, Enrollment } from "./types.ts";
import { makeCourse, makeEnrollment, makeLesson, makeModule } from "./test-fixtures.ts";

const course = makeCourse({
  id: "c1",
  slug: "desenvolvimento-web",
  title: "Desenvolvimento Web Completo",
  summary: "Do zero ao avançado.",
  modules: [
    makeModule({
      id: "m1",
      title: "Fundamentos",
      lessons: [
        makeLesson({ id: "l1", title: "Aula 1", durationSeconds: 600 }),
        makeLesson({ id: "l2", title: "Aula 2", durationSeconds: 600 }),
      ],
    }),
    makeModule({
      id: "m2",
      title: "Frontend",
      lessons: [
        makeLesson({ id: "l3", title: "Aula 3", durationSeconds: 1200 }),
        makeLesson({ id: "l4", title: "Aula 4", durationSeconds: 1200 }),
      ],
    }),
  ],
});

function enrollment(progress: Record<string, number>, lastLessonId?: string): Enrollment {
  return makeEnrollment({
    courseId: course.id,
    /* O curso tem aula de 1200s; sem ele a fixture assumiria 600 e concluiria
       o que está em andamento. */
    course,
    progress,
    ...(lastLessonId === undefined ? {} : { lastLessonId }),
  });
}

describe("isLessonCompleted, limiar de 90%", () => {
  test("89% não conclui, 90% conclui", () => {
    assert.equal(isLessonCompleted(89, 100), false);
    assert.equal(isLessonCompleted(90, 100), true);
  });

  test("o limiar é exatamente o documentado", () => {
    assert.equal(COMPLETION_THRESHOLD, 0.9);
  });

  test("assistir além do fim continua concluído", () => {
    assert.equal(isLessonCompleted(150, 100), true);
  });

  test("duração inválida nunca conclui a aula", () => {
    for (const duration of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(isLessonCompleted(100, duration), false, String(duration));
    }
  });

  test("valores negativos ou não numéricos são tratados como zero", () => {
    assert.equal(isLessonCompleted(-50, 100), false);
    assert.equal(isLessonCompleted(Number.NaN, 100), false);
  });
});

describe("lessonStatus", () => {
  test("deriva os três estados a partir dos segundos assistidos", () => {
    const state = enrollment({ l1: 600, l2: 60 });
    assert.equal(lessonStatus(course.modules[0]!.lessons[0]!, state), "completed");
    assert.equal(lessonStatus(course.modules[0]!.lessons[1]!, state), "in_progress");
    assert.equal(lessonStatus(course.modules[1]!.lessons[0]!, state), "not_started");
  });
});

describe("courseProgress e moduleProgress", () => {
  test("percentual é por aulas concluídas, não por tempo assistido", () => {
    // 1 de 4 aulas concluídas, apesar de muito tempo acumulado em outra.
    const state = enrollment({ l1: 600, l3: 1000 });
    assert.deepEqual(courseProgress(course, state), {
      total: 4,
      completed: 1,
      percent: 25,
      status: "in_progress",
    });
  });

  test("curso sem progresso é not_started em 0%", () => {
    const summary = courseProgress(course, enrollment({}));
    assert.equal(summary.percent, 0);
    assert.equal(summary.status, "not_started");
  });

  test("curso inteiro concluído é 100% e completed", () => {
    const summary = courseProgress(course, enrollment({ l1: 600, l2: 600, l3: 1200, l4: 1200 }));
    assert.equal(summary.percent, 100);
    assert.equal(summary.status, "completed");
  });

  test("curso vazio é 0%, nunca 100%", () => {
    const empty: Course = { ...course, modules: [] };
    const summary = courseProgress(empty, enrollment({}));
    assert.equal(summary.percent, 0);
    assert.equal(summary.status, "not_started");
  });

  test("módulo é avaliado isoladamente", () => {
    const state = enrollment({ l1: 600, l2: 600 });
    assert.equal(moduleProgress(course.modules[0]!, state).percent, 100);
    assert.equal(moduleProgress(course.modules[1]!, state).percent, 0);
  });
});

describe("resumePoint", () => {
  test("sem progresso, começa na primeira aula", () => {
    const point = resumePoint(course, enrollment({}));
    assert.equal(point?.lesson.id, "l1");
    assert.equal(point?.resumeAtSeconds, 0);
  });

  test("retoma a última aula aberta e no segundo correto", () => {
    const point = resumePoint(course, enrollment({ l1: 600, l3: 300 }, "l3"));
    assert.equal(point?.lesson.id, "l3");
    assert.equal(point?.module.id, "m2");
    assert.equal(point?.resumeAtSeconds, 300);
  });

  test("se a última aula aberta já foi concluída, avança para a próxima pendente", () => {
    const point = resumePoint(course, enrollment({ l1: 600, l2: 600 }, "l2"));
    assert.equal(point?.lesson.id, "l3");
  });

  test("curso concluído não tem ponto de retomada", () => {
    assert.equal(resumePoint(course, enrollment({ l1: 600, l2: 600, l3: 1200, l4: 1200 })), null);
  });

  test("lastLessonId inexistente não quebra a retomada", () => {
    const point = resumePoint(course, enrollment({ l1: 600 }, "aula-que-nao-existe"));
    assert.equal(point?.lesson.id, "l2");
  });
});

describe("formatDuration", () => {
  test("formata horas e minutos", () => {
    assert.equal(formatDuration(courseDurationSeconds(course)), "1h");
    assert.equal(formatDuration(30600), "8h 30min");
    assert.equal(formatDuration(2700), "45min");
    assert.equal(formatDuration(7200), "2h");
  });

  test("não produz '0h 60min' no arredondamento", () => {
    assert.equal(formatDuration(3599), "1h");
  });

  test("entrada inválida vira 0min", () => {
    for (const value of [0, -1, Number.NaN]) {
      assert.equal(formatDuration(value), "0min", String(value));
    }
  });
});

describe("greeting", () => {
  test("cobre as três faixas do dia", () => {
    assert.equal(greeting(0), "Bom dia");
    assert.equal(greeting(11), "Bom dia");
    assert.equal(greeting(12), "Boa tarde");
    assert.equal(greeting(17), "Boa tarde");
    assert.equal(greeting(18), "Boa noite");
    assert.equal(greeting(23), "Boa noite");
  });

  test("hora inválida cai em um padrão seguro", () => {
    assert.equal(greeting(-3), "Boa tarde");
    assert.equal(greeting(99), "Boa tarde");
  });
});
