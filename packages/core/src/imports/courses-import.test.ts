import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseTable } from "./csv-parse.ts";
import { FORMATOS_ACEITOS, MODELO_CURSOS, planCoursesImport } from "./courses-import.ts";
import { KIND_LABEL } from "../courses/content.ts";
import { slugify, uniqueSlug } from "../courses/slug.ts";
import { toCsv } from "../reports/csv.ts";

function doCsv(texto: string) {
  return parseTable(texto).rows;
}

const CAB = "Tipo;Titulo;Descricao;Formato;Duracao;URL;Paginas";

describe("Importação de cursos — F5-05", () => {
  test("monta a árvore pela ordem das linhas", () => {
    const plano = planCoursesImport(
      doCsv(
        `${CAB}\r\n` +
          "curso;NR-10;Segurança elétrica;;;;\r\n" +
          "modulo;Fundamentos;;;;;\r\n" +
          "aula;Riscos;;video;12;;\r\n" +
          "aula;Proteções;;video;15;;\r\n" +
          "modulo;Prática;;;;;\r\n" +
          "aula;Bloqueio;;video;20;;",
      ),
    );

    assert.equal(plano.erros.length, 0);
    assert.equal(plano.cursos.length, 1);
    assert.equal(plano.totalModulos, 2);
    assert.equal(plano.totalAulas, 3);

    const curso = plano.cursos[0]!;
    assert.equal(curso.titulo, "NR-10");
    assert.equal(curso.modulos[0]!.aulas.length, 2);
    assert.equal(curso.modulos[1]!.aulas.length, 1);
    assert.equal(curso.modulos[1]!.aulas[0]!.titulo, "Bloqueio");
  });

  test("curso novo zera o módulo corrente", () => {
    /* Sem isto, a primeira aula do segundo curso cairia no último módulo do
       primeiro — e ninguém notaria até abrir o curso. */
    const plano = planCoursesImport(
      doCsv(
        `${CAB}\r\n` +
          "curso;Primeiro;;;;;\r\n" +
          "modulo;M1;;;;;\r\n" +
          "aula;A1;;video;10;;\r\n" +
          "curso;Segundo;;;;;\r\n" +
          "modulo;M2;;;;;\r\n" +
          "aula;A2;;video;10;;",
      ),
    );

    assert.equal(plano.cursos.length, 2);
    assert.equal(plano.cursos[0]!.modulos.length, 1);
    assert.equal(plano.cursos[1]!.modulos.length, 1);
    assert.equal(plano.cursos[1]!.modulos[0]!.aulas[0]!.titulo, "A2");
  });

  test("aula antes de módulo é recusada, citando a linha", () => {
    const plano = planCoursesImport(
      doCsv(`${CAB}\r\ncurso;NR-10;;;;;\r\naula;Órfã;;video;10;;`),
    );

    assert.equal(plano.erros.length, 2); // a órfã e o curso que ficou sem aula
    assert.equal(plano.erros[0]!.linha, 3);
    assert.match(plano.erros[0]!.mensagem, /antes de qualquer módulo/i);
  });

  test("módulo antes de curso é recusado", () => {
    const plano = planCoursesImport(doCsv(`${CAB}\r\nmodulo;Solto;;;;;`));

    assert.equal(plano.cursos.length, 0);
    assert.match(plano.erros[0]!.mensagem, /antes de qualquer curso/i);
  });

  test("curso sem nenhuma aula é recusado", () => {
    /* Quem se matricular abre uma casca vazia. */
    const plano = planCoursesImport(
      doCsv(`${CAB}\r\ncurso;Vazio;;;;;\r\nmodulo;M1;;;;;`),
    );

    assert.equal(plano.cursos.length, 0);
    assert.match(plano.erros[0]!.mensagem, /não tem nenhuma aula/i);
  });

  test("reconhece os formatos de aula", () => {
    const plano = planCoursesImport(
      doCsv(
        `${CAB}\r\n` +
          "curso;C;;;;;\r\n" +
          "modulo;M;;;;;\r\n" +
          "aula;V;;video;10;;\r\n" +
          "aula;D;;powerpoint;20;;30\r\n" +
          "aula;T;Um texto de leitura;texto;5;;\r\n" +
          "aula;L;;link;0;https://exemplo.gov.br;",
      ),
    );

    const aulas = plano.cursos[0]!.modulos[0]!.aulas;
    assert.deepEqual(
      aulas.map((a) => a.formato),
      ["video", "slides", "text", "link"],
    );
    assert.equal(aulas[1]!.paginas, 30);
    assert.equal(aulas[2]!.texto, "Um texto de leitura");
    assert.equal(aulas[3]!.url, "https://exemplo.gov.br");
  });

  test("aula de link sem endereço é recusada", () => {
    /* Vídeo e documento podem ser anexados depois pela tela; um "link" sem
       link é só um título. */
    const plano = planCoursesImport(
      doCsv(`${CAB}\r\ncurso;C;;;;;\r\nmodulo;M;;;;;\r\naula;Sem link;;link;5;;`),
    );

    assert.match(plano.erros[0]!.mensagem, /link sem endereço/i);
  });

  test("formato e tipo desconhecidos são recusados, não adivinhados", () => {
    const plano = planCoursesImport(
      doCsv(
        `${CAB}\r\n` +
          "curso;C;;;;;\r\n" +
          "modulo;M;;;;;\r\n" +
          "aula;X;;holograma;5;;\r\n" +
          "seminario;Y;;;;;",
      ),
    );

    assert.equal(plano.erros.length, 3); // formato, tipo, e o curso sem aula
    assert.match(plano.erros[0]!.mensagem, /holograma/);
    assert.match(plano.erros[1]!.mensagem, /seminario/i);
  });

  test("duração inválida é recusada", () => {
    const plano = planCoursesImport(
      doCsv(`${CAB}\r\ncurso;C;;;;;\r\nmodulo;M;;;;;\r\naula;A;;video;muito tempo;;`),
    );

    assert.match(plano.erros[0]!.mensagem, /minutos/i);
  });

  test("duração com vírgula decimal", () => {
    const plano = planCoursesImport(
      doCsv(`${CAB}\r\ncurso;C;;;;;\r\nmodulo;M;;;;;\r\naula;A;;video;12,5;;`),
    );

    assert.equal(plano.cursos[0]!.modulos[0]!.aulas[0]!.duracaoMinutos, 12.5);
  });

  test("o curso importado usa o slug canônico, com desempate", () => {
    /* A importação não gera slug próprio: usa `courses/slug.ts`, que é quem
       sabe desempatar. Importar duas vezes a mesma planilha não pode falhar
       por chave duplicada. */
    assert.equal(slugify("Segurança em Espaço Confinado"), "seguranca-em-espaco-confinado");

    const jaExistem = ["nr-10", "nr-10-2"];
    assert.equal(uniqueSlug("NR-10", jaExistem), "nr-10-3");
  });

  test("todo formato que o leitor produz é um tipo que o produto conhece", () => {
    /* A importação já emitiu "external",
       que não existe no CHECK de `lessons`. Passou pelo TypeScript, passou pela
       conferência, e estourou no INSERT — depois de já ter gravado três aulas.

       `KIND_LABEL` tem uma entrada por `ContentKind`, então é a lista do
       produto. Se alguém inventar um formato novo aqui, este teste reprova
       antes de o banco reprovar em produção. */
    for (const formato of FORMATOS_ACEITOS) {
      assert.ok(
        formato in KIND_LABEL,
        `formato "${formato}" não é um ContentKind — o banco vai recusar`,
      );
    }
  });

  test("o modelo oferecido importa sem erro", () => {
    const arquivo = toCsv(MODELO_CURSOS.headers, MODELO_CURSOS.exemplo);
    const plano = planCoursesImport(doCsv(arquivo));

    assert.equal(plano.erros.length, 0);
    assert.equal(plano.cursos.length, 1);
    assert.equal(plano.totalModulos, 2);
    assert.equal(plano.totalAulas, 4);
  });
});
