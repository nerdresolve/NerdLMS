import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  auditSummary,
  isSensitive,
  queryAudit,
  repeatedDenials,
  type AuditEvent,
} from "./audit.ts";

function evento(over: Partial<AuditEvent> & { id: string }): AuditEvent {
  return {
    at: "2026-08-12T10:00:00-03:00",
    actorId: "u1",
    actorName: "Maria Souza",
    action: "login",
    target: "sessão",
    outcome: "allowed",
    ...over,
  };
}

describe("Ações sensíveis", () => {
  test("mexer em acesso ou exportar dado é sensível", () => {
    for (const action of ["role_changed", "user_deactivated", "course_deleted", "report_exported"] as const) {
      assert.equal(isSensitive(evento({ id: "x", action })), true, action);
    }
  });

  test("login e matrícula não são sensíveis", () => {
    assert.equal(isSensitive(evento({ id: "x", action: "login" })), false);
    assert.equal(isSensitive(evento({ id: "y", action: "enrollment_created" })), false);
  });
});

describe("queryAudit", () => {
  const eventos = [
    evento({ id: "1", at: "2026-08-10T09:00:00-03:00", actorName: "Ana Ribeiro", action: "report_exported", target: "relatório de conclusão" }),
    evento({ id: "2", at: "2026-08-12T11:00:00-03:00", actorName: "João Peixoto", action: "access_denied", target: "curso c9", outcome: "denied" }),
    evento({ id: "3", at: "2026-08-11T08:00:00-03:00", actorName: "Maria Souza", action: "login" }),
  ];

  test("ordena do mais recente para o mais antigo", () => {
    assert.deepEqual(queryAudit(eventos).map((e) => e.id), ["2", "3", "1"]);
  });

  test("filtra por resultado", () => {
    assert.deepEqual(queryAudit(eventos, { outcome: "denied" }).map((e) => e.id), ["2"]);
    assert.equal(queryAudit(eventos, { outcome: "allowed" }).length, 2);
  });

  test("filtra só as sensíveis", () => {
    assert.deepEqual(queryAudit(eventos, { sensitiveOnly: true }).map((e) => e.id), ["1"]);
  });

  test("busca por autor e por alvo, sem acento", () => {
    assert.deepEqual(queryAudit(eventos, { search: "joao" }).map((e) => e.id), ["2"]);
    assert.deepEqual(queryAudit(eventos, { search: "relatorio" }).map((e) => e.id), ["1"]);
  });

  test("combina filtros", () => {
    assert.equal(queryAudit(eventos, { outcome: "denied", search: "ana" }).length, 0);
  });

  test("não altera o array original", () => {
    const antes = eventos.map((e) => e.id);
    queryAudit(eventos);
    assert.deepEqual(eventos.map((e) => e.id), antes);
  });
});

describe("auditSummary", () => {
  test("conta total, negadas, sensíveis e autores distintos", () => {
    const resumo = auditSummary([
      evento({ id: "1", actorId: "a" }),
      evento({ id: "2", actorId: "a", outcome: "denied", action: "access_denied" }),
      evento({ id: "3", actorId: "b", action: "role_changed" }),
    ]);
    assert.deepEqual(resumo, { total: 3, denied: 1, sensitive: 1, actors: 2 });
  });

  test("lista vazia não quebra", () => {
    assert.deepEqual(auditSummary([]), { total: 0, denied: 0, sensitive: 0, actors: 0 });
  });
});

describe("repeatedDenials", () => {
  test("aponta quem acumula negações acima do limiar", () => {
    const eventos = [
      ...Array.from({ length: 4 }, (_, i) =>
        evento({ id: `d${i}`, actorId: "x", actorName: "Suspeito", outcome: "denied", action: "access_denied" }),
      ),
      evento({ id: "ok", actorId: "y", actorName: "Normal" }),
      evento({ id: "d-y", actorId: "y", actorName: "Normal", outcome: "denied", action: "access_denied" }),
    ];
    assert.deepEqual(repeatedDenials(eventos), [{ actorId: "x", actorName: "Suspeito", denials: 4 }]);
  });

  test("uma negação isolada não vira alerta", () => {
    assert.deepEqual(repeatedDenials([evento({ id: "1", outcome: "denied" })]), []);
  });

  test("ação permitida nunca conta como negação", () => {
    const eventos = Array.from({ length: 5 }, (_, i) => evento({ id: `a${i}` }));
    assert.deepEqual(repeatedDenials(eventos), []);
  });
});
