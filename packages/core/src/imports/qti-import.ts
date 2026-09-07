/**
 * Importação de questões em QTI — o guia §30.
 *
 * QTI é o padrão da 1EdTech para questões e avaliações. Quem vem de outro LMS
 * — Moodle, Canvas, Blackboard — exporta o banco de questões nesse formato, e
 * sem ele a migração é redigitar tudo.
 *
 * QUAL QTI
 *
 * O 2.x, que é o que as plataformas exportam na prática. O 3.0 existe desde
 * 2022 e mudou os nomes das tags (`qti-assessment-item`, com hífen); as duas
 * grafias são aceitas aqui, porque o custo é um `?` no regex e a alternativa
 * seria recusar arquivo válido.
 *
 * A LEITURA É POR EXPRESSÃO REGULAR, como a do manifesto SCORM.
 *
 * Mesma razão, escrita lá: um analisador de XML completo traria uma dependência
 * inteira — com a superfície de ataque que um analisador tem (entidades
 * externas, expansão recursiva) — para ler um punhado de campos de um arquivo
 * que vem de terceiro. As regexes abaixo não expandem nada.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, E POR QUÊ
 *
 * QTI descreve interações que este produto não tem — arrastar e soltar em
 * imagem, lacuna dentro de texto formatado, resposta gráfica. Elas são
 * RECUSADAS por nome, com o tipo declarado no erro. Converter à força uma
 * questão de arrastar para múltipla escolha mudaria o que está sendo
 * perguntado, e ninguém notaria até alguém reclamar da correção.
 */

import type { QuestaoImportada, QuestionKind } from "./questions-import.ts";

/** As interações do QTI que este produto sabe representar. */
const INTERACAO_SUPORTADA: Record<string, QuestionKind> = {
  choiceinteraction: "single_choice",
  extendedtextinteraction: "essay",
};

/**
 * As que existem no padrão e não têm equivalente aqui.
 *
 * `textEntryInteraction` está na lista embora `short_answer` exista no banco:
 * a importação de questões (F5-05) trabalha com quatro tipos, e fazer o QTI
 * criar um quinto por caminho próprio deixaria duas portas com regras
 * diferentes para a mesma tabela.
 */
const INTERACAO_CONHECIDA: Record<string, string> = {
  textentryinteraction: "resposta curta",
  matchinteraction: "associação",
  orderinteraction: "ordenação",
  gapmatchinteraction: "lacuna",
  hottextinteraction: "texto clicável",
  hotspotinteraction: "área de imagem",
  graphicgapmatchinteraction: "arrastar em imagem",
  sliderinteraction: "controle deslizante",
  uploadinteraction: "envio de arquivo",
  drawinginteraction: "desenho",
};

/**
 * Prepara o XML para leitura: tira comentários e normaliza a grafia do 3.0.
 *
 * O QTI 3.0 renomeou TODAS as tags — `qti-assessment-item`, `qti-item-body`,
 * `qti-simple-choice`. Tratar as duas grafias em cada expressão seria dez
 * lugares para errar, e errar em um só faria metade de um arquivo 3.0 ser lido
 * e a outra metade não: o pior resultado, porque parece funcionar.
 *
 * Aqui as tags do 3.0 são convertidas para a grafia do 2.x uma vez, e o resto
 * do módulo lida com um vocabulário só. Os ATRIBUTOS também mudaram
 * (`response-identifier`), mas os que este módulo lê — `identifier` — têm o
 * mesmo nome nas duas versões.
 */
function limpar(xml: string): string {
  const semRuido = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "");

  return semRuido.replace(/<(\/?)qti-([a-z-]+)/gi, (_todo, barra: string, nome: string) => {
    /* `item-body` vira `itemBody`: hífen fora, letra seguinte em maiúscula —
       que é exatamente a diferença entre as duas grafias. */
    const camel = nome.replace(/-([a-z])/g, (_m, letra: string) => letra.toUpperCase());
    return `<${barra}${camel}`;
  });
}

/**
 * Texto legível de um trecho de XML.
 *
 * QTI permite HTML dentro do enunciado — `<p>`, `<strong>`, `<img>`. As tags
 * saem e o texto fica: o produto guarda enunciado como texto, e deixar a
 * marcação entrar mostraria `<p>` literal na tela da prova.
 */
