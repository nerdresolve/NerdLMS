import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseTable } from "./csv-parse.ts";
import { MODELO_USUARIOS, planImport } from "./users-import.ts";
import { toCsv } from "../reports/csv.ts";

/** Atalho: monta as linhas a partir de um CSV, como a rota faz. */
function doCsv(texto: string) {
  return parseTable(texto).rows;
}

describe("Importação de usuários — F5-05", () => {
  test("planeja a criação das linhas boas", () => {
    const plano = planImport(
      doCsv("Nome;Email;Papel\r\nMaria;maria@x.com;aluno\r\nJoão;joao@x.com;instrutor"),
      new Set(),
    );

    assert.equal(plano.criar, 2);
    assert.equal(plano.erros, 0);
    assert.equal(plano.linhas[0]!.papel, "learner");
    assert.equal(plano.linhas[1]!.papel, "instructor");
  });

  test("aceita o papel como o RH escreve", () => {
    const plano = planImport(
      doCsv("Nome;Email;Papel\r\nA;a@x.com;Instrutor\r\nB;b@x.com;GESTOR\r\nC;c@x.com;professor"),
      new Set(),
    );

    assert.deepEqual(
      plano.linhas.map((l) => l.papel),
      ["instructor", "manager", "instructor"],
    );
  });

  test("papel desconhecido é erro, não vira aluno em silêncio", () => {
    /* Adivinhar daria a alguém um acesso que ninguém pediu. */
    const plano = planImport(doCsv("Nome;Email;Papel\r\nA;a@x.com;Coordenador"), new Set());

    assert.equal(plano.erros, 1);
    assert.match(plano.linhas[0]!.erro!, /Coordenador/);
  });

  test("papel em branco vira o padrão", () => {
    const plano = planImport(doCsv("Nome;Email;Papel\r\nA;a@x.com;"), new Set());

    assert.equal(plano.criar, 1);
    assert.equal(plano.linhas[0]!.papel, "learner");
  });

  test("sem nome, sem e-mail e e-mail torto são erros com o motivo", () => {
    const plano = planImport(
      doCsv("Nome;Email\r\n;a@x.com\r\nB;\r\nC;nao-e-email\r\nD;com espaco@x.com"),
      new Set(),
    );

    assert.equal(plano.erros, 4);
    assert.match(plano.linhas[0]!.erro!, /nome/i);
    assert.match(plano.linhas[1]!.erro!, /mail/i);
    assert.match(plano.linhas[2]!.erro!, /não parece/i);
  });

  test("a linha citada é a que a pessoa vê no Excel", () => {
    /* Cabeçalho é a linha 1, então o primeiro registro é a 2. Errar isso manda
       a pessoa corrigir a linha errada. */
    const plano = planImport(doCsv("Nome;Email\r\nA;a@x.com\r\n;ruim@x.com"), new Set());

    assert.equal(plano.linhas[0]!.linha, 2);
    assert.equal(plano.linhas[1]!.linha, 3);
  });

  test("a mesma pessoa duas vezes na planilha é duplicata, não erro de banco", () => {
    const plano = planImport(
      doCsv("Nome;Email\r\nMaria;maria@x.com\r\nMaria Souza;MARIA@x.com"),
      new Set(),
    );

    assert.equal(plano.criar, 1);
    assert.equal(plano.duplicadas, 1);
    assert.equal(plano.linhas[1]!.situacao, "duplicada");
  });

  test("quem já existe aparece como existente, e não como falha", () => {
    const plano = planImport(
      doCsv("Nome;Email\r\nMaria;maria@x.com\r\nNovo;novo@x.com"),
      new Set(["Maria@X.com"]),
    );

    assert.equal(plano.existentes, 1);
    assert.equal(plano.criar, 1);
    assert.equal(plano.linhas[0]!.situacao, "existente");
  });

  test("aceita os nomes de coluna que aparecem na vida real", () => {
    const a = planImport(doCsv("Nome completo;E-mail;Perfil;Setor\r\nA;a@x.com;aluno;Obras"), new Set());
    const b = planImport(doCsv("name;email;role;project\r\nA;a@x.com;aluno;Obras"), new Set());

    assert.equal(a.criar, 1);
    assert.equal(b.criar, 1);
    assert.equal(a.linhas[0]!.unidade, "Obras");
    assert.deepEqual(a.linhas[0]!.unidade, b.linhas[0]!.unidade);
  });

  test("linha totalmente vazia é ignorada, não vira erro", () => {
    const plano = planImport(doCsv("Nome;Email\r\nA;a@x.com\r\n;\r\n"), new Set());

    assert.equal(plano.linhas.length, 1);
    assert.equal(plano.erros, 0);
  });

  test("o modelo oferecido importa sem erro", () => {
    /* Um modelo que não passa na própria validação é uma armadilha: a pessoa
       baixa, preenche igual e a importação recusa. */
    const arquivo = toCsv(MODELO_USUARIOS.headers, MODELO_USUARIOS.exemplo);
    const plano = planImport(doCsv(arquivo), new Set());

    assert.equal(plano.erros, 0);
    assert.equal(plano.criar, 2);
  });
});
