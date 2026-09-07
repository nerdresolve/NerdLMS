/**
 * Leitura de CSV — F5-05.
 *
 * O inverso de `reports/csv.ts`. Mora à parte de propósito: escrever CSV é
 * formatar dado que já é confiável; ler CSV é receber um arquivo que alguém
 * montou no Excel, com as surpresas que isso traz — aspas no meio do texto,
 * quebra de linha dentro da célula, separador trocado, BOM na frente.
 *
 * Sem biblioteca, como o resto do produto: a proposta exclui licenças de
 * terceiros, e o que não é trivial aqui — aspas e quebra dentro da célula — é
 * justamente o que uma varredura por `split(",")` erraria.
 */

/**
 * Os separadores que aceitamos, na ordem em que se tenta.
 *
 * Ponto e vírgula primeiro: é o que o Excel em pt-BR gera, e é o que este
 * produto exporta. Mas quem monta a planilha pode ter usado vírgula — recusar
 * o arquivo por causa disso seria fazer a pessoa descobrir sozinha o motivo.
 */
const SEPARADORES = [";", ",", "\t"] as const;

/**
 * Descobre o separador olhando a primeira linha.
 *
 * Conta fora das aspas: um cabeçalho como `"Nome, completo";Email` tem uma
 * vírgula que não separa nada, e contá-la escolheria o separador errado.
 */
export function detectDelimiter(texto: string): string {
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? "";

  let melhor = SEPARADORES[0] as string;
  let maior = 0;

  for (const candidato of SEPARADORES) {
    let contagem = 0;
    let dentroDeAspas = false;

    for (let i = 0; i < primeiraLinha.length; i += 1) {
      const char = primeiraLinha[i];
      if (char === '"') dentroDeAspas = !dentroDeAspas;
      else if (char === candidato && !dentroDeAspas) contagem += 1;
    }

    if (contagem > maior) {
      maior = contagem;
      melhor = candidato;
    }
  }

  return melhor;
}

/**
 * Quebra o texto em linhas de células.
 *
 * Um autômato de dois estados — dentro e fora de aspas — porque é a única
 * forma de respeitar uma célula como `"Rua A, 100\nSala 2"`, que tem separador
 * e quebra de linha DENTRO do valor. Dividir por linha e depois por separador
 * partiria essa célula em três.
 */
export function parseCsv(texto: string, delimitador?: string): string[][] {
  /* O BOM que nós mesmos escrevemos na exportação volta como caractere e
     grudaria na primeira coluna do cabeçalho: `﻿Nome` nunca casaria com
     `Nome`. Um arquivo exportado daqui tem de poder ser reimportado aqui. */
  const limpo = texto.replace(/^﻿/, "");
  const sep = delimitador ?? detectDelimiter(limpo);

  const linhas: string[][] = [];
  let celulas: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  const fechaCelula = () => {
    celulas.push(atual);
    atual = "";
  };

  const fechaLinha = () => {
    fechaCelula();
    /* Linha em branco não vira registro: planilha quase sempre termina com uma,
       e ela viraria um usuário sem nome nem e-mail. */
    if (celulas.some((c) => c.trim() !== "")) linhas.push(celulas);
    celulas = [];
  };

  for (let i = 0; i < limpo.length; i += 1) {
    const char = limpo[i]!;

    if (dentroDeAspas) {
      if (char === '"') {
        /* Aspa dupla dentro de aspas é uma aspa literal — é como o próprio
           formato escapa a aspa. */
        if (limpo[i + 1] === '"') {
          atual += '"';
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += char;
      }
      continue;
    }

    if (char === '"') {
      dentroDeAspas = true;
    } else if (char === sep) {
      fechaCelula();
    } else if (char === "\n") {
      fechaLinha();
    } else if (char !== "\r") {
      atual += char;
    }
  }

  /* O que sobrou depois do último caractere: arquivo sem quebra no fim é
     comum, e sem isto a última linha se perderia em silêncio. */
  if (atual !== "" || celulas.length > 0) fechaLinha();

  return linhas;
}

/**
 * Normaliza um nome de coluna para comparação.
 *
 * Quem monta a planilha escreve "E-mail", "email", "E-Mail " ou "E‑MAIL". As
 * quatro são a mesma coluna, e exigir a grafia exata faria a importação falhar
 * por um acento.
 */
export function normalizeHeader(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

export interface ParsedTable {
  /** Cabeçalhos como vieram, para as mensagens de erro citarem o arquivo. */
  headers: string[];
  /** Cada linha como um mapa de coluna normalizada para valor. */
  rows: Array<Record<string, string>>;
}

/**
 * Lê o arquivo como tabela com cabeçalho.
 *
 * Devolve mapa por nome de coluna, e não posição: uma planilha com as colunas
 * em ordem diferente é a mesma planilha, e amarrar à posição transformaria
 * "trocaram duas colunas de lugar" em "importou tudo errado sem avisar".
 */
export function parseTable(texto: string, delimitador?: string): ParsedTable {
  const linhas = parseCsv(texto, delimitador);
  if (linhas.length === 0) return { headers: [], rows: [] };

  const headers = linhas[0]!.map((h) => h.trim());
  const chaves = headers.map(normalizeHeader);

  const rows = linhas.slice(1).map((linha) => {
    const registro: Record<string, string> = {};

    chaves.forEach((chave, indice) => {
      if (chave === "") return;
      registro[chave] = (linha[indice] ?? "").trim();
    });

    return registro;
  });

  return { headers, rows };
}