function textoDe(xml: string): string {
  return xml
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    /* `&amp;` por último: antes dos outros, transformaria `&amp;lt;` em `<`. */
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O valor de um atributo, com aspas simples ou duplas.
 *
 * `String.raw` e não template comum: num template, `\b` chega ao construtor do
 * RegExp como ``, que ali significa BACKSPACE, não fronteira de palavra. O
 * padrão passava a não casar nada, em silêncio — a alternativa correta virava
 * "não é correta", e a questão era recusada por não ter gabarito.
 */
function atributo(tag: string, nome: string): string | undefined {
  const m = new RegExp(String.raw`\b${nome}\s*=\s*["']([^"']*)["']`, "i").exec(tag);
  return m?.[1];
}

/**
 * As respostas certas declaradas no item.
 *
 * Ficam em `<correctResponse>`, dentro de `<responseDeclaration>`, como uma
 * lista de identificadores — não como texto. É por isso que a leitura das
 * alternativas precisa dos dois lugares: o texto vem de `<simpleChoice>`, e
 * quais estão certas vêm daqui.
 */
function respostasCertas(item: string): Set<string> {
  const bloco = /<(?:qti-)?correctResponse\b[^>]*>([\s\S]*?)<\/(?:qti-)?correctResponse>/i.exec(
    item,
  );
  if (!bloco?.[1]) return new Set();

  const valores = [...bloco[1].matchAll(/<(?:qti-)?value\b[^>]*>([\s\S]*?)<\/(?:qti-)?value>/gi)]
    .map((m) => textoDe(m[1] ?? ""))
    .filter(Boolean);

  return new Set(valores);
}

/** O tipo de interação declarado no item, em minúsculas e sem o prefixo. */
function tipoDeInteracao(item: string): string | null {
  /* `[\w-]+` e nao `\w+`: o 3.0 escreve `qti-choice-interaction`, com hifen
     DENTRO do nome. Sem o hifen na classe, o padrao parava em `qti-choice` e
     nenhuma interacao era reconhecida — o arquivo 3.0 inteiro virava erro. */
  const m = /<(?:qti-)?([\w-]*[Ii]nteraction)\b/i.exec(item);
  if (!m?.[1]) return null;

  /* O QTI 3.0 escreve `qti-choice-interaction`; o 2.x, `choiceInteraction`.
     Tirar os hífens e a caixa deixa os dois na mesma chave. */
  return m[1].toLowerCase().replace(/-/g, "");
}

function pontosDe(item: string): number {
  /* `MAXSCORE` é o nome convencional do peso da questão no QTI. Ausente ou
     inválido vira 1 — recusar a questão por causa do peso seria perder o
     enunciado por um detalhe que o professor ajusta em dez segundos. */
  const m = /<(?:qti-)?outcomeDeclaration\b[^>]*identifier\s*=\s*["']MAXSCORE["'][\s\S]*?<(?:qti-)?value\b[^>]*>([\s\S]*?)<\/(?:qti-)?value>/i.exec(
    item,
  );

  const n = Number(textoDe(m?.[1] ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Um item QTI vira uma questão.
 *
 * `linha` é a posição do item no arquivo, não uma linha de planilha — a tela de
 * conferência é a mesma da importação por CSV, e ela precisa de um número para
 * apontar onde está o problema.
 */
export function parseQtiItem(xml: string, linha: number): QuestaoImportada {
  const item = limpar(xml);

  const erro = (mensagem: string): QuestaoImportada => ({
    linha,
    tipo: "essay",
    enunciado: textoDe(corpo(item)).slice(0, 120) || "(sem enunciado)",
    pontos: 1,
    explicacao: null,
    categoria: null,
    alternativas: [],
    situacao: "erro",
    erro: mensagem,
  });

  const interacao = tipoDeInteracao(item);
  if (!interacao) return erro("O item não declara nenhuma interação.");

  const conhecida = INTERACAO_CONHECIDA[interacao];
  if (conhecida) {
    /* Recusa com o TIPO no texto. "Questão de associação não é suportada" diz
       o que fazer; "item inválido" não diz nada, e o professor abriria o XML
       para descobrir. */
    return erro(`Questão de ${conhecida} não tem equivalente na plataforma.`);
  }

  const tipoBase = INTERACAO_SUPORTADA[interacao];
  if (!tipoBase) return erro(`Interação desconhecida: ${interacao}.`);

  const enunciado = textoDe(corpo(item));
  if (!enunciado) return erro("O item não tem enunciado.");

  const pontos = pontosDe(item);
  const explicacao = feedbackGeral(item);

  if (tipoBase !== "single_choice") {
    return {
      linha,
      tipo: tipoBase,
      enunciado,
      pontos,
      explicacao,
      categoria: null,
      alternativas: [],
      situacao: "criar",
    };
  }

  const certas = respostasCertas(item);
  const alternativas = alternativasDe(item, certas);

  if (alternativas.length < 2) {
    return erro("A questão objetiva tem menos de duas alternativas.");
  }

  const quantasCertas = alternativas.filter((a) => a.correta).length;
  if (quantasCertas === 0) {
    /* Mesma regra da importação por planilha: uma objetiva sem gabarito vale
       zero para todo mundo que responder, e importá-la em silêncio estragaria
       a prova sem ninguém perceber até a correção. */
    return erro("A questão não declara nenhuma alternativa correta.");
  }

  /* Duas ou mais certas é múltipla resposta — outro tipo, corrigido de outro
     jeito. O QTI não distingue os dois na tag; a contagem distingue. */
  const tipo: QuestionKind = quantasCertas > 1 ? "multiple_choice" : "single_choice";

  /* Verdadeiro/falso é o caso particular reconhecível: duas alternativas com
     esses textos. Importar como escolha simples funcionaria, mas perderia a
     apresentação própria que a plataforma dá a ele. */
  const tipoFinal = ehVerdadeiroFalso(alternativas) ? "true_false" : tipo;

  return {
    linha,
    tipo: tipoFinal,
    enunciado,
    pontos,
    explicacao,
    categoria: null,
    alternativas,
    situacao: "criar",
  };
}

/**
 * O corpo do item, sem as alternativas.
 *
 * O enunciado e as alternativas moram no MESMO bloco `<itemBody>`, e sem tirar
 * as alternativas o enunciado sairia com todas elas grudadas no fim.
 */
function corpo(item: string): string {
  const bloco = /<(?:qti-)?itemBody\b[^>]*>([\s\S]*?)<\/(?:qti-)?itemBody>/i.exec(item);
  const dentro = bloco?.[1] ?? "";

  return dentro
    .replace(/<(?:qti-)?simpleChoice\b[\s\S]*?<\/(?:qti-)?simpleChoice>/gi, " ")
    .replace(/<(?:qti-)?prompt\b[^>]*>([\s\S]*?)<\/(?:qti-)?prompt>/gi, " $1 ");
}

function alternativasDe(
  item: string,
  certas: Set<string>,
): Array<{ texto: string; correta: boolean }> {
  const escolhas = [
    ...item.matchAll(
      /<(?:qti-)?simpleChoice\b([^>]*)>([\s\S]*?)<\/(?:qti-)?simpleChoice>/gi,
    ),
  ];

  return escolhas
    .map((m) => ({
      texto: textoDe(m[2] ?? ""),
      /* A alternativa é correta quando o identificador dela está na lista de
         `correctResponse` — o texto não entra nessa comparação, e é por isso
         que as duas leituras existem. */
      correta: certas.has(atributo(m[1] ?? "", "identifier") ?? ""),
    }))
    .filter((a) => a.texto !== "");
}

/** Duas alternativas, com esses textos, é verdadeiro/falso. */
function ehVerdadeiroFalso(alternativas: Array<{ texto: string }>): boolean {
  if (alternativas.length !== 2) return false;

  const normalizar = (t: string): string =>
    t
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const textos = alternativas.map((a) => normalizar(a.texto)).sort();

  /* Português e inglês: um banco exportado de plataforma estrangeira traz
     `True`/`False`, e recusar a forma dele criaria um tipo errado em silêncio. */
  return (
    (textos[0] === "falso" && textos[1] === "verdadeiro") ||
    (textos[0] === "false" && textos[1] === "true")
  );
}

/**
 * O feedback geral do item vira a explicação da questão.
 *
 * `modalFeedback` sem `identifier` de acerto/erro é o comentário que o autor
 * escreveu para explicar a resposta — que é exatamente o que a plataforma
 * chama de explicação. Os condicionais (só quando acerta, só quando erra) são
 * ignorados: o produto tem um campo, não dois.
 */
function feedbackGeral(item: string): string | null {
  const m = /<(?:qti-)?modalFeedback\b[^>]*>([\s\S]*?)<\/(?:qti-)?modalFeedback>/i.exec(item);
  const texto = textoDe(m?.[1] ?? "");

  return texto || null;
}

export interface PlanoQti {
  linhas: QuestaoImportada[];
  criar: number;
  erros: number;
}

/**
 * Lê um arquivo QTI inteiro.
 *
 * Aceita tanto um item solto quanto um `assessmentTest` com vários — as
 * plataformas exportam das duas formas, e exigir uma delas faria metade dos
 * arquivos serem recusados por um detalhe de embalagem.
 *
 * Item com erro NÃO interrompe os outros: um banco de duzentas questões com
 * três de arrastar-e-soltar importa cento e noventa e sete, e a tela mostra
 * quais ficaram de fora e por quê. Recusar o arquivo inteiro obrigaria a
 * editar XML à mão.
 */
export function planQtiImport(xml: string): PlanoQti {
  const itens = [
    ...limpar(xml).matchAll(
      /<(?:qti-)?assessmentItem\b[\s\S]*?<\/(?:qti-)?assessmentItem>/gi,
    ),
  ].map((m) => m[0]);

  /* Sem `<assessmentItem>`, o arquivo ainda pode ser um item sem a embalagem
     externa — alguns exportadores fazem isso. Tentar lê-lo como item único é
     melhor que devolver "nenhuma questão encontrada" para um arquivo que tem
     uma. */
  const fonte = itens.length > 0 ? itens : [xml];

  const linhas = fonte.map((item, i) => parseQtiItem(item, i + 1));

  return {
    linhas,
    criar: linhas.filter((l) => l.situacao === "criar").length,
    erros: linhas.filter((l) => l.situacao === "erro").length,
  };
}
