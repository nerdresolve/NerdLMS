import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { csvCell, reportFilename, toCsv, UTF8_BOM } from "./csv.ts";

describe("CSV", () => {
  test("texto simples sai sem aspas", () => {
    assert.equal(csvCell("Maria Souza"), "Maria Souza");
    assert.equal(csvCell(72), "72");
  });

  test("vazio e nulo viram célula vazia", () => {
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
    assert.equal(csvCell(""), "");
  });

  test("separador e aspas obrigam a envolver", () => {
    assert.equal(csvCell("Água; potável"), '"Água; potável"');
    assert.equal(csvCell('Ele disse "oi"'), '"Ele disse ""oi"""');
  });

  test("quebra de linha é preservada dentro da célula", () => {
    assert.equal(csvCell("linha 1\nlinha 2"), '"linha 1\nlinha 2"');
  });

  test("injeção de fórmula é neutralizada", () => {
    // Uma célula começando com = é EXECUTADA pelo Excel ao abrir. Um título de
    // curso vindo do banco não pode virar código na máquina de quem exporta.
    for (const perigoso of ["=1+1", "+SOMA(A1)", "-2", "@import", "=HYPERLINK(\"http://x\")"]) {
      const cell = csvCell(perigoso);
      assert.ok(cell.startsWith("'") || cell.startsWith('"\''), `${perigoso} → ${cell}`);
    }
  });

  test("o texto original é preservado depois da aspa de defesa", () => {
    assert.equal(csvCell("=1+1"), "'=1+1");
  });

  test("monta o arquivo com CRLF", () => {
    const csv = toCsv(["Nome", "Progresso"], [["Maria", 72], ["João", 0]]);
    assert.equal(csv, "Nome;Progresso\r\nMaria;72\r\nJoão;0");
  });

  test("cabeçalho também é escapado", () => {
    const csv = toCsv(["Curso; turma"], [["x"]]);
    assert.ok(csv.startsWith('"Curso; turma"'));
  });

  test("o BOM tem três bytes", () => {
    // Sem ele o Excel abre em codificação local e acento vira lixo.
    assert.equal(Buffer.from(UTF8_BOM, "utf8").length, 3);
  });

  test("o nome do arquivo é seguro e datado", () => {
    assert.equal(reportFilename("Progresso da equipe", "2026-08-14T10:00:00Z"), "progresso-da-equipe-2026-08-14.csv");
    assert.equal(reportFilename("Relatório", "2026-01-02"), "relatorio-2026-01-02.csv");
  });
});
