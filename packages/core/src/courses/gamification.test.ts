import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  BADGES,
  COINS_PER_COURSE,
  COINS_PER_LESSON,
  REWARDS,
  affordable,
  badgesFor,
  balanceOf,
  earningsOf,
  levelOf,
} from "./gamification.ts";
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

describe("Moedas ganhas", () => {
  const cursos = [curso("a", 4), curso("b", 10)];

  test("soma aulas concluídas e bônus por curso concluído", () => {
    const ganho = earningsOf(cursos, [matricula("a", 4), matricula("b", 2)]);
    assert.equal(ganho.lessonsCompleted, 6);
    assert.equal(ganho.coursesCompleted, 1);
    assert.equal(ganho.coins, 6 * COINS_PER_LESSON + 1 * COINS_PER_COURSE);
  });

  test("sem progresso não há moeda", () => {
    assert.equal(earningsOf(cursos, [matricula("a", 0)]).coins, 0);
  });

  test("matrícula de curso inexistente é ignorada, não vira moeda de graça", () => {
    assert.equal(earningsOf(cursos, [matricula("fantasma", 99)]).coins, 0);
  });

  test("terminar o curso vale mais que a soma das aulas, o bônus recompensa concluir", () => {
    const soAulas = earningsOf([curso("a", 4)], [matricula("a", 3)]).coins;
    const completo = earningsOf([curso("a", 4)], [matricula("a", 4)]).coins;
    assert.ok(completo - soAulas > COINS_PER_LESSON, "o salto ao concluir precisa ser maior que uma aula");
  });
});

describe("Saldo", () => {
  test("saldo é ganho menos gasto", () => {
    assert.equal(balanceOf(1000, 300), 700);
  });

  test("gasto maior que ganho não vira saldo negativo", () => {
    assert.equal(balanceOf(100, 500), 0);
  });
});

describe("Nível", () => {
  test("começa no nível 1", () => {
    const nivel = levelOf(0);
    assert.equal(nivel.level, 1);
    assert.equal(nivel.percent, 0);
  });

  test("sobe ao cruzar o limiar", () => {
    assert.equal(levelOf(199).level, 1);
    assert.equal(levelOf(200).level, 2);
    assert.equal(levelOf(500).level, 3);
  });

  test("no meio do nível a barra reflete a fração", () => {
    // Nível 2 vai de 200 a 500. Em 350 está na metade.
    assert.equal(levelOf(350).percent, 50);
  });

  test("no último nível a barra fica cheia em vez de dividir por zero", () => {
    const nivel = levelOf(99999);
    assert.equal(nivel.next, null);
    assert.equal(nivel.percent, 100);
  });

  test("valor inválido é tratado como zero", () => {
    for (const valor of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(levelOf(valor).level, 1, String(valor));
    }
  });

  test("gastar não rebaixa: o nível usa o ganho acumulado", () => {
    const ganho = 1200;
    const saldo = balanceOf(ganho, 1100);
    assert.equal(levelOf(ganho).level, 4);
    assert.ok(levelOf(ganho).level > levelOf(saldo).level, "é por isso que o nível não usa saldo");
  });
});

describe("Distintivos", () => {
  test("são condições sobre o esforço real, avaliadas na hora", () => {
    const nenhum = badgesFor({ lessonsCompleted: 0, coursesCompleted: 0, coins: 0 });
    assert.equal(nenhum.every((badge) => !badge.earned), true);

    const alguns = badgesFor({ lessonsCompleted: 10, coursesCompleted: 1, coins: 200 });
    const conquistados = alguns.filter((badge) => badge.earned).map((badge) => badge.id);
    assert.deepEqual(conquistados, ["primeira-aula", "dez-aulas", "primeiro-curso"]);
  });

  test("todo distintivo tem título, descrição e ícone", () => {
    for (const badge of BADGES) {
      assert.ok(badge.title.length > 0, badge.id);
      assert.ok(badge.description.length > 0, badge.id);
      assert.ok(badge.icon.length > 0, badge.id);
    }
  });

  test("ids são únicos", () => {
    const ids = BADGES.map((badge) => badge.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("Loja", () => {
  test("mostra só o que o saldo alcança", () => {
    /* A REGRA, não a lista. A versão anterior fixava ids do catálogo
       ("r2", "r4"), e quebrava a cada item que o RH trocasse — sem que nada
       estivesse errado. O que precisa valer é a fronteira: o que cabe entra, o
       que não cabe fica de fora. */
    const saldo = 800;
    const alcance = affordable(REWARDS, saldo);

    for (const item of alcance) {
      assert.ok(item.cost <= saldo, `${item.title} custa ${item.cost} e entrou com saldo ${saldo}`);
    }

    for (const item of REWARDS.filter((r) => !alcance.includes(r))) {
      assert.ok(item.cost > saldo, `${item.title} custa ${item.cost} e ficou de fora`);
    }
  });

  test("nenhuma recompensa gera custo para a empresa", () => {
    /* A regra do catálogo, escrita como teste: recompensa que a plataforma
       oferece e a empresa não pode honrar vira frustração com prazo marcado.
       A lista de palavras é grosseira de propósito — ela não prova ausência de
       custo, só pega a reincidência óbvia de quem acrescentar um item sem ler
       o comentário do catálogo. */
    const COMPROMETE = [
      "folga", "vale", "crédito", "kit", "brinde", "garrafa", "caderno",
      "almoço", "jantar", "café", "viagem", "prêmio em dinheiro", "bônus",
    ];

    for (const reward of REWARDS) {
      const texto = `${reward.title} ${reward.description}`.toLowerCase();
      for (const palavra of COMPROMETE) {
        assert.ok(
          !texto.includes(palavra),
          `"${reward.title}" sugere custo ou compromisso de terceiro ("${palavra}")`,
        );
      }
    }
  });

  test("todo item tem custo positivo e título", () => {
    for (const reward of REWARDS) {
      assert.ok(reward.cost > 0, reward.id);
      assert.ok(reward.title.length > 0, reward.id);
    }
  });

  test("saldo zero não alcança nada", () => {
    assert.deepEqual(affordable(REWARDS, 0), []);
  });
});
