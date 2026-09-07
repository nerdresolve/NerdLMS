import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  abandonedEnrollments,
  courseDropoff,
  departmentPerformance,
  habitMetrics,
  videoRetention,
  worstDropoff,
  type LessonStep,
} from "./advanced.ts";

function step(over: Partial<LessonStep> = {}): LessonStep {
  return {
    lessonId: "l1",
    title: "Aula",
    moduleTitle: "Módulo 1",
    position: 1,
    completed: 0,
    started: 0,
    durationSeconds: 600,
    watchedSeconds: 0,
    ...over,
  };
}

describe("Analytics avançado: F6-06", () => {
  test("o funil mostra onde as pessoas param", () => {
    /* É a métrica que diz o que consertar: "40% de conclusão" não é acionável;
       "metade para na aula 3" diz exatamente onde olhar. */
    const pontos = courseDropoff(
      [
        step({ lessonId: "a", position: 1, completed: 90 }),
        step({ lessonId: "b", position: 2, completed: 80 }),
        step({ lessonId: "c", position: 3, completed: 30 }),
        step({ lessonId: "d", position: 4, completed: 28 }),
      ],
      100,
    );

    /* A aula 1 compara com os MATRICULADOS: 10 dos 100 nem começaram. */
    assert.equal(pontos[0]!.reached, 100);
    assert.equal(pontos[0]!.droppedHere, 10);

    /* A aula 3 é o buraco: 80 chegaram, 30 concluíram. */
    assert.equal(pontos[2]!.reached, 80);
    assert.equal(pontos[2]!.droppedHere, 50);
    assert.equal(pontos[2]!.dropoffPercent, 63);

    /* Retenção é sobre o total inicial, não sobre quem chegou. */
    assert.equal(pontos[3]!.retentionPercent, 28);
  });

  test("o funil respeita a ordem, não a ordem do array", () => {
    const pontos = courseDropoff(
      [
        step({ lessonId: "c", position: 3, completed: 30 }),
        step({ lessonId: "a", position: 1, completed: 90 }),
        step({ lessonId: "b", position: 2, completed: 80 }),
      ],
      100,
    );

    assert.deepEqual(
      pontos.map((p) => p.lessonId),
      ["a", "b", "c"],
    );
  });

  test("conclusão fora de ordem não gera abandono negativo", () => {
    /* Acontece quando alguém pula para o fim: a aula 3 teria mais conclusões
       que a 2, e a subtração daria negativo. */
    const pontos = courseDropoff(
      [
        step({ lessonId: "a", position: 1, completed: 10 }),
        step({ lessonId: "b", position: 2, completed: 25 }),
      ],
      50,
    );

    assert.ok(pontos.every((p) => p.droppedHere >= 0));
    assert.equal(pontos[1]!.droppedHere, 0);
  });

  test("curso sem matrícula não divide por zero", () => {
    const pontos = courseDropoff([step({ completed: 0 })], 0);

    assert.equal(pontos[0]!.dropoffPercent, 0);
    assert.equal(pontos[0]!.retentionPercent, 0);
  });

  test("a pior etapa é a de mais VOLUME, não de maior percentual", () => {
    /* 3 de 4 é 75% de abandono, mas 40 de 200 perde treze vezes mais gente.
       Quem vai consertar precisa saber onde está o volume. */
    const pontos = courseDropoff(
      [
        step({ lessonId: "grande", position: 1, completed: 160 }),
        step({ lessonId: "pequena", position: 2, completed: 158 }),
      ],
      200,
    );

    const pior = worstDropoff(pontos)!;
    assert.equal(pior.lessonId, "grande");
    assert.equal(pior.droppedHere, 40);
  });

  test("sem abandono em lugar nenhum, não há pior etapa", () => {
    const pontos = courseDropoff([step({ completed: 10 })], 10);
    assert.equal(worstDropoff(pontos), null);
  });

  test("retenção de vídeo: quanto do vídeo a pessoa média assiste", () => {
    const retencao = videoRetention(
      [
        step({ lessonId: "a", durationSeconds: 600, started: 10, watchedSeconds: 3000 }),
        step({ lessonId: "b", durationSeconds: 600, started: 10, watchedSeconds: 5700 }),
      ],
      new Map([["b", 8]]),
    );

    /* 3000 / 10 = 300s de 600 = 50%. */
    assert.equal(retencao[0]!.retentionPercent, 50);
    assert.equal(retencao[0]!.averageWatchedSeconds, 300);
    assert.equal(retencao[0]!.finished, 0);

    assert.equal(retencao[1]!.retentionPercent, 95);
    assert.equal(retencao[1]!.finished, 8);
  });

  test("rever um trecho não faz a retenção passar de 100%", () => {
    /* O player reporta posição; quem reviu pode somar mais que a duração.
       Passar de 100% diria que a pessoa assistiu mais vídeo do que existe. */
    const retencao = videoRetention(
      [step({ durationSeconds: 600, started: 2, watchedSeconds: 3000 })],
      new Map(),
    );

    assert.equal(retencao[0]!.retentionPercent, 100);
  });

  test("aula sem duração fica fora da retenção de vídeo", () => {
    /* Documento e texto não têm o que reter, e dividir por zero daria
       Infinity. */
    const retencao = videoRetention(
      [step({ durationSeconds: 0, started: 5, watchedSeconds: 0 })],
      new Map(),
    );

    assert.equal(retencao.length, 0);
  });

  test("vídeo sem espectador não divide por zero", () => {
    const retencao = videoRetention(
      [step({ durationSeconds: 600, started: 0, watchedSeconds: 0 })],
      new Map(),
    );

    assert.equal(retencao[0]!.retentionPercent, 0);
    assert.equal(retencao[0]!.viewers, 0);
  });

  test("DAU/WAU/MAU e a aderência", () => {
    const dias = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      users: 20,
    }));

    const m = habitMetrics(dias, 80, 200);

    assert.equal(m.dau, 20);
    assert.equal(m.wau, 80);
    assert.equal(m.mau, 200);
    /* 20/200 = 10%: a pessoa média entra 3 dias por mês. */
    assert.equal(m.stickiness, 10);
  });

  test("dia sem ninguém conta como zero na média", () => {
    /* Ignorá-lo inflaria a média de uma plataforma que ficou parada metade do
       mês. */
    const dias = [
      { date: "2026-06-01", users: 100 },
      { date: "2026-06-02", users: 0 },
      { date: "2026-06-03", users: 0 },
      { date: "2026-06-04", users: 0 },
    ];

    assert.equal(habitMetrics(dias, 100, 100).dau, 25);
  });

  test("plataforma pequena não vira zero por arredondamento", () => {
    /* 4 pessoas num mês dá média de 0,13/dia. `Math.round` daria 0, e a tela
       mostraria "0 pessoas por dia" logo acima de "4 na última semana" — o
       número vira mentira pelo arredondamento, não pelo cálculo. */
    const dias = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      users: i === 29 ? 4 : 0,
    }));

    const m = habitMetrics(dias, 4, 8);

    assert.ok(m.dau > 0, "média positiva não pode virar zero");
    assert.equal(m.dau, 0.1);
    assert.ok(m.stickiness >= 0);
  });

  test("sem atividade nenhuma, tudo é zero, não NaN", () => {
    const m = habitMetrics([], 0, 0);

    assert.equal(m.dau, 0);
    assert.equal(m.stickiness, 0);
    assert.ok(!Number.isNaN(m.stickiness));
  });

  test("abandono exige ter COMEÇADO e ter PARADO", () => {
    /* Quem começou ontem não abandonou nada; quem nem começou também não. */
    const candidatos = [
      { learnerId: "a", learnerName: "A", courseId: "c", courseTitle: "C", percent: 40, daysIdle: 60 },
      { learnerId: "b", learnerName: "B", courseId: "c", courseTitle: "C", percent: 40, daysIdle: 3 },
      { learnerId: "c", learnerName: "C", courseId: "c", courseTitle: "C", percent: 0, daysIdle: 90 },
      { learnerId: "d", learnerName: "D", courseId: "c", courseTitle: "C", percent: 100, daysIdle: 90 },
    ];

    const abandonados = abandonedEnrollments(candidatos);

    assert.deepEqual(
      abandonados.map((a) => a.learnerId),
      ["a"],
    );
  });

  test("o corte de dias parados é ajustável", () => {
    /* Treinamento obrigatório com prazo de uma semana precisa de outro corte. */
    const candidatos = [
      { learnerId: "a", learnerName: "A", courseId: "c", courseTitle: "C", percent: 50, daysIdle: 10 },
    ];

    assert.equal(abandonedEnrollments(candidatos, 30).length, 0);
    assert.equal(abandonedEnrollments(candidatos, 7).length, 1);
  });

  test("o abandono mais antigo vem primeiro", () => {
    const candidatos = [
      { learnerId: "a", learnerName: "A", courseId: "c", courseTitle: "C", percent: 50, daysIdle: 40 },
      { learnerId: "b", learnerName: "B", courseId: "c", courseTitle: "C", percent: 50, daysIdle: 200 },
    ];

    assert.equal(abandonedEnrollments(candidatos)[0]!.learnerId, "b");
  });

  test("desempenho por área: pior taxa PRIMEIRO", () => {
    /* Quem abre o relatório quer saber onde intervir. A boa notícia em cima
       esconderia o problema no fim da lista. */
    const desempenho = departmentPerformance([
      { department: "Operação", learnerId: "u1", percent: 100, completed: true },
      { department: "Operação", learnerId: "u2", percent: 100, completed: true },
      { department: "Campo", learnerId: "u3", percent: 20, completed: false },
      { department: "Campo", learnerId: "u4", percent: 40, completed: false },
    ]);

    assert.equal(desempenho[0]!.department, "Campo");
    assert.equal(desempenho[0]!.completionRate, 0);
    assert.equal(desempenho[0]!.averagePercent, 30);

    assert.equal(desempenho[1]!.department, "Operação");
    assert.equal(desempenho[1]!.completionRate, 100);
  });

  test("gente sem unidade vira grupo próprio, não some", () => {
    /* Esconder faria o total não fechar. */
    const desempenho = departmentPerformance([
      { department: null, learnerId: "u1", percent: 50, completed: false },
      { department: "Campo", learnerId: "u2", percent: 50, completed: false },
    ]);

    assert.equal(desempenho.length, 2);
    assert.ok(desempenho.some((d) => d.department === "Sem unidade"));
  });

  test("a mesma pessoa em dois cursos conta uma vez como pessoa", () => {
    const desempenho = departmentPerformance([
      { department: "Campo", learnerId: "u1", percent: 100, completed: true },
      { department: "Campo", learnerId: "u1", percent: 0, completed: false },
    ]);

    assert.equal(desempenho[0]!.learners, 1);
    assert.equal(desempenho[0]!.enrollments, 2);
    /* A média é por MATRÍCULA: (100 + 0) / 2. */
    assert.equal(desempenho[0]!.averagePercent, 50);
  });
});
