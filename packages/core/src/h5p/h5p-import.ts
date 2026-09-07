/**
 * Importação de pacote `.h5p` — o conteúdo, não a biblioteca.
 *
 * POR QUE IMPORTAR E NÃO EXECUTAR
 *
 * Um `.h5p` é um ZIP com dois arquivos que importam: `h5p.json`, que diz o
 * tipo, e `content/content.json`, com as perguntas, respostas e mídia. Nosso
 * leitor de ZIP já abre isso.
 *
 * O que não dá para trazer junto é o CÓDIGO. Cada tipo de H5P embute o próprio
 * JavaScript de renderização, e ele é GPL — executá-lo significaria distribuir
 * a biblioteca junto, e a proposta exclui licença de terceiro do escopo.
 *
 * Então o pacote é LIDO e CONVERTIDO para o player próprio, que já existe. O
 * acervo do cliente vem; o motor do H5P, não.
 *
 * O QUE ISSO CUSTA, E ESTÁ DECLARADO
 *
 * Só os tipos com equivalente aqui são convertidos — vídeo interativo, imagem
 * com pontos e cartões. Os outros quarenta e tantos são RECUSADOS pelo nome,
 * com o tipo na mensagem: quem exportou precisa saber o que ficou de fora, e
 * "não suportado" sem dizer o quê manda a pessoa abrir o arquivo para
 * descobrir.
 *
 * A APARÊNCIA NÃO VEM. O H5P traz estilos e comportamentos próprios de cada
 * tipo, e o player daqui tem os seus. O que atravessa é o conteúdo: pergunta,
 * alternativas, gabarito, o instante do vídeo, a posição do ponto.
 */

import type { InteractiveKind } from "../interactive/interactive.ts";

/** Os tipos de H5P que têm equivalente no player próprio. */
const EQUIVALENTES: Record<string, InteractiveKind> = {
  "H5P.InteractiveVideo": "interactive_video",
  "H5P.ImageHotspots": "image_hotspots",
  "H5P.Flashcards": "flashcards",
  "H5P.Dialogcards": "flashcards",
};

/**
 * Tipos que existem no H5P e não têm equivalente.
 *
 * A lista não é exaustiva — são mais de cinquenta — e não precisa ser: o que
 * não está em nenhum dos dois mapas recebe uma mensagem genérica com o nome do
 * tipo. Esta lista existe para dar um nome em português aos mais comuns, que é
 * o que quem exportou reconhece.
 */
const CONHECIDOS: Record<string, string> = {
  "H5P.DragQuestion": "arrastar e soltar",
  "H5P.DragText": "arrastar palavras",
  "H5P.Blanks": "preencher lacunas",
  "H5P.MarkTheWords": "marcar palavras",
  "H5P.MemoryGame": "jogo da memória",
  "H5P.Timeline": "linha do tempo",
  "H5P.CoursePresentation": "apresentação",
  "H5P.QuestionSet": "conjunto de questões",
  "H5P.Accordion": "sanfona",
  "H5P.Summary": "resumo",
  "H5P.Essay": "redação",
  "H5P.Chart": "gráfico",
  "H5P.Audio": "áudio",
  "H5P.BranchingScenario": "cenário ramificado",
};

/** O nome do tipo, sem a versão: `H5P.Flashcards 1.5` → `H5P.Flashcards`. */
export function nomeDoTipo(mainLibrary: string): string {
  return mainLibrary.trim().split(/\s+/)[0] ?? "";
}

export function equivalenteDe(mainLibrary: string): InteractiveKind | null {
  return EQUIVALENTES[nomeDoTipo(mainLibrary)] ?? null;
}

export function nomeLegivel(mainLibrary: string): string {
  const tipo = nomeDoTipo(mainLibrary);
  return CONHECIDOS[tipo] ?? tipo.replace(/^H5P\./, "");
}

export interface ItemImportado {
  position: number;
  atSeconds: number | null;
  xPercent: number | null;
  yPercent: number | null;
  prompt: string;
  body: string | null;
  blocking: boolean;
  options: Array<{ text: string; correct: boolean; feedback: string | null }>;
}

export interface ConteudoImportado {
  kind: InteractiveKind;
  title: string;
  items: ItemImportado[];
  /** O que o pacote traz e não atravessa. */
  avisos: string[];
}

export type ImportResult =
  | { ok: true; conteudo: ConteudoImportado }
  | { ok: false; error: string };

