/**
 * Exportação de questões em QTI — o guia §30.
 *
 * A contrapartida da importação: quem sai desta plataforma leva o banco de
 * questões num formato que outro LMS lê. É o que impede o produto de virar uma
 * armadilha — e é justamente por isso que o §30 pede os dois lados.
 *
 * O QTI GERADO É 2.1.
 *
 * Não o 3.0, embora ele seja mais novo: o 2.1 é o que Moodle, Canvas e
 * Blackboard importam hoje. Exportar num formato que o destino não lê seria
 * cumprir a letra do requisito e falhar no propósito dele.
 */

export interface QuestaoParaExportar {
  id: string;
  kind: string;
  prompt: string;
  points: number;
  explanation: string | null;
  alternativas: Array<{ texto: string; correta: boolean }>;
}

/**
 * Escapa texto para dentro de XML.
 *
 * `&` primeiro, sempre: depois dos outros, transformaria o `&` que ele mesmo
 * acabou de escrever (`&lt;`) em `&amp;lt;`, e o destino mostraria `&lt;`
 * literal na tela.
 */
export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * O identificador de uma alternativa dentro do item.
 *
 * Letras, como numa prova impressa: A, B, C. Depois de Z vira AA — um banco com
 * questão de trinta alternativas é raro, mas repetir "A" ali quebraria o
 * gabarito em silêncio, que é o pior defeito possível num exportador.
 */
export function letraDe(indice: number): string {
  let n = indice;
  let saida = "";

  do {
    saida = String.fromCharCode(65 + (n % 26)) + saida;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);

  return saida;
}

/** Os tipos que têm representação em QTI. */
const EXPORTAVEL = new Set(["single_choice", "multiple_choice", "true_false", "essay"]);

export function podeExportar(kind: string): boolean {
  return EXPORTAVEL.has(kind);
}

/**
 * Uma questão vira um `<assessmentItem>`.
 *
 * A dissertativa não declara `correctResponse`: ela é corrigida por uma
 * pessoa, e um gabarito vazio faria o LMS de destino corrigi-la sozinho e dar
 * zero a todo mundo.
 */
export function questaoParaQti(questao: QuestaoParaExportar): string {
  const objetiva = questao.kind !== "essay";

  const identificador = `Q${questao.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;

  const feedback = questao.explanation
    ? `
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="geral" showHide="show">
    <p>${escaparXml(questao.explanation)}</p>
  </modalFeedback>`
    : "";

  if (!objetiva) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
                identifier="${identificador}" title="${escaparXml(recortar(questao.prompt))}"
                adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>${questao.points}</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>${escaparXml(questao.prompt)}</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLength="600"/>
  </itemBody>${feedback}
</assessmentItem>`;
  }

  const corretas = questao.alternativas
    .map((alternativa, i) => ({ letra: letraDe(i), correta: alternativa.correta }))
    .filter((a) => a.correta)
    .map((a) => a.letra);

  /* `multiple` quando há mais de uma certa; `single` quando há uma. É o que
     diz ao LMS de destino como corrigir — com `single` numa questão de duas
     respostas, ele aceitaria só a primeira marcada. */
  const cardinalidade = corretas.length > 1 ? "multiple" : "single";
  const maxEscolhas = corretas.length > 1 ? 0 : 1;

  const valores = corretas.map((letra) => `      <value>${letra}</value>`).join("\n");

  const escolhas = questao.alternativas
    .map(
      (alternativa, i) =>
        `      <simpleChoice identifier="${letraDe(i)}">${escaparXml(alternativa.texto)}</simpleChoice>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
                identifier="${identificador}" title="${escaparXml(recortar(questao.prompt))}"
                adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="${cardinalidade}" baseType="identifier">
    <correctResponse>
${valores}
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>${questao.points}</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>${escaparXml(questao.prompt)}</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="${maxEscolhas}">
${escolhas}
    </choiceInteraction>
  </itemBody>${feedback}
</assessmentItem>`;
}

/** O título do item: o enunciado encurtado, porque QTI espera um rótulo. */
function recortar(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= 60 ? limpo : `${limpo.slice(0, 57)}...`;
}

/**
 * Várias questões num arquivo só.
 *
 * `<assessmentTest>` embrulhando os itens é como as plataformas exportam um
 * banco inteiro — e é o que a nossa própria importação reconhece, o que torna
 * a ida e a volta verificáveis.
 *
 * Questão sem representação em QTI é OMITIDA, não exportada torta. A contagem
 * de omitidas volta junto para quem chama poder avisar.
 */
export function questoesParaQti(questoes: QuestaoParaExportar[]): {
  xml: string;
  exportadas: number;
  omitidas: number;
} {
  const podem = questoes.filter((q) => podeExportar(q.kind));

  const itens = podem
    .map((q) => questaoParaQti(q).replace(/^<\?xml[^>]*\?>\s*/, ""))
    .map((item) => item.split("\n").map((l) => `  ${l}`).join("\n"))
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
                identifier="BANCO" title="Banco de questões">
${itens}
</assessmentTest>`;

  return { xml, exportadas: podem.length, omitidas: questoes.length - podem.length };
}
