import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildPdf, buildPdfPages, rgb, A4_LANDSCAPE } from "./pdf.ts";
import { countPdfPages } from "./pdf-pages.ts";

const texto = (t: string) => [{ text: t, x: 50, y: 500, size: 12 }];

/** O arquivo é gravado em latin1; ler assim devolve os bytes como estão. */
const comoTexto = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("PDF de várias páginas", () => {
  test("uma página continua sendo uma página", () => {
    /* `buildPdf` passou a delegar para `buildPdfPages`. O certificado é o
       documento que a plataforma emite em produção e usa esta assinatura: se
       a delegação mudasse a contagem, o arquivo emitido mudaria sem ninguém
       pedir. */
    const pdf = buildPdf(texto("Sozinha"));
    assert.equal(countPdfPages(pdf), 1);
  });

  test("três páginas declaram três, e o leitor acha as três", () => {
    const pdf = buildPdfPages([
      { texts: texto("Primeira") },
      { texts: texto("Segunda") },
      { texts: texto("Terceira") },
    ]);

    assert.equal(countPdfPages(pdf), 3);

    const cru = comoTexto(pdf);
    assert.match(cru, /\/Count 3/);
    /* Cada página precisa do PRÓPRIO objeto de conteúdo. Um `/Contents`
       repetido faria as três desenharem a mesma coisa. */
    assert.equal((cru.match(/\/Type \/Page[^s]/g) ?? []).length, 3);
  });

  test("cada página desenha só o seu texto", () => {
    const pdf = comoTexto(
      buildPdfPages([{ texts: texto("Alfa") }, { texts: texto("Beta") }]),
    );

    assert.ok(pdf.includes("(Alfa)"));
    assert.ok(pdf.includes("(Beta)"));
    /* Se os conteúdos fossem concatenados numa página só, "Alfa" apareceria
       duas vezes: uma no stream dela e outra no da seguinte. */
    assert.equal((pdf.match(/\(Alfa\)/g) ?? []).length, 1);
  });

  test("páginas podem ter tamanhos diferentes", () => {
    const pdf = comoTexto(
      buildPdfPages([
        { size: { width: 595, height: 842 }, texts: texto("Retrato") },
        { size: A4_LANDSCAPE, texts: texto("Paisagem") },
      ]),
    );

    assert.ok(pdf.includes("/MediaBox [0 0 595 842]"));
    assert.ok(pdf.includes("/MediaBox [0 0 842 595]"));
  });

  test("o recurso de uma página não vira o de outra", () => {
    /* Imagem, degradê e opacidade viram objetos com nome (`/Sh0`, `/GS0`), e o
       nome é global. Numerar por página faria o `/Sh0` da segunda apontar para
       o degradê da primeira — o leitor aceita em silêncio e desenha errado. */
    const comDegrade = (cor: string) => ({
      kind: "path" as const,
      start: [0, 0] as [number, number],
      curves: [],
      close: [[100, 0], [100, 100]] as Array<[number, number]>,
      color: rgb(cor),
      gradient: { from: rgb(cor), to: rgb("#FFFFFF"), axis: [0, 0, 100, 0] as [number, number, number, number] },
    });

    const pdf = comoTexto(
      buildPdfPages([
        { texts: texto("A"), shapes: [comDegrade("#FF0000")] },
        { texts: texto("B"), shapes: [comDegrade("#00FF00")] },
      ]),
    );

    /* Dois shadings distintos, e cada página invoca o seu. */
    assert.ok(pdf.includes("/Sh0"));
    assert.ok(pdf.includes("/Sh1"));
    assert.equal((pdf.match(/\/ShadingType 2/g) ?? []).length, 2);
  });

  test("sem página nenhuma, falha alto", () => {
    /* Um PDF de zero páginas é aceito por alguns leitores e recusado por
       outros. Falhar aqui é melhor que gerar um arquivo que abre na máquina de
       quem escreveu e não na de quem recebe. */
    assert.throws(() => buildPdfPages([]), /ao menos uma página/);
  });

  test("a tabela xref aponta para todos os objetos", () => {
    /* É por ela que o leitor encontra cada objeto. Uma entrada a menos e o
       arquivo abre em branco. */
    const cru = comoTexto(buildPdfPages([{ texts: texto("X") }, { texts: texto("Y") }]));

    const declarado = Number(/\/Size (\d+)/.exec(cru)![1]);
    const entradas = (cru.match(/^\d{10} \d{5} [nf] $/gm) ?? []).length;

    assert.equal(entradas, declarado, "xref precisa ter uma linha por objeto, mais a livre");
  });
});