/** Tira o HTML que o H5P põe em todo campo de texto. */
function texto(valor: unknown): string {
  if (typeof valor !== "string") return "";

  return valor
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function comoLista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function comoObjeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

/**
 * Cartões: `H5P.Flashcards` e `H5P.Dialogcards`.
 *
 * Os dois guardam a mesma coisa com nomes diferentes — `text`/`answer` num,
 * `text`/`answer` no outro, com `tip` opcional. É o tipo que atravessa melhor:
 * um cartão é uma pergunta e uma resposta, e isso não depende de motor nenhum.
 */
function converterCartoes(content: Record<string, unknown>): ItemImportado[] {
  const cartoes = [...comoLista(content["cards"]), ...comoLista(content["dialogs"])];

  return cartoes
    .map((bruto, i): ItemImportado | null => {
      const cartao = comoObjeto(bruto);

      const frente = texto(cartao["text"]) || texto(cartao["question"]);
      const verso = texto(cartao["answer"]) || texto(cartao["tip"]);

      if (!frente) return null;

      return {
        position: i,
        atSeconds: null,
        xPercent: null,
        yPercent: null,
        prompt: frente,
        body: verso || null,
        blocking: false,
        /* Cartão não tem alternativa: quem estuda vira e confere sozinho. O
           player trata a lista vazia como "reconhecido". */
        options: [],
      };
    })
    .filter((x): x is ItemImportado => x !== null);
}

/**
 * Imagem com pontos: `H5P.ImageHotspots`.
 *
 * A posição vem em percentual no próprio pacote, e é o que o player daqui
 * usa — os dois medem a partir do canto superior esquerdo.
 */
function converterPontos(content: Record<string, unknown>): ItemImportado[] {
  return comoLista(content["hotspots"])
    .map((bruto, i): ItemImportado | null => {
      const ponto = comoObjeto(bruto);
      const posicao = comoObjeto(ponto["position"]);

      const x = Number(posicao["x"]);
      const y = Number(posicao["y"]);

      /* Ponto sem posição não tem onde ser desenhado. */
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      const acoes = comoLista(ponto["action"]);
      const primeira = comoObjeto(acoes[0]);
      const params = comoObjeto(primeira["params"]);

      const titulo = texto(ponto["header"]) || texto(params["text"]);
      if (!titulo) return null;

      return {
        position: i,
        atSeconds: null,
        xPercent: Math.max(0, Math.min(100, x)),
        yPercent: Math.max(0, Math.min(100, y)),
        prompt: titulo,
        body: texto(params["text"]) !== titulo ? texto(params["text"]) || null : null,
        blocking: false,
        options: [],
      };
    })
    .filter((x): x is ItemImportado => x !== null);
}

/**
 * Vídeo interativo: `H5P.InteractiveVideo`.
 *
 * O mais valioso e o mais parcial dos três. As perguntas ficam em
 * `interactiveVideo.assets.interactions`, cada uma com o segundo em que
 * aparece — e é exatamente o que o player daqui precisa.
 *
 * SÓ AS PERGUNTAS DE MÚLTIPLA ESCOLHA ATRAVESSAM. Uma interação do H5P pode
 * ser texto, imagem, link, tabela ou outro tipo inteiro embutido; o player
 * daqui pergunta e corrige. As demais são contadas e reportadas, não
 * convertidas em algo que elas não são.
 *
 * O VÍDEO EM SI NÃO VEM. O pacote referencia um arquivo interno ou um link do
 * YouTube, e nenhum dos dois é a mídia da plataforma — quem importa aponta o
 * vídeo depois. As perguntas chegam com o instante certo, que é o trabalho
 * que ninguém quer refazer à mão.
 */
function converterVideo(content: Record<string, unknown>): {
  itens: ItemImportado[];
  ignoradas: number;
} {
  const video = comoObjeto(content["interactiveVideo"]);
  const assets = comoObjeto(video["assets"]);
  const interacoes = comoLista(assets["interactions"]);

  const itens: ItemImportado[] = [];
  let ignoradas = 0;

  for (const bruto of interacoes) {
    const interacao = comoObjeto(bruto);
    const action = comoObjeto(interacao["action"]);
    const params = comoObjeto(action["params"]);

    const biblioteca = nomeDoTipo(String(action["library"] ?? ""));

    /* `H5P.MultiChoice` é a pergunta de alternativas; `H5P.TrueFalse` é o
       caso particular dela com duas. As duas viram pergunta aqui. */
    if (biblioteca !== "H5P.MultiChoice" && biblioteca !== "H5P.TrueFalse") {
      ignoradas += 1;
      continue;
    }

    const enunciado = texto(params["question"]);
    if (!enunciado) {
      ignoradas += 1;
      continue;
    }

    const inicio = Number(interacao["duration"] ? comoObjeto(interacao["duration"])["from"] : NaN);

    const opcoes =
      biblioteca === "H5P.TrueFalse"
        ? [
            { text: "Verdadeiro", correct: params["correct"] === "true", feedback: null },
            { text: "Falso", correct: params["correct"] !== "true", feedback: null },
          ]
        : comoLista(params["answers"])
            .map((a) => {
              const alternativa = comoObjeto(a);
              const rotulo = texto(alternativa["text"]);
              if (!rotulo) return null;

              return {
                text: rotulo,
                correct: alternativa["correct"] === true,
                feedback: texto(comoObjeto(alternativa["tipsAndFeedback"])["chosenFeedback"]) || null,
              };
            })
            .filter((x): x is { text: string; correct: boolean; feedback: string | null } => x !== null);

    /* Pergunta objetiva sem gabarito vale zero para todo mundo que responder.
       A mesma regra da importação de questões e do QTI. */
    if (opcoes.length >= 2 && !opcoes.some((o) => o.correct)) {
      ignoradas += 1;
      continue;
    }

    itens.push({
      position: itens.length,
      atSeconds: Number.isFinite(inicio) ? Math.max(0, Math.round(inicio)) : null,
      xPercent: null,
      yPercent: null,
      prompt: enunciado,
      body: null,
      /* O H5P chama de `pause`: a pergunta trava o vídeo até ser respondida. */
      blocking: interacao["pause"] === true,
      options: opcoes,
    });
  }

  return { itens, ignoradas };
}

/**
 * Lê um pacote `.h5p` já descompactado.
 *
 * `h5pJson` é o manifesto e `contentJson` é o conteúdo — os dois arquivos que
 * importam. Recebe texto e não o ZIP porque quem abre o pacote é o backend, com
 * o leitor que já existe para o SCORM.
 */
export function importarH5p(h5pJson: string, contentJson: string): ImportResult {
  let manifesto: Record<string, unknown>;
  let content: Record<string, unknown>;

  try {
    manifesto = comoObjeto(JSON.parse(h5pJson));
    content = comoObjeto(JSON.parse(contentJson));
  } catch {
    return { ok: false, error: "O pacote tem JSON inválido." };
  }

  const biblioteca = String(manifesto["mainLibrary"] ?? "");
  if (!biblioteca) {
    return { ok: false, error: "O pacote não declara o tipo de conteúdo." };
  }

  const kind = equivalenteDe(biblioteca);

  if (!kind) {
    /* O tipo VAI na mensagem. "Não suportado" sem dizer o quê manda a pessoa
       abrir o arquivo para descobrir o que ficou de fora. */
    return {
      ok: false,
      error: `Conteúdo do tipo "${nomeLegivel(biblioteca)}" não tem equivalente na plataforma.`,
    };
  }

  const titulo = texto(manifesto["title"]) || "Conteúdo importado";
  const avisos: string[] = [];

  let items: ItemImportado[];

  if (kind === "interactive_video") {
    const { itens, ignoradas } = converterVideo(content);
    items = itens;

    if (ignoradas > 0) {
      avisos.push(
        `${ignoradas} ${ignoradas === 1 ? "interação foi ignorada" : "interações foram ignoradas"}: ` +
          "só perguntas de múltipla escolha atravessam.",
      );
    }

    avisos.push("O vídeo não vem no pacote: as perguntas chegam posicionadas no instante certo.");
  } else if (kind === "image_hotspots") {
    items = converterPontos(content);
    avisos.push("A imagem não vem no pacote: os pontos chegam nas posições certas.");
  } else {
    items = converterCartoes(content);
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: "O pacote não tem nenhum item que a plataforma saiba representar.",
    };
  }

  /* A aparência não atravessa, e dizer isso é honestidade sobre o que a
     importação faz: o conteúdo vem, o visual é o do player daqui. */
  avisos.push("A aparência é a do player da plataforma, não a do H5P.");

  return { ok: true, conteudo: { kind, title: titulo, items, avisos } };
}
