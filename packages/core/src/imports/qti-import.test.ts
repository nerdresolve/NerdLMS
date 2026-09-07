import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseQtiItem, planQtiImport } from "./qti-import.ts";

/** Um item de múltipla escolha como o Moodle e o Canvas exportam. */
function itemEscolha(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem identifier="Q1" title="Cloração">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>2.5</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>Qual é o agente usado na <strong>desinfecção</strong> da água tratada?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Sulfato de alumínio</simpleChoice>
      <simpleChoice identifier="B">Cloro</simpleChoice>
      <simpleChoice identifier="C">Cal hidratada</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="geral" showHide="show">
    O cloro é o desinfetante padrão no tratamento de água.
  </modalFeedback>
</assessmentItem>`;
}

describe("QTI, o item de escolha", () => {
  test("lê enunciado, alternativas e gabarito", () => {
    const q = parseQtiItem(itemEscolha(), 1);

    assert.equal(q.situacao, "criar");
    assert.equal(q.tipo, "single_choice");
    assert.equal(q.enunciado, "Qual é o agente usado na desinfecção da água tratada?");
    assert.equal(q.alternativas.length, 3);
    assert.equal(q.alternativas[1]!.texto, "Cloro");
    assert.equal(q.alternativas[1]!.correta, true);
    assert.equal(q.alternativas[0]!.correta, false);
  });

  test("o HTML do enunciado vira texto", () => {
    /* QTI permite `<p>` e `<strong>` no enunciado. Deixar entrar mostraria a
       marcação literal na tela da prova. */
    const q = parseQtiItem(itemEscolha(), 1);
    assert.ok(!q.enunciado.includes("<"));
    assert.ok(q.enunciado.includes("desinfecção"));
  });

  test("o enunciado NÃO leva as alternativas grudadas", () => {
    /* Enunciado e alternativas moram no mesmo `<itemBody>`. */
    const q = parseQtiItem(itemEscolha(), 1);
    assert.ok(!q.enunciado.includes("Cloro"));
    assert.ok(!q.enunciado.includes("Cal hidratada"));
  });

  test("o peso sai do MAXSCORE", () => {
    assert.equal(parseQtiItem(itemEscolha(), 1).pontos, 2.5);
  });

  test("sem MAXSCORE, o peso é 1, não é motivo para recusar", () => {
    const semPeso = itemEscolha().replace(/<outcomeDeclaration[\s\S]*?<\/outcomeDeclaration>/, "");
    const q = parseQtiItem(semPeso, 1);

    assert.equal(q.situacao, "criar");
    assert.equal(q.pontos, 1);
  });

  test("o feedback vira explicação", () => {
    const q = parseQtiItem(itemEscolha(), 1);
    assert.match(q.explicacao ?? "", /desinfetante padrão/);
  });
});

describe("QTI, os tipos que a contagem revela", () => {
  test("duas alternativas certas viram múltipla resposta", () => {
    /* O QTI não distingue os dois na tag — a contagem distingue, e os dois são
       corrigidos de formas diferentes. */
    const xml = itemEscolha().replace(
      "<correctResponse><value>B</value></correctResponse>",
      "<correctResponse><value>B</value><value>C</value></correctResponse>",
    );

    const q = parseQtiItem(xml, 1);
    assert.equal(q.tipo, "multiple_choice");
    assert.equal(q.alternativas.filter((a) => a.correta).length, 2);
  });

  test("verdadeiro/falso é reconhecido pelas alternativas", () => {
    const xml = `<assessmentItem identifier="Q2">
      <responseDeclaration identifier="RESPONSE">
        <correctResponse><value>V</value></correctResponse>
      </responseDeclaration>
      <itemBody>
        <p>A água tratada dispensa análise laboratorial.</p>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="V">Verdadeiro</simpleChoice>
          <simpleChoice identifier="F">Falso</simpleChoice>
        </choiceInteraction>
      </itemBody>
    </assessmentItem>`;

    assert.equal(parseQtiItem(xml, 1).tipo, "true_false");
  });

  test("True/False em inglês também é reconhecido", () => {
    /* Um banco exportado de plataforma estrangeira traz assim, e recusar a
       forma dele criaria o tipo errado em silêncio. */
    const xml = `<assessmentItem>
      <responseDeclaration><correctResponse><value>T</value></correctResponse></responseDeclaration>
      <itemBody><p>Water is wet.</p>
        <choiceInteraction>
          <simpleChoice identifier="T">True</simpleChoice>
          <simpleChoice identifier="F">False</simpleChoice>
        </choiceInteraction>
      </itemBody>
    </assessmentItem>`;

    assert.equal(parseQtiItem(xml, 1).tipo, "true_false");
  });

  test("a dissertativa não precisa de alternativas", () => {
    const xml = `<assessmentItem>
      <itemBody>
        <p>Descreva o processo de floculação.</p>
        <extendedTextInteraction responseIdentifier="RESPONSE"/>
      </itemBody>
    </assessmentItem>`;

    const q = parseQtiItem(xml, 1);
    assert.equal(q.situacao, "criar");
    assert.equal(q.tipo, "essay");
    assert.equal(q.alternativas.length, 0);
  });
});

describe("QTI, o que é recusado, e com que mensagem", () => {
  test("questão de associação é recusada PELO NOME", () => {
    /* "Item inválido" faria o professor abrir o XML para descobrir o quê.
       O tipo no texto diz o que fazer. */
    const xml = `<assessmentItem>
      <itemBody><p>Ligue os termos.</p>
        <matchInteraction responseIdentifier="RESPONSE"/>
      </itemBody>
    </assessmentItem>`;

    const q = parseQtiItem(xml, 1);
    assert.equal(q.situacao, "erro");
    assert.match(q.erro ?? "", /associação/i);
  });

  test("arrastar em imagem é recusado", () => {
    const xml = `<assessmentItem>
      <itemBody><p>Arraste.</p><graphicGapMatchInteraction responseIdentifier="R"/></itemBody>
    </assessmentItem>`;

    assert.match(parseQtiItem(xml, 1).erro ?? "", /arrastar em imagem/i);
  });

  test("objetiva sem gabarito é recusada", () => {
    /* Mesma regra da importação por planilha: vale zero para todo mundo que
       responder, e ninguém percebe até a correção. */
    const xml = `<assessmentItem>
      <responseDeclaration><correctResponse></correctResponse></responseDeclaration>
      <itemBody><p>Qual?</p>
        <choiceInteraction>
          <simpleChoice identifier="A">Um</simpleChoice>
          <simpleChoice identifier="B">Dois</simpleChoice>
        </choiceInteraction>
      </itemBody>
    </assessmentItem>`;

    const q = parseQtiItem(xml, 1);
    assert.equal(q.situacao, "erro");
    assert.match(q.erro ?? "", /alternativa correta/i);
  });

  test("objetiva com uma alternativa só é recusada", () => {
    const xml = `<assessmentItem>
      <responseDeclaration><correctResponse><value>A</value></correctResponse></responseDeclaration>
      <itemBody><p>Qual?</p>
        <choiceInteraction><simpleChoice identifier="A">Única</simpleChoice></choiceInteraction>
      </itemBody>
    </assessmentItem>`;

    assert.match(parseQtiItem(xml, 1).erro ?? "", /duas alternativas/i);
  });

  test("item sem enunciado é recusado", () => {
    const xml = `<assessmentItem>
      <itemBody>
        <choiceInteraction>
          <simpleChoice identifier="A">Um</simpleChoice>
          <simpleChoice identifier="B">Dois</simpleChoice>
        </choiceInteraction>
      </itemBody>
    </assessmentItem>`;

    assert.match(parseQtiItem(xml, 1).erro ?? "", /enunciado/i);
  });

  test("item sem interação nenhuma é recusado", () => {
    assert.equal(parseQtiItem("<assessmentItem><itemBody><p>Só texto.</p></itemBody></assessmentItem>", 1).situacao, "erro");
  });
});

describe("QTI, o arquivo inteiro", () => {
  test("lê vários itens e conta o que dá para criar", () => {
    const xml = `<assessmentTest>
      <assessmentItem>
        <responseDeclaration><correctResponse><value>A</value></correctResponse></responseDeclaration>
        <itemBody><p>Primeira?</p>
          <choiceInteraction>
            <simpleChoice identifier="A">Sim</simpleChoice>
            <simpleChoice identifier="B">Não</simpleChoice>
          </choiceInteraction>
        </itemBody>
      </assessmentItem>
      <assessmentItem>
        <itemBody><p>Ligue.</p><matchInteraction responseIdentifier="R"/></itemBody>
      </assessmentItem>
      <assessmentItem>
        <itemBody><p>Disserte.</p><extendedTextInteraction responseIdentifier="R"/></itemBody>
      </assessmentItem>
    </assessmentTest>`;

    const plano = planQtiImport(xml);

    assert.equal(plano.linhas.length, 3);
    assert.equal(plano.criar, 2);
    assert.equal(plano.erros, 1);
  });

  test("um item ruim não derruba o arquivo inteiro", () => {
    /* Um banco de duzentas questões com três de arrastar importa 197, e a tela
       mostra quais ficaram de fora. Recusar tudo obrigaria a editar XML. */
    const xml = `<assessmentTest>
      <assessmentItem><itemBody><p>A.</p><hotspotInteraction responseIdentifier="R"/></itemBody></assessmentItem>
      <assessmentItem><itemBody><p>B.</p><extendedTextInteraction responseIdentifier="R"/></itemBody></assessmentItem>
    </assessmentTest>`;

    const plano = planQtiImport(xml);
    assert.equal(plano.criar, 1);
    assert.equal(plano.erros, 1);
  });

  test("a numeração aponta a posição do item no arquivo", () => {
    const xml = `<assessmentTest>
      <assessmentItem><itemBody><p>A.</p><extendedTextInteraction responseIdentifier="R"/></itemBody></assessmentItem>
      <assessmentItem><itemBody><p>B.</p><matchInteraction responseIdentifier="R"/></itemBody></assessmentItem>
    </assessmentTest>`;

    const plano = planQtiImport(xml);
    assert.equal(plano.linhas[1]!.linha, 2);
  });

  test("comentário no XML não vira questão", () => {
    const xml = `<assessmentTest>
      <!-- <assessmentItem><itemBody><p>Comentada</p></itemBody></assessmentItem> -->
      <assessmentItem><itemBody><p>Real.</p><extendedTextInteraction responseIdentifier="R"/></itemBody></assessmentItem>
    </assessmentTest>`;

    assert.equal(planQtiImport(xml).linhas.length, 1);
  });

  test("QTI 3.0, com hífen nas tags, também é lido", () => {
    /* O 3.0 renomeou tudo para `qti-...`. Recusar por isso seria recusar
       arquivo válido de plataforma atual. */
    const xml = `<qti-assessment-item identifier="Q1">
      <qti-response-declaration identifier="RESPONSE">
        <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
      </qti-response-declaration>
      <qti-item-body><p>Pergunta 3.0?</p>
        <qti-choice-interaction response-identifier="RESPONSE">
          <qti-simple-choice identifier="A">Certa</qti-simple-choice>
          <qti-simple-choice identifier="B">Errada</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
    </qti-assessment-item>`;

    const plano = planQtiImport(xml);
    assert.equal(plano.criar, 1, plano.linhas[0]?.erro ?? "");
    assert.equal(plano.linhas[0]!.alternativas[0]!.correta, true);
  });
});
