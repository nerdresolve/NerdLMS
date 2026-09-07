import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  currentLevel,
  derivedLevel,
  evidenceCounts,
  expiringSoon,
  levelLabel,
  levelsByCompetency,
  planProgress,
  type Evidence,
} from "./proficiency.ts";

const AGORA = new Date("2026-06-01T00:00:00Z");

function ev(over: Partial<Evidence> = {}): Evidence {
  return {
    id: "e1",
    competencyId: "c1",
    level: 1,
    source: "course",
    createdAt: "2026-01-01T00:00:00Z",
    expiresAt: null,
    revokedAt: null,
    ...over,
  };
}

describe("Nível de domínio e gaps — F6-02", () => {
  test("evidência revogada e vencida não contam", () => {
    assert.equal(evidenceCounts(ev(), AGORA), true);
    assert.equal(evidenceCounts(ev({ revokedAt: "2026-03-01T00:00:00Z" }), AGORA), false);
    assert.equal(evidenceCounts(ev({ expiresAt: "2026-05-01T00:00:00Z" }), AGORA), false);
    assert.equal(evidenceCounts(ev({ expiresAt: "2026-12-01T00:00:00Z" }), AGORA), true);
  });

  test("vencer exatamente agora já não conta", () => {
    assert.equal(evidenceCounts(ev({ expiresAt: "2026-06-01T00:00:00Z" }), AGORA), false);
  });

  test("o nível vigente é o MAIOR, não o mais recente", () => {
    /* Fazer o curso básico depois do avançado não rebaixa ninguém — uma regra
       "vale a última" transformaria revisão de conteúdo em perda de
       qualificação. */
    const evidencias = [
      ev({ id: "a", level: 3, createdAt: "2026-01-01T00:00:00Z" }),
      ev({ id: "b", level: 1, createdAt: "2026-05-01T00:00:00Z" }),
    ];

    assert.equal(currentLevel(evidencias, AGORA), 3);
  });

  test("sem evidência que conte, o nível é zero", () => {
    assert.equal(currentLevel([], AGORA), 0);
    assert.equal(currentLevel([ev({ revokedAt: "2026-02-01T00:00:00Z" })], AGORA), 0);

    /* Revogar a evidência de nível 3 faz cair para a de nível 1 que sobrou —
       não para zero. */
    const evidencias = [
      ev({ id: "a", level: 3, revokedAt: "2026-02-01T00:00:00Z" }),
      ev({ id: "b", level: 1 }),
    ];
    assert.equal(currentLevel(evidencias, AGORA), 1);
  });

  test("níveis por competência ignoram as que ficaram em zero", () => {
    const niveis = levelsByCompetency(
      [
        ev({ competencyId: "c1", level: 2 }),
        ev({ competencyId: "c2", level: 3, revokedAt: "2026-02-01T00:00:00Z" }),
      ],
      AGORA,
    );

    assert.equal(niveis.get("c1"), 2);
    assert.equal(niveis.has("c2"), false);
  });

  test("gaps: o que falta para cumprir o plano", () => {
    const itens = [
      { competencyId: "c1", competencyName: "Operar ETA", requiredLevel: 2 },
      { competencyId: "c2", competencyName: "Análise laboratorial", requiredLevel: 1 },
      { competencyId: "c3", competencyName: "Segurança NR-33", requiredLevel: 3 },
    ];

    const progresso = planProgress(
      itens,
      [ev({ competencyId: "c1", level: 2 }), ev({ competencyId: "c3", level: 1 })],
      AGORA,
    );

    assert.equal(progresso.met, 1);
    assert.equal(progresso.total, 3);
    assert.equal(progresso.percent, 33);
    assert.equal(progresso.gaps.length, 2);

    const c2 = progresso.gaps.find((g) => g.competencyId === "c2")!;
    assert.equal(c2.currentLevel, 0);
    assert.equal(c2.missing, 1);

    const c3 = progresso.gaps.find((g) => g.competencyId === "c3")!;
    assert.equal(c3.currentLevel, 1);
    assert.equal(c3.missing, 2);
  });

  test('gap por VENCIMENTO se distingue de "nunca teve"', () => {
    /* As duas são gap, mas exigem ações diferentes: formação e reciclagem. E
       quem venceu costuma ser mais urgente — estava autorizado a fazer algo e
       deixou de estar sem ninguém notar. */
    const itens = [
      { competencyId: "c1", competencyName: "Venceu", requiredLevel: 2 },
      { competencyId: "c2", competencyName: "Nunca teve", requiredLevel: 2 },
    ];

    const progresso = planProgress(
      itens,
      [ev({ competencyId: "c1", level: 2, expiresAt: "2026-05-01T00:00:00Z" })],
      AGORA,
    );

    const venceu = progresso.gaps.find((g) => g.competencyId === "c1")!;
    const nunca = progresso.gaps.find((g) => g.competencyId === "c2")!;

    assert.equal(venceu.expired, true);
    assert.equal(nunca.expired, false);

    /* Os dois estão em zero HOJE — é o `expired` que os diferencia. */
    assert.equal(venceu.currentLevel, 0);
    assert.equal(nunca.currentLevel, 0);
  });

  test("plano sem item é 100%, não zero", () => {
    /* Não há nada por fazer. Mostrar 0% acusaria de incompleto quem não deve
       nada, e dividir por zero daria NaN na tela. */
    const progresso = planProgress([], [], AGORA);

    assert.equal(progresso.percent, 100);
    assert.equal(progresso.gaps.length, 0);
  });

  test("nível acima do exigido cumpre o item", () => {
    const progresso = planProgress(
      [{ competencyId: "c1", competencyName: "X", requiredLevel: 2 }],
      [ev({ competencyId: "c1", level: 3 })],
      AGORA,
    );

    assert.equal(progresso.met, 1);
    assert.equal(progresso.percent, 100);
  });

  test("o rótulo do nível respeita a base 1", () => {
    /* O nível é 1-based porque é assim que se contam degraus; o array é
       0-based. Trocar os dois mostra "Básico" onde deveria estar
       "Intermediário" — plausível o bastante para passar despercebido. */
    const escala = ["Básico", "Intermediário", "Avançado"];

    assert.equal(levelLabel(escala, 1), "Básico");
    assert.equal(levelLabel(escala, 2), "Intermediário");
    assert.equal(levelLabel(escala, 3), "Avançado");
    assert.equal(levelLabel(escala, 0), "Não avaliado");

    /* Nível além da escala não quebra: o framework pode ter encolhido depois
       de a evidência existir. */
    assert.equal(levelLabel(escala, 9), "Nível 9");
  });

  test("competência-mãe vale o MENOR nível entre as filhas", () => {
    /* Quem domina coagulação e não domina filtração não trata água: a corrente
       vale o elo mais fraco, e uma média esconderia o elo que impede a
       tarefa. */
    const nodes = [
      { id: "mae", parentId: null },
      { id: "f1", parentId: "mae" },
      { id: "f2", parentId: "mae" },
    ];

    const niveis = new Map([
      ["f1", 3],
      ["f2", 1],
    ]);

    assert.equal(derivedLevel("mae", nodes, niveis), 1);
  });

  test("filha sem evidência zera a mãe", () => {
    const nodes = [
      { id: "mae", parentId: null },
      { id: "f1", parentId: "mae" },
      { id: "f2", parentId: "mae" },
    ];

    assert.equal(derivedLevel("mae", nodes, new Map([["f1", 3]])), 0);
  });

  test("a árvore desce mais de um andar", () => {
    const nodes = [
      { id: "avo", parentId: null },
      { id: "mae", parentId: "avo" },
      { id: "neta", parentId: "mae" },
    ];

    assert.equal(derivedLevel("avo", nodes, new Map([["neta", 2]])), 2);
  });

  test("competência-folha usa a própria evidência", () => {
    const nodes = [{ id: "folha", parentId: null }];
    assert.equal(derivedLevel("folha", nodes, new Map([["folha", 2]])), 2);
  });

  test("vencimento próximo — a recertificação do §33", () => {
    const em20dias = ev({ id: "a", expiresAt: "2026-06-21T00:00:00Z" });
    const em90dias = ev({ id: "b", expiresAt: "2026-08-30T00:00:00Z" });
    const jaVenceu = ev({ id: "c", expiresAt: "2026-01-01T00:00:00Z" });
    const semPrazo = ev({ id: "d", expiresAt: null });

    const proximas = expiringSoon([em20dias, em90dias, jaVenceu, semPrazo], 30, AGORA);

    /* Só a que vence em 20 dias. Já vencida não "vence em breve" — ela já
       venceu, e o aviso é outro. */
    assert.deepEqual(
      proximas.map((e) => e.id),
      ["a"],
    );
  });
});
