/**
 * Importação de questões — F5-05 (guia §24).
 *
 * O formato é CSV, como o resto do §24. **Não é QTI**: o guia pede QTI no §30,
 * como padrão de interoperabilidade acadêmica, e isso é outro trabalho — um
 * pacote XML com manifesto, mídia e perfis. O que o §24 exige é conseguir
 * importar questões, e é isso que está aqui.
 *
 * A dificuldade real do formato: uma questão tem UMA pergunta e VÁRIAS
 * alternativas, e CSV é uma tabela plana. A saída é a coluna repetida —
 * `Alternativa 1`, `Alternativa 2`… — porque é o que uma pessoa consegue
 * preencher no Excel sem instrução. Uma linha por alternativa exigiria repetir
 * o enunciado em todas e amarrá-las por um id inventado à mão.
 */

/** Os tipos que a importação aceita, e como se escrevem na planilha. */
const TIPOS: Record<string, "single_choice" | "multiple_choice" | "true_false" | "essay"> = {
  /* Uma resposta certa. */
  unica: "single_choice",
  umaescolha: "single_choice",
  escolhaunica: "single_choice",
  multiplaescolha: "single_choice",
  singlechoice: "single_choice",

  /* Várias certas ao mesmo tempo. */
  multipla: "multiple_choice",
  multiplasrespostas: "multiple_choice",
  variasrespostas: "multiple_choice",
  multiplechoice: "multiple_choice",

  /* Verdadeiro ou falso. */
  vf: "true_false",
  verdadeirofalso: "true_false",
  verdadeirooufalso: "true_false",
  truefalse: "true_false",

  /* Dissertativa: corrigida à mão. */
  dissertativa: "essay",
  aberta: "essay",
  redacao: "essay",
  essay: "essay",
};

/**
 * `multiplaescolha` aponta para `single_choice` de propósito.
 *
 * Em português, "múltipla escolha" é a prova de marcar UMA alternativa entre
 * várias — é o sentido corrente, e é o que quem preenche a planilha quer dizer.
 * Para várias respostas certas existem `multipla` e `variasrespostas`. Mapear
 * ao contrário faria toda prova comum virar uma questão de múltipla resposta,
 * mudando como ela é corrigida.
 */

export type QuestionKind = (typeof TIPOS)[keyof typeof TIPOS];

