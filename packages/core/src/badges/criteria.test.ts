import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  awardStatus,
  badgesToAward,
  expiringWithin,
  expiryOf,
  isValidBadgeCode,
  meetsCriterion,
  type BadgeDefinition,
  type LearnerRecord,
} from "./criteria.ts";

function badge(over: Partial<BadgeDefinition> = {}): BadgeDefinition {
  return {
    id: "b1",
    name: "Badge",
    description: "x",
    icon: "award",
    criterion: "manual",
    courseId: null,
    trackId: null,
    threshold: null,
    validityMonths: null,
    active: true,
    ...over,
  };
}

function record(over: Partial<LearnerRecord> = {}): LearnerRecord {
  return {
    completedCourses: new Set(),
    completedTracks: new Set(),
    lessonsCompleted: 0,
    gradesByCourse: new Map(),
    ...over,
  };
}

describe("Critérios de badge — F6-01", () => {
  test("manual NUNCA se cumpre sozinho", () => {
    /* Um critério manual que se cumpre sozinho daria o badge a todo mundo — o
       oposto do que a palavra diz. */
    assert.equal(
      meetsCriterion(badge({ criterion: "manual" }), record({ lessonsCompleted: 999 })),
      false,
    );
  });

  test("badge inativo não é concedido, cumprido ou não", () => {
    const inativo = badge({ criterion: "lessons_count", threshold: 1, active: false });
    assert.equal(meetsCriterion(inativo, record({ lessonsCompleted: 50 })), false);
  });

  test("curso concluído", () => {
    const b = badge({ criterion: "course_completed", courseId: "c1" });

    assert.equal(meetsCriterion(b, record({ completedCourses: new Set(["c1"]) })), true);
    assert.equal(meetsCriterion(b, record({ completedCourses: new Set(["c2"]) })), false);
    assert.equal(meetsCriterion(b, record()), false);
  });

  test("contagem de cursos e de aulas", () => {
    const cursos = badge({ criterion: "courses_count", threshold: 3 });
    const aulas = badge({ criterion: "lessons_count", threshold: 10 });

    assert.equal(meetsCriterion(cursos, record({ completedCourses: new Set(["a", "b"]) })), false);
    assert.equal(
      meetsCriterion(cursos, record({ completedCourses: new Set(["a", "b", "c"]) })),
      true,
    );
    assert.equal(meetsCriterion(aulas, record({ lessonsCompleted: 9 })), false);
    assert.equal(meetsCriterion(aulas, record({ lessonsCompleted: 10 })), true);
  });

  test("nota mínima: sem nota lançada NÃO cumpre", () => {
    /* Ausência de nota não é zero nem aprovação — quem não fez a prova não
       reprovou nem passou. */
    const b = badge({ criterion: "grade_above", courseId: "c1", threshold: 80 });

    assert.equal(meetsCriterion(b, record()), false);
    assert.equal(meetsCriterion(b, record({ gradesByCourse: new Map([["c1", 79.9]]) })), false);
    assert.equal(meetsCriterion(b, record({ gradesByCourse: new Map([["c1", 80]]) })), true);
    assert.equal(meetsCriterion(b, record({ gradesByCourse: new Map([["c1", 95]]) })), true);

    /* Nota de OUTRO curso não vale. */
    assert.equal(meetsCriterion(b, record({ gradesByCourse: new Map([["c2", 95]]) })), false);
  });

  test("critério sem alvo configurado não concede nada", () => {
    /* O CHECK do banco impede criar assim, mas a regra não pode depender disso:
       um badge mal formado precisa ser inerte, não conceder para todos. */
    assert.equal(meetsCriterion(badge({ criterion: "course_completed" }), record()), false);
    assert.equal(
      meetsCriterion(badge({ criterion: "courses_count" }), record({ completedCourses: new Set(["a"]) })),
      false,
    );
  });

  test("não concede de novo o que a pessoa já tem", () => {
    const badges = [
      badge({ id: "b1", criterion: "lessons_count", threshold: 5 }),
      badge({ id: "b2", criterion: "lessons_count", threshold: 10 }),
    ];

    const conceder = badgesToAward(badges, record({ lessonsCompleted: 12 }), new Set(["b1"]));

    assert.deepEqual(
      conceder.map((b) => b.id),
      ["b2"],
    );
  });

  test("validade: nulo é para sempre", () => {
    const emissao = new Date("2026-01-15T12:00:00Z");

    assert.equal(expiryOf(emissao, null), null);
    assert.equal(expiryOf(emissao, 12)!.toISOString().slice(0, 10), "2027-01-15");
    assert.equal(expiryOf(emissao, 24)!.toISOString().slice(0, 10), "2028-01-15");
  });

  test("validade que cai em mês mais curto não se perde", () => {
    /* 31 de janeiro + 1 mês não existe. O comportamento do JS empurra para
       março; o que não pode acontecer é virar data inválida. */
    const vencimento = expiryOf(new Date("2026-01-31T12:00:00Z"), 1)!;

    assert.ok(!Number.isNaN(vencimento.getTime()));
    assert.ok(vencimento > new Date("2026-01-31T12:00:00Z"));
  });

  test("situação: revogado vence expirado", () => {
    const agora = new Date("2026-06-01T00:00:00Z");

    assert.equal(
      awardStatus({ awardedAt: "2026-01-01", expiresAt: null, revokedAt: null }, agora),
      "valid",
    );
    assert.equal(
      awardStatus({ awardedAt: "2026-01-01", expiresAt: "2026-05-01", revokedAt: null }, agora),
      "expired",
    );
    /* Vencido E revogado é REVOGADO: a revogação é decisão de alguém, e a
       expiração é só o calendário. */
    assert.equal(
      awardStatus(
        { awardedAt: "2026-01-01", expiresAt: "2026-05-01", revokedAt: "2026-03-01" },
        agora,
      ),
      "revoked",
    );
  });

  test("expira exatamente agora já conta como vencido", () => {
    const agora = new Date("2026-06-01T00:00:00Z");

    assert.equal(
      awardStatus(
        { awardedAt: "2026-01-01", expiresAt: "2026-06-01T00:00:00Z", revokedAt: null },
        agora,
      ),
      "expired",
    );
  });

  test("aviso de vencimento próximo — a recertificação do §33", () => {
    const agora = new Date("2026-06-01T00:00:00Z");
    const em20dias = { awardedAt: "2025-06-01", expiresAt: "2026-06-21", revokedAt: null };
    const em90dias = { awardedAt: "2025-06-01", expiresAt: "2026-08-30", revokedAt: null };

    assert.equal(expiringWithin(em20dias, 30, agora), true);
    assert.equal(expiringWithin(em90dias, 30, agora), false);

    /* Já vencido não "vence em breve" — ele já venceu, e o aviso é outro. */
    const vencido = { awardedAt: "2025-01-01", expiresAt: "2026-01-01", revokedAt: null };
    assert.equal(expiringWithin(vencido, 30, agora), false);

    /* Sem validade nunca vence. */
    const eterno = { awardedAt: "2025-01-01", expiresAt: null, revokedAt: null };
    assert.equal(expiringWithin(eterno, 3650, agora), false);
  });

  test("o código de verificação tem formato fixo", () => {
    assert.equal(isValidBadgeCode("ABC123DEF456"), true);
    assert.equal(isValidBadgeCode("abc123def456"), false);
    assert.equal(isValidBadgeCode("ABC123"), false);
    assert.equal(isValidBadgeCode("ABC123DEF4567"), false);
    assert.equal(isValidBadgeCode(""), false);
  });
});
