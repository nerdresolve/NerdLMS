import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { activeByProject, activeUsers, lastDays } from "./active-users.ts";
import type { User } from "./types.ts";

const HOJE = new Date("2026-08-12T12:00:00-03:00");

function pessoa(id: string, project: string, lastAccessAt?: string): User {
  return { id, role: "learner", firstName: id, fullName: id, project, ...(lastAccessAt ? { lastAccessAt } : {}) };
}

describe("lastDays", () => {
  test("30 dias incluem hoje e o trigésimo dia atrás", () => {
    const periodo = lastDays(30, HOJE);
    assert.equal(periodo.to.toISOString(), HOJE.toISOString());
    const dias = Math.round((periodo.to.getTime() - periodo.from.getTime()) / 86400000);
    assert.equal(dias, 29, "30 dias corridos contando hoje");
  });
});

describe("activeUsers", () => {
  const periodo = lastDays(30, HOJE);

  test("conta quem acessou dentro do período", () => {
    const dados = activeUsers(
      [
        pessoa("a", "P", "2026-08-10T09:00:00-03:00"),
        pessoa("b", "P", "2026-06-01T09:00:00-03:00"),
        pessoa("c", "P"),
      ],
      periodo,
    );
    assert.equal(dados.active, 1);
    assert.equal(dados.total, 3);
    assert.equal(dados.percent, 33);
  });

  test("quem nunca acessou é contado à parte: convite que não virou uso", () => {
    const dados = activeUsers([pessoa("a", "P"), pessoa("b", "P", "2026-08-11T09:00:00-03:00")], periodo);
    assert.equal(dados.neverAccessed, 1);
  });

  test("data inválida não conta como ativo nem quebra o cálculo", () => {
    const dados = activeUsers([pessoa("a", "P", "não é data")], periodo);
    assert.equal(dados.active, 0);
  });

  test("acesso no futuro não conta: fora do período é fora do período", () => {
    const dados = activeUsers([pessoa("a", "P", "2027-01-01T09:00:00-03:00")], periodo);
    assert.equal(dados.active, 0);
  });

  test("base vazia é 0%, não divide por zero", () => {
    assert.deepEqual(activeUsers([], periodo), { active: 0, total: 0, percent: 0, neverAccessed: 0 });
  });
});

describe("activeByProject", () => {
  test("separa por projeto e ordena pelos mais ativos", () => {
    const periodo = lastDays(30, HOJE);
    const linhas = activeByProject(
      [
        pessoa("a", "Siririzinho", "2026-08-10T09:00:00-03:00"),
        pessoa("b", "Siririzinho", "2026-08-11T09:00:00-03:00"),
        pessoa("c", "Aguilhada", "2026-08-09T09:00:00-03:00"),
        pessoa("d", "Aguilhada"),
      ],
      periodo,
    );
    assert.deepEqual(linhas, [
      { project: "Siririzinho", active: 2, total: 2 },
      { project: "Aguilhada", active: 1, total: 2 },
    ]);
  });

  test("ignora usuário sem projeto em vez de criar um grupo vazio", () => {
    const semProjeto = { id: "x", role: "admin", firstName: "X", fullName: "X" } as User;
    assert.deepEqual(activeByProject([semProjeto], lastDays(30, HOJE)), []);
  });
});
