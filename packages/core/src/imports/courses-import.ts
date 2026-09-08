import type { ContentKind } from "../courses/content.ts";

/**
 * Importação de cursos e conteúdo — F5-05 (guia §24).
 *
 * O problema do formato: um curso é uma ÁRVORE — curso, módulos, aulas — e CSV
 * é uma tabela plana. A saída é uma coluna `Tipo` que diz o que a linha é, e a
 * hierarquia vem da ORDEM: cada módulo pertence ao curso acima dele, cada aula
 * ao módulo acima dela.
 *
 * É como se lê um sumário, e é o que uma pessoa consegue montar no Excel sem
 * inventar identificador. A alternativa — uma coluna "id do pai" preenchida à
 * mão — erra na primeira linha inserida no meio.
 */

/** O que uma linha pode ser. */
const TIPOS_LINHA: Record<string, "curso" | "modulo" | "aula"> = {
  curso: "curso",
  course: "curso",
  treinamento: "curso",

  modulo: "modulo",
  module: "modulo",
  unidade: "modulo",
  capitulo: "modulo",

  aula: "aula",
  lesson: "aula",
  licao: "aula",
  topico: "aula",
  video: "aula",
};

/**
 * Como a planilha escreve o formato, e o `ContentKind` correspondente.
 *
 * O VALOR é o tipo do produto — `ContentKind`, o mesmo que o CHECK de `lessons`
 * aceita. Inventar um nome aqui ("external" em vez de "link") passa pelo
 * TypeScript, passa pela conferência, e só estoura no INSERT, no meio de uma
 * importação que já criou metade das aulas.
 *
 * As CHAVES são livres porque são o que a pessoa digita: "powerpoint" e
 * "apresentação" são a mesma coisa para quem preenche.
 */
const TIPOS_AULA: Record<string, ContentKind> = {
  video: "video",
  aula: "video",

  documento: "document",
  document: "document",
  doc: "document",

  pdf: "pdf",

  slide: "slides",
  slides: "slides",
  powerpoint: "slides",
  apresentacao: "slides",
  ppt: "slides",

  planilha: "spreadsheet",
  excel: "spreadsheet",

  imagem: "image",
  image: "image",
  figura: "image",

  audio: "audio",
  podcast: "audio",

  texto: "text",
  text: "text",
  leitura: "text",

  link: "link",
  externo: "link",
  external: "link",
  url: "link",
};

/**
 * Os `ContentKind` que este leitor pode produzir.
 *
 * Existe para o teste poder conferir, um a um, que cada saída é um tipo que o
 * banco aceita.
 */
export const FORMATOS_ACEITOS: ContentKind[] = [...new Set(Object.values(TIPOS_AULA))];