/** Normaliza para comparar: sem acento, sem caixa, sem espaço. */
function chave(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

const COLUNAS = {
  tipo: ["tipo", "tipodequestao", "kind", "type"],
  enunciado: ["enunciado", "pergunta", "questao", "prompt", "question"],
  pontos: ["pontos", "peso", "valor", "points"],
  correta: ["correta", "corretas", "gabarito", "resposta", "respostacorreta", "answer"],
  explicacao: ["explicacao", "justificativa", "comentario", "feedback", "explanation"],
  categoria: ["categoria", "assunto", "tema", "category"],
} as const;

function valor(linha: Record<string, string>, nomes: readonly string[]): string {
  for (const nome of nomes) {
    const encontrado = linha[nome];
    if (encontrado !== undefined && encontrado !== "") return encontrado;
  }
  return "";
}

/**
 * As alternativas da linha, em ordem.
 *
 * Aceita `Alternativa 1`, `Opcao 1`, `A`, `B`… porque as três formas aparecem
 * em planilha de verdade. A ordem é a das colunas, e é ela que decide qual
 * número o gabarito cita.
 */
function alternativasDe(linha: Record<string, string>): string[] {
  const numeradas: Array<{ ordem: number; texto: string }> = [];

  for (const [coluna, texto] of Object.entries(linha)) {
    if (texto.trim() === "") continue;

    /* `alternativa1`, `opcao2`, `alt3` — o número decide a ordem. */
    const comNumero = /^(?:alternativa|opcao|opcion|option|alt|resp)(\d+)$/.exec(coluna);
    if (comNumero) {
      numeradas.push({ ordem: Number(comNumero[1]), texto: texto.trim() });
      continue;
    }

    /* Colunas `a`, `b`, `c`, `d`, `e`: letra vira posição. */
    if (/^[a-e]$/.test(coluna)) {
      numeradas.push({ ordem: coluna.charCodeAt(0) - 96, texto: texto.trim() });
    }
  }

  return numeradas.sort((x, y) => x.ordem - y.ordem).map((n) => n.texto);
}

/**
 * Lê o gabarito.
 *
 * Aceita número (`2`), letra (`B`), vários (`1,3` ou `A;C`) e, para V/F, a
 * palavra (`verdadeiro`). Quem preenche escreve das quatro formas, e recusar
 * uma delas transformaria a convenção da planilha em erro de importação.
 *
 * Devolve índices começando em ZERO.
 */
export function parseGabarito(texto: string, totalAlternativas: number): number[] {
  const limpo = texto.trim();
  if (limpo === "") return [];

  const partes = limpo
    .split(/[,;/|]+|\s+e\s+/i)
    .map((p) => p.trim())
    .filter((p) => p !== "");

  const indices = new Set<number>();

  for (const parte of partes) {
    const k = chave(parte);

    /* V/F pela palavra: `verdadeiro` é a alternativa 1, `falso` a 2 — a ordem
       em que o produto as cria. */
    if (k === "verdadeiro" || k === "v" || k === "true" || k === "sim") {
      indices.add(0);
      continue;
    }
    if (k === "falso" || k === "f" || k === "false" || k === "nao") {
      indices.add(1);
      continue;
    }

    if (/^\d+$/.test(parte)) {
      /* A planilha conta a partir de 1: é o que a pessoa vê na coluna. */
      const numero = Number(parte) - 1;
      if (numero >= 0 && numero < totalAlternativas) indices.add(numero);
      continue;
    }

    if (/^[a-zA-Z]$/.test(parte)) {
      const letra = parte.toLowerCase().charCodeAt(0) - 97;
      if (letra >= 0 && letra < totalAlternativas) indices.add(letra);
    }
  }

  return [...indices].sort((a, b) => a - b);
}

export interface QuestaoImportada {
  linha: number;
  tipo: QuestionKind;
  enunciado: string;
  pontos: number;
  explicacao: string | null;
  categoria: string | null;
  alternativas: Array<{ texto: string; correta: boolean }>;
  situacao: "criar" | "erro";
  erro?: string;
}

export interface PlanoQuestoes {
  linhas: QuestaoImportada[];
  criar: number;
  erros: number;
}

/**
 * Monta o plano: o que aconteceria se esta planilha fosse importada.
 *
 * Não grava nada. A regra que mais recusa aqui é o gabarito: uma questão
 * objetiva sem alternativa correta vale zero para todo mundo que responder, e
 * importá-la em silêncio estragaria a prova sem ninguém perceber até a
 * correção.
 */
export function planQuestionsImport(linhas: Array<Record<string, string>>): PlanoQuestoes {
  const resultado: QuestaoImportada[] = [];

  linhas.forEach((linha, indice) => {
    const numero = indice + 2;

    const enunciado = valor(linha, COLUNAS.enunciado).trim();
    const tipoBruto = valor(linha, COLUNAS.tipo).trim();
    const pontosBruto = valor(linha, COLUNAS.pontos).trim();
    const explicacao = valor(linha, COLUNAS.explicacao).trim();
    const categoria = valor(linha, COLUNAS.categoria).trim();
    const gabaritoBruto = valor(linha, COLUNAS.correta).trim();

    if (enunciado === "" && tipoBruto === "") return;

    const base = {
      linha: numero,
      enunciado,
      explicacao: explicacao === "" ? null : explicacao,
      categoria: categoria === "" ? null : categoria,
    };

    const recusa = (erro: string, tipo: QuestionKind = "single_choice"): void => {
      resultado.push({
        ...base,
        tipo,
        pontos: 1,
        alternativas: [],
        situacao: "erro",
        erro,
      });
    };

    if (enunciado === "") {
      recusa("Sem enunciado.");
      return;
    }

    /* Sem tipo declarado, é escolha única: é a questão mais comum de uma prova,
       e é o que a maioria das planilhas traz sem dizer. */
    let tipo: QuestionKind = "single_choice";
    if (tipoBruto !== "") {
      const encontrado = TIPOS[chave(tipoBruto)];
      if (!encontrado) {
        recusa(
          `Tipo "${tipoBruto}" não existe. Use única, múltipla, V/F ou dissertativa.`,
        );
        return;
      }
      tipo = encontrado;
    }

    let pontos = 1;
    if (pontosBruto !== "") {
      /* Vírgula decimal: a planilha em pt-BR escreve `2,5`. */
      const numeroPontos = Number(pontosBruto.replace(",", "."));
      if (!Number.isFinite(numeroPontos) || numeroPontos <= 0) {
        recusa(`Pontuação "${pontosBruto}" não é um número maior que zero.`, tipo);
        return;
      }
      pontos = numeroPontos;
    }

    /* Dissertativa não tem alternativa nem gabarito: quem corrige é uma
       pessoa. Exigir gabarito aqui recusaria a questão pelo que ela é. */
    if (tipo === "essay") {
      resultado.push({ ...base, tipo, pontos, alternativas: [], situacao: "criar" });
      return;
    }

    /* V/F já sabe quais são as alternativas — pedir que a planilha as escreva
       seria trabalho para repetir sempre as mesmas duas palavras. */
    const textos = tipo === "true_false" ? ["Verdadeiro", "Falso"] : alternativasDe(linha);

    if (textos.length < 2) {
      recusa("Menos de duas alternativas. Preencha Alternativa 1, Alternativa 2…", tipo);
      return;
    }

    const corretas = parseGabarito(gabaritoBruto, textos.length);

    if (corretas.length === 0) {
      recusa(
        gabaritoBruto === ""
          ? "Sem gabarito. Diga qual alternativa é a correta."
          : `Gabarito "${gabaritoBruto}" não aponta para nenhuma alternativa.`,
        tipo,
      );
      return;
    }

    /* Escolha única com dois gabaritos é contradição, não detalhe: ou a
       pergunta é de múltipla resposta, ou o gabarito está errado. Adivinhar
       qual das duas mudaria a nota de quem responder. */
    if (tipo !== "multiple_choice" && corretas.length > 1) {
      recusa(
        `Gabarito com ${corretas.length} respostas numa questão de escolha única. Use o tipo "múltipla" se há mais de uma certa.`,
        tipo,
      );
      return;
    }

    resultado.push({
      ...base,
      tipo,
      pontos,
      alternativas: textos.map((texto, i) => ({ texto, correta: corretas.includes(i) })),
      situacao: "criar",
    });
  });

  return {
    linhas: resultado,
    criar: resultado.filter((l) => l.situacao === "criar").length,
    erros: resultado.filter((l) => l.situacao === "erro").length,
  };
}

/** O modelo que a tela oferece para baixar. */
export const MODELO_QUESTOES = {
  headers: [
    "Tipo",
    "Enunciado",
    "Pontos",
    "Alternativa 1",
    "Alternativa 2",
    "Alternativa 3",
    "Alternativa 4",
    "Correta",
    "Explicacao",
    "Categoria",
  ],
  exemplo: [
    [
      "unica",
      "Qual é o principal indicador de perda de água numa rede?",
      "1",
      "Índice de perdas por ligação",
      "Número de reclamações",
      "Pressão média da rede",
      "Extensão da rede",
      "1",
      "O índice por ligação permite comparar redes de tamanhos diferentes.",
      "Operação",
    ],
    [
      "multipla",
      "Quais fazem parte do tratamento convencional?",
      "2",
      "Coagulação",
      "Floculação",
      "Osmose reversa",
      "Decantação",
      "1,2,4",
      "Osmose reversa é tratamento avançado, não convencional.",
      "Tratamento",
    ],
    [
      "vf",
      "O esgoto tratado pode ser devolvido ao corpo hídrico.",
      "1",
      "",
      "",
      "",
      "",
      "verdadeiro",
      "Desde que dentro dos padrões de lançamento.",
      "Esgoto",
    ],
    [
      "dissertativa",
      "Explique a relação entre saneamento e indicadores de saúde.",
      "3",
      "",
      "",
      "",
      "",
      "",
      "",
      "Saúde pública",
    ],
  ],
};
