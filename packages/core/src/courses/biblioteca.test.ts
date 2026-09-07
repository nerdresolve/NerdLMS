import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  chaveDeBusca,
  filtrarBiblioteca,
  semTema,
  temasDaBiblioteca,
  type ItemDaBiblioteca,
} from "./biblioteca.ts";

const doc = (over: Partial<ItemDaBiblioteca> = {}): ItemDaBiblioteca => ({
  id: "1",
  name: "PO-034.pdf",
  description: null,
  kind: "pdf",
  sizeLabel: "1,2 MB",
  tema: "Segurança",
  ...over,
});

const acervo: ItemDaBiblioteca[] = [
  doc({ id: "1", name: "PO-034.pdf", description: "Trabalho em altura", tema: "Segurança" }),
  doc({ id: "2", name: "Ficha FISPQ.pdf", description: "Produto químico", tema: "Segurança" }),
  doc({ id: "3", name: "Planilha de rondas.xlsx", kind: "spreadsheet", tema: "Operação" }),
  doc({ id: "4", name: "Apresentação anual.pptx", kind: "slides", tema: null }),
];

describe("Biblioteca: a chave de busca", () => {
  test("ignora acento, caixa e espaço", () => {
    /* Quem digita "seguranca" precisa achar "Segurança": exigir o acento faria
       a busca falhar justamente para quem tem pressa. */
    assert.equal(chaveDeBusca("  Segurança "), "seguranca");
    assert.equal(chaveDeBusca("OPERAÇÃO"), "operacao");
    assert.equal(chaveDeBusca(null), "");
    assert.equal(chaveDeBusca(undefined), "");
  });
});

describe("Biblioteca: filtros", () => {
  test("sem filtro, devolve tudo", () => {
    assert.equal(filtrarBiblioteca(acervo).length, 4);
    assert.equal(filtrarBiblioteca(acervo, {}).length, 4);
    assert.equal(filtrarBiblioteca(acervo, { tema: null, tipo: null, busca: "" }).length, 4);
  });

  test("por tema", () => {
    const seguranca = filtrarBiblioteca(acervo, { tema: "Segurança" });
    assert.deepEqual(seguranca.map((d) => d.id), ["1", "2"]);
  });

  test("por tipo", () => {
    assert.deepEqual(filtrarBiblioteca(acervo, { tipo: "spreadsheet" }).map((d) => d.id), ["3"]);
  });

  test("por texto, no nome e na descrição", () => {
    /* "PO-034.pdf" não diz nada a ninguém: é na descrição que está a palavra
       que a pessoa lembra. */
    assert.deepEqual(filtrarBiblioteca(acervo, { busca: "altura" }).map((d) => d.id), ["1"]);
    assert.deepEqual(filtrarBiblioteca(acervo, { busca: "fispq" }).map((d) => d.id), ["2"]);
  });

  test("a busca acha sem acento o que foi escrito com acento", () => {
    assert.deepEqual(filtrarBiblioteca(acervo, { busca: "apresentacao" }).map((d) => d.id), ["4"]);
    assert.deepEqual(filtrarBiblioteca(acervo, { busca: "quimico" }).map((d) => d.id), ["2"]);
  });

  test("os filtros são cumulativos, não alternativos", () => {
    /* Escolher "Segurança" e digitar "altura" procura altura DENTRO de
       segurança. O contrário — cada filtro ampliando — não teria uso. */
    const juntos = filtrarBiblioteca(acervo, { tema: "Segurança", busca: "altura" });
    assert.deepEqual(juntos.map((d) => d.id), ["1"]);

    const semResultado = filtrarBiblioteca(acervo, { tema: "Operação", busca: "altura" });
    assert.equal(semResultado.length, 0);
  });

  test("tema nulo é 'todos', não 'os sem tema'", () => {
    /* O campo vazio da barra precisa continuar significando "não estou
       filtrando". Os sem tema têm opção própria na tela. */
    assert.equal(filtrarBiblioteca(acervo, { tema: null }).length, 4);
  });
});

describe("Biblioteca: temas", () => {
  test("conta quantos documentos cada tema tem", () => {
    assert.deepEqual(temasDaBiblioteca(acervo), [
      { nome: "Operação", documentos: 1 },
      { nome: "Segurança", documentos: 2 },
    ]);
  });

  test("tema sem documento não aparece na barra", () => {
    /* Oferecer "Meio ambiente (0)" convida ao clique que não devolve nada. */
    const temas = temasDaBiblioteca([doc({ tema: "Segurança" })]);
    assert.deepEqual(temas.map((t) => t.nome), ["Segurança"]);
  });

  test("ordem alfabética respeitando acento", () => {
    const temas = temasDaBiblioteca([
      doc({ id: "a", tema: "Base" }),
      doc({ id: "b", tema: "Água" }),
    ]);

    assert.deepEqual(temas.map((t) => t.nome), ["Água", "Base"]);
  });

  test("conta os sem tema à parte", () => {
    assert.equal(semTema(acervo), 1);
    assert.equal(semTema([]), 0);
  });
});