function chave(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

const COLUNAS = {
  tipo: ["tipo", "type", "nivel", "o"],
  titulo: ["titulo", "nome", "title", "name"],
  descricao: ["descricao", "resumo", "summary", "description", "conteudo", "texto"],
  duracao: ["duracao", "duracaominutos", "minutos", "tempo", "duration"],
  formato: ["formato", "tipodeaula", "midia", "format"],
  url: ["url", "link", "endereco", "arquivo"],
  paginas: ["paginas", "pages", "numerodepaginas", "slides"],
} as const;

function valor(linha: Record<string, string>, nomes: readonly string[]): string {
  for (const nome of nomes) {
    const encontrado = linha[nome];
    if (encontrado !== undefined && encontrado !== "") return encontrado;
  }
  return "";
}

export interface AulaImportada {
  titulo: string;
  /** Minutos declarados. Vira segundos na gravação. */
  duracaoMinutos: number;
  formato: ContentKind;
  /** Texto da aula, para formato `text`. */
  texto: string | null;
  /** Endereço, para `external` e `document`. */
  url: string | null;
  /** Páginas do documento — é o que mede "passou pelo material inteiro". */
  paginas: number | null;
  linha: number;
}

export interface ModuloImportado {
  titulo: string;
  aulas: AulaImportada[];
  linha: number;
}

export interface CursoImportado {
  titulo: string;
  resumo: string;
  modulos: ModuloImportado[];
  linha: number;
}

export interface ErroDeLinha {
  linha: number;
  mensagem: string;
}

export interface PlanoCursos {
  cursos: CursoImportado[];
  erros: ErroDeLinha[];
  /** Totais, para a tela resumir sem recontar. */
  totalModulos: number;
  totalAulas: number;
}

/**
 * Monta a árvore a partir das linhas.
 *
 * Não grava nada. Os erros são por LINHA e citam o número que a pessoa vê no
 * Excel — uma planilha de curso tem dezenas de linhas, e "erro na importação"
 * sem dizer onde obriga a conferir todas.
 */
export function planCoursesImport(linhas: Array<Record<string, string>>): PlanoCursos {
  const cursos: CursoImportado[] = [];
  const erros: ErroDeLinha[] = [];

  /* Onde estamos na árvore. Uma aula sem módulo antes dela não tem onde
     entrar, e é o erro mais comum de quem monta a planilha na mão. */
  let cursoAtual: CursoImportado | null = null;
  let moduloAtual: ModuloImportado | null = null;

  linhas.forEach((linha, indice) => {
    const numero = indice + 2;

    const tipoBruto = valor(linha, COLUNAS.tipo).trim();
    const titulo = valor(linha, COLUNAS.titulo).trim();

    if (tipoBruto === "" && titulo === "") return;

    if (tipoBruto === "") {
      erros.push({ linha: numero, mensagem: "Sem tipo. Diga se é curso, módulo ou aula." });
      return;
    }

    const tipo = TIPOS_LINHA[chave(tipoBruto)];
    if (!tipo) {
      erros.push({
        linha: numero,
        mensagem: `Tipo "${tipoBruto}" não existe. Use curso, módulo ou aula.`,
      });
      return;
    }

    if (titulo === "") {
      erros.push({ linha: numero, mensagem: `${tipo} sem título.` });
      return;
    }

    if (tipo === "curso") {
      cursoAtual = {
        titulo,
        resumo: valor(linha, COLUNAS.descricao).trim(),
        modulos: [],
        linha: numero,
      };
      cursos.push(cursoAtual);
      /* Curso novo zera o módulo: sem isto, a primeira aula do segundo curso
         cairia no último módulo do primeiro. */
      moduloAtual = null;
      return;
    }

    if (tipo === "modulo") {
      if (!cursoAtual) {
        erros.push({
          linha: numero,
          mensagem: "Módulo antes de qualquer curso. Comece a planilha por uma linha de curso.",
        });
        return;
      }

      moduloAtual = { titulo, aulas: [], linha: numero };
      cursoAtual.modulos.push(moduloAtual);
      return;
    }

    /* Aula. */
    if (!moduloAtual) {
      erros.push({
        linha: numero,
        mensagem: cursoAtual
          ? "Aula antes de qualquer módulo. Toda aula pertence a um módulo."
          : "Aula antes de qualquer curso.",
      });
      return;
    }

    const formatoBruto = valor(linha, COLUNAS.formato).trim();
    let formato: ContentKind = "video";

    if (formatoBruto !== "") {
      const encontrado = TIPOS_AULA[chave(formatoBruto)];
      if (!encontrado) {
        erros.push({
          linha: numero,
          mensagem: `Formato "${formatoBruto}" não existe. Use vídeo, documento, PDF, slides, texto ou link.`,
        });
        return;
      }
      formato = encontrado;
    }

    const duracaoBruta = valor(linha, COLUNAS.duracao).trim();
    let duracaoMinutos = 0;

    if (duracaoBruta !== "") {
      const numeroDuracao = Number(duracaoBruta.replace(",", "."));
      if (!Number.isFinite(numeroDuracao) || numeroDuracao < 0) {
        erros.push({
          linha: numero,
          mensagem: `Duração "${duracaoBruta}" não é um número de minutos.`,
        });
        return;
      }
      duracaoMinutos = numeroDuracao;
    }

    const paginasBrutas = valor(linha, COLUNAS.paginas).trim();
    const paginas = paginasBrutas === "" ? null : Number(paginasBrutas.replace(",", "."));

    const url = valor(linha, COLUNAS.url).trim();
    const descricao = valor(linha, COLUNAS.descricao).trim();

    /* Link sem endereço não abre nada. É o único formato em que a ausência do
       endereço torna a aula inútil: vídeo e documento podem ser anexados
       depois pela tela do curso, mas um "link" sem link é só um título. */
    if (formato === "link" && url === "") {
      erros.push({ linha: numero, mensagem: "Aula de link sem endereço." });
      return;
    }

    moduloAtual.aulas.push({
      titulo,
      duracaoMinutos,
      formato,
      texto: formato === "text" && descricao !== "" ? descricao : null,
      url: url === "" ? null : url,
      paginas: paginas !== null && Number.isFinite(paginas) && paginas > 0 ? paginas : null,
      linha: numero,
    });
  });

  /* Curso sem aula nenhuma não é curso: quem se matricular abre uma casca
     vazia. É melhor recusar aqui do que publicar isso. */
  for (const curso of cursos) {
    const aulas = curso.modulos.reduce((soma, modulo) => soma + modulo.aulas.length, 0);
    if (aulas === 0) {
      erros.push({
        linha: curso.linha,
        mensagem: `O curso "${curso.titulo}" não tem nenhuma aula.`,
      });
    }
  }

  const validos = cursos.filter((curso) =>
    curso.modulos.some((modulo) => modulo.aulas.length > 0),
  );

  return {
    cursos: validos,
    erros,
    totalModulos: validos.reduce((soma, curso) => soma + curso.modulos.length, 0),
    totalAulas: validos.reduce(
      (soma, curso) =>
        soma + curso.modulos.reduce((parcial, modulo) => parcial + modulo.aulas.length, 0),
      0,
    ),
  };
}

/* O slug NÃO é gerado aqui.
 *
 * `courses/slug.ts` já resolve isso, e — mais importante — resolve a COLISÃO:
 * dois cursos com o mesmo título precisam de slugs diferentes, e a coluna é
 * única por cliente. Uma cópia daquela função aqui passaria a divergir dela na
 * primeira correção, e o sintoma seria uma importação falhando por chave
 * duplicada num lugar que não menciona slug nenhum.
 */

/** O modelo que a tela oferece para baixar. */
export const MODELO_CURSOS = {
  headers: ["Tipo", "Titulo", "Descricao", "Formato", "Duracao", "URL", "Paginas"],
  exemplo: [
    ["curso", "Segurança para Quem Desenvolve", "As falhas que aparecem em auditoria, do lado de quem escreve o código.", "", "", "", ""],
    ["modulo", "Fundamentos", "", "", "", "", ""],
    ["aula", "O que é injeção de SQL", "", "video", "12", "", ""],
    ["aula", "Riscos atmosféricos", "", "video", "18", "", ""],
    ["modulo", "Procedimentos", "", "", "", "", ""],
    ["aula", "Permissão de entrada e trabalho", "", "documento", "20", "", "24"],
    ["aula", "Norma NR-33 na íntegra", "", "link", "0", "https://exemplo.gov.br/nr-33", ""],
  ],
};
