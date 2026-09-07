import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { countPdfPages } from "./pdf-pages.ts";

/**
 * Contagem de páginas de PDF — sem biblioteca.
 *
 * O projeto já escreve PDF do zero (`pdf.ts`); contar é bem mais simples que
 * gerar. Estes testes montam PDFs mínimos, como os arquivos reais que a
 * contagem vai encontrar.
 */

const bytes = (texto: string) => new TextEncoder().encode(texto);

describe("Contagem pelo /Count do catálogo", () => {
  test("lê o número declarado", () => {
    const pdf = bytes(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>
endobj
%%EOF`);

    assert.equal(countPdfPages(pdf), 3);
  });

  test("aceita espaço irregular", () => {
    // Geradores diferentes formatam diferente; casar só com um formato
    // devolveria null para metade dos arquivos reais.
    const pdf = bytes(`<< /Type/Pages/Count 12/Kids[...] >>`);
    assert.equal(countPdfPages(pdf), 12);
  });

  test("com vários /Count, vale o MAIOR", () => {
    // Um PDF com páginas em árvore tem `/Count` em cada nó; o da raiz é o
    // total, e é sempre o maior.
    const pdf = bytes(`
      << /Type /Pages /Count 20 /Kids [...] >>
      << /Type /Pages /Count 8 /Kids [...] >>
      << /Type /Pages /Count 12 /Kids [...] >>`);

    assert.equal(countPdfPages(pdf), 20);
  });
});

describe("Contagem pelos objetos de página", () => {
  test("cai para contar /Type /Page quando não há /Count", () => {
    // PDF gerado por ferramenta que não declara o total.
    const pdf = bytes(`%PDF-1.4
3 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
%%EOF`);

    assert.equal(countPdfPages(pdf), 2);
  });

  test("não confunde /Pages com /Page", () => {
    // `/Pages` é o nó da árvore, não uma página. Uma regex ingênua contaria os
    // dois e o documento teria uma página a mais que a real.
    const pdf = bytes(`
      << /Type /Pages /Kids [3 0 R] >>
      << /Type /Page /Parent 2 0 R >>`);

    assert.equal(countPdfPages(pdf), 1);
  });
});

describe("O que a contagem não faz", () => {
  test("arquivo que não é PDF devolve null", () => {
    // Um .pptx chega aqui: não é erro, só não dá para contar.
    assert.equal(countPdfPages(bytes("PK isto é um zip")), null);
  });

  test("PDF sem informação de página devolve null", () => {
    // `null` e não zero: zero seria lido como "documento vazio" e bloquearia a
    // conclusão para sempre. Null significa "não sei", e a regra libera.
    assert.equal(countPdfPages(bytes("%PDF-1.4\n%%EOF")), null);
  });

  test("arquivo vazio não quebra", () => {
    assert.equal(countPdfPages(new Uint8Array()), null);
  });

  test("contagem absurda é recusada", () => {
    // Proteção contra arquivo malformado ou malicioso: um `/Count 999999999`
    // faria a tela tentar desenhar um bilhão de indicadores de página.
    const pdf = bytes(`<< /Type /Pages /Count 999999999 >>`);
    assert.equal(countPdfPages(pdf), null);
  });
});
