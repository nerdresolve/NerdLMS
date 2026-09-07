import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { detectDelimiter, normalizeHeader, parseCsv, parseTable } from "./csv-parse.ts";
import { toCsv, UTF8_BOM } from "../reports/csv.ts";

describe("Leitura de CSV — F5-05", () => {
  test("lê a tabela simples", () => {
    const { headers, rows } = parseTable("Nome;Email\r\nMaria;maria@x.com\r\nJoão;joao@x.com");

    assert.deepEqual(headers, ["Nome", "Email"]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.nome, "Maria");
    assert.equal(rows[1]!.email, "joao@x.com");
  });

  test("respeita separador e quebra de linha DENTRO da célula", () => {
    /* O caso que um `split(",")` erraria: a célula tem separador e quebra
       dentro dela, e continua sendo uma célula só. */
    const linhas = parseCsv('Nome;Endereco\r\nMaria;"Rua A, 100\nSala 2"');

    assert.equal(linhas.length, 2);
    assert.deepEqual(linhas[1], ["Maria", "Rua A, 100\nSala 2"]);
  });

  test("aspa dupla dentro de aspas vira uma aspa", () => {
    const linhas = parseCsv('Curso\r\n"Curso ""Avançado"" 2026"');

    assert.deepEqual(linhas[1], ['Curso "Avançado" 2026']);
  });

  test("descobre o separador", () => {
    assert.equal(detectDelimiter("a;b;c"), ";");
    assert.equal(detectDelimiter("a,b,c"), ",");
    assert.equal(detectDelimiter("a\tb\tc"), "\t");

    /* A vírgula dentro de aspas não separa nada: contá-la escolheria o
       separador errado e partiria o arquivo inteiro na coluna errada. */
    assert.equal(detectDelimiter('"Nome, completo";Email;Papel'), ";");
  });

  test("linha em branco não vira registro", () => {
    /* Planilha quase sempre termina com uma; sem isto ela viraria um usuário
       sem nome nem e-mail. */
    const { rows } = parseTable("Nome;Email\r\nMaria;maria@x.com\r\n\r\n");

    assert.equal(rows.length, 1);
  });

  test("a última linha sem quebra no fim não se perde", () => {
    const { rows } = parseTable("Nome;Email\r\nMaria;maria@x.com");

    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.nome, "Maria");
  });

  test("colunas fora de ordem continuam sendo as mesmas colunas", () => {
    const a = parseTable("Nome;Email\r\nMaria;maria@x.com").rows[0]!;
    const b = parseTable("Email;Nome\r\nmaria@x.com;Maria").rows[0]!;

    assert.deepEqual(a, b);
  });

  test("o nome da coluna tolera acento, caixa e espaço", () => {
    assert.equal(normalizeHeader("E-mail"), "email");
    assert.equal(normalizeHeader(" E-Mail "), "email");
    assert.equal(normalizeHeader("E-MAIL"), "email");
    assert.equal(normalizeHeader("Situação"), "situacao");
    assert.equal(normalizeHeader("Nome completo"), "nomecompleto");
  });

  test("o que este produto exporta, este produto reimporta", () => {
    /* A garantia que fecha o ciclo do §24: exportar e reimportar tem de
       devolver o mesmo dado. Inclui o BOM — que nós mesmos escrevemos — e uma
       célula com aspas, separador e quebra de linha ao mesmo tempo. */
    const headers = ["Nome", "Email", "Observação"];
    const linhas = [
      ["Maria Souza", "maria@x.com", 'Disse "ok"; virá dia 3\nconfirmar'],
      ["João Lima", "joao@x.com", "Rua A, 100"],
    ];

    const arquivo = UTF8_BOM + toCsv(headers, linhas);
    const { rows } = parseTable(arquivo);

    assert.equal(rows.length, 2);
    /* O BOM não pode grudar na primeira coluna: `﻿Nome` nunca casaria. */
    assert.equal(rows[0]!.nome, "Maria Souza");
    assert.equal(rows[0]!.observacao, 'Disse "ok"; virá dia 3\nconfirmar');
    assert.equal(rows[1]!.observacao, "Rua A, 100");
  });

  test("a defesa contra fórmula sobrevive à ida e volta", () => {
    /* `csvCell` prefixa com aspa simples para o Excel não executar a célula.
       Na volta o valor vem com a aspa — é o comportamento correto: o dado
       original era perigoso, e o que se lê é o que está no arquivo. */
    const arquivo = toCsv(["Curso"], [["=HYPERLINK(\"http://mau\")"]]);
    const { rows } = parseTable(arquivo);

    assert.equal(rows[0]!.curso, "'=HYPERLINK(\"http://mau\")");
  });

  test("arquivo vazio não quebra", () => {
    assert.deepEqual(parseTable(""), { headers: [], rows: [] });
    assert.deepEqual(parseTable("\r\n"), { headers: [], rows: [] });
  });
});
