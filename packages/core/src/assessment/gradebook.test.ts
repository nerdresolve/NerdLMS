import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  applyLatePenalty,
  canSubmit,
  courseGrade,
  currentGrades,
  meetsCertificateGrade,
  type GradeEntry,
  type SubmissionRules,
} from "./gradebook.ts";

const nota = (over: Partial<GradeEntry>): GradeEntry => ({
  id: "g1",
  activityId: "a1",
  activityKind: "quiz",
  pointsEarned: 8,
  pointsPossible: 10,
  weight: 1,
  createdAt: "2026-03-01T10:00:00Z",
  ...over,
});

describe("A nota vigente é a última lançada", () => {
  test("com um lançamento, é ele", () => {
    const vigentes = currentGrades([nota({})]);
    assert.equal(vigentes.length, 1);
    assert.equal(vigentes[0]?.pointsEarned, 8);
  });

  test("com reavaliação, vale a mais recente", () => {
    // O histórico continua no banco; o que a tela mostra é a nota atual.
    const vigentes = currentGrades([
      nota({ id: "g1", pointsEarned: 5, createdAt: "2026-03-01T10:00:00Z" }),
      nota({ id: "g2", pointsEarned: 7, createdAt: "2026-03-20T14:00:00Z" }),
    ]);

    assert.equal(vigentes.length, 1);
    assert.equal(vigentes[0]?.pointsEarned, 7);
  });

  test("atividades diferentes convivem", () => {
    const vigentes = currentGrades([
      nota({ id: "g1", activityId: "prova-1" }),
      nota({ id: "g2", activityId: "trabalho-1", activityKind: "assignment" }),
    ]);

    assert.equal(vigentes.length, 2);
  });

  test("a ordem de entrada não importa — vale a data", () => {
    // O banco devolve por `created_at`, mas depender disso deixaria a regra
    // refém da cláusula ORDER BY de quem consultar.
    const vigentes = currentGrades([
      nota({ id: "g2", pointsEarned: 7, createdAt: "2026-03-20T14:00:00Z" }),
      nota({ id: "g1", pointsEarned: 5, createdAt: "2026-03-01T10:00:00Z" }),
    ]);

    assert.equal(vigentes[0]?.pointsEarned, 7);
  });
});

describe("Nota final do curso", () => {
  test("média ponderada pelos pesos", () => {
    // Prova vale 2, trabalho vale 1: (80×2 + 50×1) / 3 = 70
    const g = courseGrade([
      nota({ id: "g1", activityId: "p", pointsEarned: 8, pointsPossible: 10, weight: 2 }),
      nota({ id: "g2", activityId: "t", pointsEarned: 5, pointsPossible: 10, weight: 1 }),
    ]);

    assert.equal(g, 70);
  });

  test("pesos iguais é média simples", () => {
    const g = courseGrade([
      nota({ id: "g1", activityId: "p", pointsEarned: 10, pointsPossible: 10 }),
      nota({ id: "g2", activityId: "t", pointsEarned: 6, pointsPossible: 10 }),
    ]);

    assert.equal(g, 80);
  });

  test("sem nota nenhuma, não há nota do curso", () => {
    // `null`, não zero: quem não tem atividade avaliada não tirou zero.
    assert.equal(courseGrade([]), null);
  });

  test("peso zero não conta e não divide por zero", () => {
    // Atividade "não avaliativa" existe — e não pode zerar a média nem quebrar.
    const g = courseGrade([
      nota({ id: "g1", activityId: "p", pointsEarned: 8, pointsPossible: 10, weight: 1 }),
      nota({ id: "g2", activityId: "t", pointsEarned: 0, pointsPossible: 10, weight: 0 }),
    ]);

    assert.equal(g, 80);
  });

  test("tudo com peso zero devolve null em vez de NaN", () => {
    const g = courseGrade([nota({ weight: 0 })]);
    assert.equal(g, null);
  });

  test("usa só a nota vigente de cada atividade", () => {
    // Sem isso, uma reavaliação contaria duas vezes na média.
    const g = courseGrade([
      nota({ id: "g1", activityId: "p", pointsEarned: 0, pointsPossible: 10, createdAt: "2026-03-01T00:00:00Z" }),
      nota({ id: "g2", activityId: "p", pointsEarned: 10, pointsPossible: 10, createdAt: "2026-03-20T00:00:00Z" }),
    ]);

    assert.equal(g, 100);
  });
});

describe("Nota mínima para o certificado — F3-09", () => {
  test("sem exigência, concluir as aulas basta", () => {
    // É o comportamento de hoje, e cursos existentes não podem passar a exigir
    // prova que não têm.
    assert.equal(meetsCertificateGrade(undefined, null), true);
    assert.equal(meetsCertificateGrade(undefined, 40), true);
  });

  test("com exigência e nota suficiente, libera", () => {
    assert.equal(meetsCertificateGrade(70, 85), true);
  });

  test("com exigência e nota insuficiente, bloqueia", () => {
    assert.equal(meetsCertificateGrade(70, 65), false);
  });

  test("a nota exata libera", () => {
    assert.equal(meetsCertificateGrade(70, 70), true);
  });

  test("exigência sem nota nenhuma bloqueia", () => {
    // Quem não fez a prova não atingiu a nota — liberar seria dar certificado a
    // quem não foi avaliado, que é o oposto do ponto.
    assert.equal(meetsCertificateGrade(70, null), false);
  });
});

describe("Entrega de trabalho", () => {
  const regras = (over: Partial<SubmissionRules> = {}): SubmissionRules => ({
    latePolicy: "accept",
    latePenaltyPercent: 0,
    ...over,
  });

  const AGORA = new Date("2026-03-15T14:00:00Z");

  test("antes do prazo, aceita e não marca atraso", () => {
    const d = canSubmit(regras({ dueAt: "2026-03-20T23:59:00Z" }), 0, AGORA);
    assert.equal(d.allow, true);
    assert.equal(d.allow === true && d.late, false);
  });

  test("depois do prazo com `accept`, aceita e MARCA", () => {
    const d = canSubmit(regras({ dueAt: "2026-03-10T23:59:00Z" }), 0, AGORA);
    assert.equal(d.allow === true && d.late, true);
  });

  test("depois do prazo com `block`, recusa", () => {
    const d = canSubmit(regras({ dueAt: "2026-03-10T23:59:00Z", latePolicy: "block" }), 0, AGORA);
    assert.equal(d.allow === false && d.reason, "past_due");
  });

  test("sem prazo, nunca está atrasado", () => {
    assert.equal(canSubmit(regras(), 0, AGORA).allow, true);
  });

  test("tentativas esgotadas recusa", () => {
    const d = canSubmit(regras({ maxAttempts: 2 }), 2, AGORA);
    assert.equal(d.allow === false && d.reason, "no_attempts_left");
  });
});

describe("Desconto por atraso", () => {
  test("entrega no prazo não desconta", () => {
    assert.equal(applyLatePenalty(80, false, 20), 80);
  });

  test("entrega atrasada desconta o percentual", () => {
    // 20% de desconto sobre 80 pontos = 64.
    assert.equal(applyLatePenalty(80, true, 20), 64);
  });

  test("desconto de 100% zera, sem ficar negativo", () => {
    assert.equal(applyLatePenalty(80, true, 100), 0);
  });

  test("sem desconto configurado, atraso não custa nota", () => {
    // A política `accept` marca o atraso para o professor ver, sem punir
    // automaticamente — punir é decisão dele.
    assert.equal(applyLatePenalty(80, true, 0), 80);
  });
});
