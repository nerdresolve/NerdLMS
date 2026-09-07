import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  cargaDoCertificado,
  cargaPorExtenso,
  programaDoCurso,
  LINHAS_POR_PAGINA,
} from "./certificate-verso.ts";
import type { CursoDoPrograma } from "./certificate-verso.ts";

function outline(modulos: Array<{ titulo: string; aulas: string[] }>): CursoDoPrograma {
  return {
    modules: modulos.map((modulo) => ({
      title: modulo.titulo,
      lessons: modulo.aulas.map((titulo) => ({ title: titulo, durationSeconds: 300 })),
    })),
  };
}

describe("Conteúdo programático no verso", () => {
  test("módulo em inteiro, aula em decimal", () => {
    /* É a convenção de plano de ensino, e dispensa recuo para quem lê o
       documento impresso em preto e branco. */
    const p = programaDoCurso(
      outline([
        { titulo: "Fundamentos", aulas: ["Riscos", "Sinalização"] },
        { titulo: "Emergência", aulas: ["Brigada"] },
      ]),
    );

    assert.deepEqual(
      p.itens.map((i) => i.numero),
      ["1", "1.1", "1.2", "2", "2.1"],
    );
  });

  test("a aula leva a duração; o módulo, não", () => {
    const p = programaDoCurso(outline([{ titulo: "M", aulas: ["A"] }]));
    assert.equal(p.itens[0]?.duracao, undefined);
    assert.equal(p.itens[1]?.duracao, "5min");
  });

  test("programa longo é cortado, e o corte é declarado", () => {
    /* Transbordar empurra texto para fora da página, e ninguém percebe até
       imprimir. Cortar em silêncio é pior: quem audita não saberia que a lista
       continua. */
    const muitas = Array.from({ length: 60 }, (_, i) => `Aula ${i + 1}`);
    const p = programaDoCurso(outline([{ titulo: "M", aulas: muitas }]));

    assert.equal(p.truncado, true);
    assert.equal(p.itens.length, LINHAS_POR_PAGINA);
    assert.equal(p.total, 61, "o total conta o programa inteiro, não o que coube");
  });

  test("programa que cabe não é marcado como cortado", () => {
    const p = programaDoCurso(outline([{ titulo: "M", aulas: ["A", "B"] }]));
    assert.equal(p.truncado, false);
    assert.equal(p.total, 3);
  });

  test("curso sem módulo não quebra", () => {
    const p = programaDoCurso(outline([]));
    assert.deepEqual(p.itens, []);
    assert.equal(p.truncado, false);
  });
});

describe("Carga horária do certificado", () => {
  test("a declarada tem precedência sobre a soma dos vídeos", () => {
    /* Um curso com 40 minutos de vídeo pode valer quatro horas contando
       leitura e exercício, e é o número declarado que a área de treinamento
       defende numa auditoria. */
    const c = cargaDoCertificado(240, 2400);
    assert.equal(c.minutos, 240);
    assert.equal(c.origem, "declarada");
  });

  test("sem declarada, cai na soma dos vídeos", () => {
    const c = cargaDoCertificado(undefined, 3600);
    assert.equal(c.minutos, 60);
    assert.equal(c.origem, "video");
  });

  test("declarada zero conta como ausente", () => {
    const c = cargaDoCertificado(0, 1800);
    assert.equal(c.origem, "video");
  });

  test("a carga é escrita por extenso", () => {
    assert.equal(cargaPorExtenso(240), "4 horas");
    assert.equal(cargaPorExtenso(60), "1 hora");
    assert.equal(cargaPorExtenso(90), "1h30");
    assert.equal(cargaPorExtenso(45), "45 minutos");
  });

  test("carga desconhecida é dita, não omitida", () => {
    /* Um campo em branco num documento de auditoria levanta mais dúvida que
       uma frase dizendo que o dado não existe. */
    assert.equal(cargaPorExtenso(0), "não informada");
  });
});
