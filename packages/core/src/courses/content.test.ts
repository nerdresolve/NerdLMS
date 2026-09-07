import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  canCompleteContent,
  contentKindOf,
  KIND_LABEL,
  mergePagesSeen,
  readingProgress,
  type ContentLesson,
} from "./content.ts";

const aula = (over: Partial<ContentLesson> = {}): ContentLesson => ({
  kind: "pdf",
  ...over,
});

describe("Chegar ao fim do documento", () => {
  test("com todas as páginas vistas, libera", () => {
    // É o critério que o cliente pediu: passar pelo documento INTEIRO.
    const d = canCompleteContent(aula({ pageCount: 5 }), { pagesSeen: [1, 2, 3, 4, 5], seconds: 0 });
    assert.equal(d.allow, true);
  });

  test("faltando uma página, bloqueia", () => {
    const d = canCompleteContent(aula({ pageCount: 5 }), { pagesSeen: [1, 2, 3, 4], seconds: 0 });
    assert.equal(d.allow === false && d.reason, "pages_pending");
  });

  test("a mensagem diz QUANTAS faltam", () => {
    // "Você ainda não terminou" não diz o que fazer; "faltam 2 páginas" diz.
    const d = canCompleteContent(aula({ pageCount: 10 }), { pagesSeen: [1, 2, 3, 4, 5, 6, 7, 8], seconds: 0 });
    assert.equal(d.allow === false && d.remaining, 2);
  });

  test("pular para a última não conta como ler tudo", () => {
    // Sem isto, bastaria arrastar a barra até o fim.
    const d = canCompleteContent(aula({ pageCount: 20 }), { pagesSeen: [1, 20], seconds: 0 });
    assert.equal(d.allow, false);
  });

  test("página fora do intervalo não infla a contagem", () => {
    // O cliente pode mandar qualquer número; 99 numa aula de 5 páginas não pode
    // fazer a conta fechar.
    const d = canCompleteContent(aula({ pageCount: 5 }), { pagesSeen: [1, 2, 3, 99, 100], seconds: 0 });
    assert.equal(d.allow, false);
  });

  test("documento sem contagem de páginas não trava a pessoa", () => {
    // PDF cuja contagem falhou no envio. Bloquear para sempre seria pior que
    // confiar — a aula ficaria impossível de concluir.
    assert.equal(canCompleteContent(aula({}), { pagesSeen: [], seconds: 0 }).allow, true);
  });
});

describe("Tempo mínimo", () => {
  test("antes do tempo, bloqueia", () => {
    const d = canCompleteContent(aula({ kind: "image", minSeconds: 60 }), {
      pagesSeen: [],
      seconds: 30,
    });

    assert.equal(d.allow === false && d.reason, "time_pending");
  });

  test("cumprido o tempo, libera", () => {
    const d = canCompleteContent(aula({ kind: "image", minSeconds: 60 }), {
      pagesSeen: [],
      seconds: 60,
    });

    assert.equal(d.allow, true);
  });

  test("sem tempo exigido, libera de imediato", () => {
    assert.equal(canCompleteContent(aula({ kind: "link" }), { pagesSeen: [], seconds: 0 }).allow, true);
  });

  test("páginas E tempo: os dois precisam ser cumpridos", () => {
    const parcial = canCompleteContent(aula({ pageCount: 3, minSeconds: 120 }), {
      pagesSeen: [1, 2, 3],
      seconds: 30,
    });

    assert.equal(parcial.allow === false && parcial.reason, "time_pending");

    const completo = canCompleteContent(aula({ pageCount: 3, minSeconds: 120 }), {
      pagesSeen: [1, 2, 3],
      seconds: 120,
    });

    assert.equal(completo.allow, true);
  });

  test("as páginas são cobradas ANTES do tempo", () => {
    // Quem não leu precisa saber que falta ler, não que falta esperar.
    const d = canCompleteContent(aula({ pageCount: 3, minSeconds: 120 }), {
      pagesSeen: [1],
      seconds: 0,
    });

    assert.equal(d.allow === false && d.reason, "pages_pending");
  });
});

describe("Páginas acumuladas", () => {
  test("junta sem duplicar", () => {
    assert.deepEqual(mergePagesSeen([1, 2, 3], [3, 4]), [1, 2, 3, 4]);
  });

  test("mantém ordenado", () => {
    // A lista vai para a tela ("você viu 1, 2, 5"), e desordenada confundiria.
    assert.deepEqual(mergePagesSeen([5, 1], [3]), [1, 3, 5]);
  });

  test("ignora o que não é página válida", () => {
    assert.deepEqual(mergePagesSeen([1], [0, -3, 2.5, Number.NaN, 2]), [1, 2]);
  });

  test("vazio com vazio é vazio", () => {
    assert.deepEqual(mergePagesSeen([], []), []);
  });
});

describe("Progresso de leitura", () => {
  test("percentual de páginas vistas", () => {
    assert.equal(readingProgress([1, 2, 3], 10), 30);
  });

  test("tudo visto é 100", () => {
    assert.equal(readingProgress([1, 2], 2), 100);
  });

  test("sem contagem de páginas, não há percentual", () => {
    // `null` e não zero: a barra some em vez de mostrar 0% para sempre.
    assert.equal(readingProgress([1, 2], undefined), null);
  });

  test("nunca passa de 100", () => {
    assert.equal(readingProgress([1, 2, 3, 4], 2), 100);
  });
});

describe("Tipo de conteúdo a partir do arquivo", () => {
  test("reconhece os formatos de escritório", () => {
    assert.equal(contentKindOf("aula.pptx"), "slides");
    assert.equal(contentKindOf("norma.docx"), "document");
    assert.equal(contentKindOf("planilha.xlsx"), "spreadsheet");
    assert.equal(contentKindOf("manual.pdf"), "pdf");
  });

  test("reconhece mídia", () => {
    assert.equal(contentKindOf("aula.mp4"), "video");
    assert.equal(contentKindOf("podcast.mp3"), "audio");
    assert.equal(contentKindOf("diagrama.png"), "image");
  });

  test("ignora a caixa da extensão", () => {
    assert.equal(contentKindOf("AULA.PPTX"), "slides");
  });

  test("extensão desconhecida vira documento", () => {
    // Melhor oferecer download que recusar o arquivo do instrutor.
    assert.equal(contentKindOf("arquivo.xyz"), "document");
    assert.equal(contentKindOf("sem-extensao"), "document");
  });

  test("todo tipo tem rótulo em português", () => {
    for (const kind of Object.keys(KIND_LABEL)) {
      assert.ok(KIND_LABEL[kind as keyof typeof KIND_LABEL].length > 0);
    }
  });
});
