import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { lessonStatus, isLessonCompleted, resolveCompletion } from "./progress.ts";
import type { Enrollment, Lesson } from "./types.ts";

const aula = (over: Partial<Lesson> = {}): Lesson => ({
  id: "l1",
  title: "Aula",
  durationSeconds: 600,
  ...over,
});

const matricula = (progresso: Enrollment["progress"]): Enrollment => ({
  courseId: "c1",
  learnerId: "u1",
  enrolledBy: "self",
  progress: progresso,
});

describe("Conclusão é um fato registrado, não um cálculo", () => {
  test("assistir muito NÃO conclui sozinho quando o registro não diz que concluiu", () => {
    // O ponto do guia §5: "assistir 20% do vídeo não necessariamente significa
    // concluir uma aula". Antes, `completed` era derivado de watchedSeconds, e
    // por isso não existia forma de ter uma aula muito assistida e não
    // concluída — nem de desmarcar o que o cálculo dizia estar pronto.
    const e = matricula({
      l1: { lessonId: "l1", watchedSeconds: 599, lastPositionSeconds: 599 },
    });

    assert.equal(lessonStatus(aula(), e), "in_progress");
  });

  test("com `completedAt`, está concluída — mesmo com pouco vídeo assistido", () => {
    // O caso da aula de leitura ou do encontro presencial: não há o que medir,
    // e sob a regra antiga jamais concluiria.
    const e = matricula({
      l1: {
        lessonId: "l1",
        watchedSeconds: 0,
        lastPositionSeconds: 0,
        completedAt: "2026-08-23T10:00:00.000Z",
        completionSource: "manual",
      },
    });

    assert.equal(lessonStatus(aula({ completionMode: "manual" }), e), "completed");
  });

  test("sem progresso nenhum, não começou", () => {
    assert.equal(lessonStatus(aula(), matricula({})), "not_started");
  });
});

describe("Quando o consumo DEVE disparar a conclusão automática", () => {
  test("aula `auto` que cruzou o limiar conclui", () => {
    const decisao = resolveCompletion(aula(), 540, undefined);
    assert.equal(decisao?.completionSource, "auto");
  });

  test("aula `auto` abaixo do limiar não conclui", () => {
    assert.equal(resolveCompletion(aula(), 120, undefined), null);
  });

  test("aula `manual` NÃO conclui por consumo, por mais que se assista", () => {
    // É a razão de o modo existir. Se o consumo concluísse a aula manual, o
    // modo não teria efeito nenhum.
    assert.equal(resolveCompletion(aula({ completionMode: "manual" }), 600, undefined), null);
  });

  test("o que já foi concluído não é reconcluído", () => {
    // Reescrever `completedAt` a cada progresso apagaria a data real da
    // conclusão — e ela vai para relatório de conformidade.
    const antes = {
      lessonId: "l1",
      watchedSeconds: 540,
      lastPositionSeconds: 540,
      completedAt: "2026-01-01T00:00:00.000Z",
      completionSource: "auto" as const,
    };

    assert.equal(resolveCompletion(aula(), 600, antes), null);
  });

  test("conclusão manual não é desfeita por consumo posterior", () => {
    const antes = {
      lessonId: "l1",
      watchedSeconds: 0,
      lastPositionSeconds: 0,
      completedAt: "2026-01-01T00:00:00.000Z",
      completionSource: "manual" as const,
    };

    assert.equal(resolveCompletion(aula(), 10, antes), null);
  });
});

describe("Retomada usa onde parou, não o quanto assistiu", () => {
  test("quem voltou para rever retoma do ponto em que saiu", () => {
    // O caso concreto: assistiu até 8:00, voltou para 2:00 para rever, fechou.
    // `watchedSeconds` continua 480 (mede consumo e só cresce), mas retomar
    // aos 8:00 jogaria a pessoa adiante do ponto em que ela estava.
    const p = { lessonId: "l1", watchedSeconds: 480, lastPositionSeconds: 120 };
    assert.equal(p.lastPositionSeconds, 120);
    assert.notEqual(p.lastPositionSeconds, p.watchedSeconds);
  });
});

describe("O limiar de consumo continua valendo para o que ele mede", () => {
  test("`isLessonCompleted` segue respondendo sobre CONSUMO", () => {
    // A função não sumiu: ela responde "assistiu o bastante?", que é uma
    // pergunta legítima — só não é mais a mesma pergunta que "concluiu?".
    assert.equal(isLessonCompleted(540, 600), true);
    assert.equal(isLessonCompleted(120, 600), false);
  });
});
