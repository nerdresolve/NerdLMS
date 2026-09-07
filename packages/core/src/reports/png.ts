import { deflateSync, inflateSync } from "node:zlib";

/**
 * Leitura de PNG, o suficiente para pôr uma assinatura num PDF.
 *
 * POR QUE ISTO PRECISA EXISTIR
 *
 * O PDF não sabe ler PNG. Ele aceita imagem como um fluxo de amostras cruas —
 * para nós, RGB de 8 bits comprimido com Flate — e o PNG é outra coisa: além da
 * compressão, ele aplica um FILTRO por linha, que guarda cada byte como a
 * diferença em relação ao vizinho de cima ou da esquerda. Colar o conteúdo de
 * um PNG num XObject produz ruído colorido, não a imagem.
 *
 * A logo da marca não passa por aqui porque foi convertida uma vez, em tempo de
 * build, por uma ferramenta Python. A assinatura não pode: ela chega quando o
 * instrutor a envia, e converter em tempo de execução é a única opção.
 *
 * O QUE ESTE LEITOR NÃO FAZ
 *
 * Não trata PNG entrelaçado (Adam7), nem paleta, nem 16 bits por canal. Os três
 * existem, e nenhum aparece numa assinatura digitalizada — que sai do scanner
 * ou do celular como RGB ou cinza, com ou sem transparência. Cada um deles é
 * RECUSADO com mensagem própria, em vez de produzir uma imagem torta que só se
 * descobre quando o certificado já foi emitido.
 */

/** Os oito bytes que abrem todo PNG. */
const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Os tipos de cor do PNG que interessam aqui.
 *
 * 3 (paleta) e os de 16 bits ficam de fora — ver o cabeçalho.
 */
const COR = {
  CINZA: 0,
  RGB: 2,
  CINZA_ALFA: 4,
  RGBA: 6,
} as const;

/** Quantos canais cada tipo de cor guarda por pixel. */
const CANAIS: Record<number, number> = {
  [COR.CINZA]: 1,
  [COR.RGB]: 3,
  [COR.CINZA_ALFA]: 2,
  [COR.RGBA]: 4,
};

export interface ImagemParaPdf {
  width: number;
  height: number;
  /** RGB de 8 bits, comprimido com Flate, em base64 — o que o PDF espera. */
  data: string;
}

export type LeituraPng =
  | { ok: true; imagem: ImagemParaPdf }
  | { ok: false; erro: string };

/**
 * Converte um PNG no que o PDF consegue embutir.
 *
 * A TRANSPARÊNCIA É ACHATADA SOBRE BRANCO, e isso não é perda: uma assinatura
 * digitalizada é traço escuro sobre nada, e o lugar onde ela vai no certificado
 * é branco. Guardar o canal alfa exigiria uma máscara separada no PDF — mais
 * código para produzir exatamente o mesmo pixel.
 *
 * `limiteBytes` é o teto do que se aceita descomprimir. Sem ele, um PNG de
 * poucos quilobytes declarando 30000×30000 pixels faria este processo alocar
 * gigabytes e derrubar o servidor — é a "bomba de descompressão", e a defesa é
 * recusar pelo tamanho ANUNCIADO, antes de alocar.
 */
export function pngParaPdf(arquivo: Buffer, limiteBytes = 24 * 1024 * 1024): LeituraPng {
  if (arquivo.length < 8 || !arquivo.subarray(0, 8).equals(ASSINATURA)) {
    return { ok: false, erro: "O arquivo não é um PNG." };
  }

  const cabecalho = lerIhdr(arquivo);
  if (!cabecalho.ok) return cabecalho;

  const { width, height, bits, tipo, entrelacado } = cabecalho;

  if (entrelacado) {
    return { ok: false, erro: "PNG entrelaçado não é aceito. Salve sem entrelaçamento." };
  }
  if (bits !== 8) {
    return { ok: false, erro: "O PNG precisa ter 8 bits por canal." };
  }
  if (!(tipo in CANAIS)) {
    return {
      ok: false,
      erro: "PNG em paleta de cores não é aceito. Salve em RGB ou tons de cinza.",
    };
  }

  const canais = CANAIS[tipo]!;
  /* +1 por linha: o primeiro byte de cada uma diz qual filtro foi aplicado. */
  const esperado = height * (width * canais + 1);

  if (esperado > limiteBytes) {
    return { ok: false, erro: "A imagem é grande demais." };
  }

  const idat = juntarIdat(arquivo);
  if (!idat) return { ok: false, erro: "O PNG não tem dados de imagem." };

  let bruto: Buffer;
  try {
    bruto = inflateSync(idat, { maxOutputLength: esperado });
  } catch {
    return { ok: false, erro: "Não foi possível ler os dados do PNG." };
  }

  if (bruto.length < esperado) {
    return { ok: false, erro: "O PNG está incompleto." };
  }

  const rgb = desfiltrar(bruto, width, height, canais);

  return {
    ok: true,
    imagem: {
      width,
      height,
      data: deflateSync(rgb, { level: 9 }).toString("base64"),
    },
  };
}

interface Ihdr {
  ok: true;
  width: number;
  height: number;
  bits: number;
  tipo: number;
  entrelacado: boolean;
}

function lerIhdr(arquivo: Buffer): Ihdr | { ok: false; erro: string } {
  /* O IHDR é obrigatoriamente o primeiro pedaço, logo após a assinatura: 8 de
     assinatura + 4 de comprimento + 4 do nome = 16, e daí vêm os campos. */
  if (arquivo.length < 33 || arquivo.subarray(12, 16).toString("latin1") !== "IHDR") {
    return { ok: false, erro: "O PNG está corrompido." };
  }

  const width = arquivo.readUInt32BE(16);
  const height = arquivo.readUInt32BE(20);

  if (width === 0 || height === 0) {
    return { ok: false, erro: "O PNG tem dimensão zero." };
  }

  return {
    ok: true,
    width,
    height,
    bits: arquivo[24]!,
    tipo: arquivo[25]!,
    entrelacado: arquivo[28] !== 0,
  };
}

/**
 * Junta todos os pedaços `IDAT`.
 *
 * O PNG permite quebrar os dados em vários — e programas o fazem, por tamanho
 * de buffer. Ler só o primeiro devolve uma imagem cortada ao meio, sem erro
 * nenhum: o `inflate` até funciona, e a metade de baixo sai preta.
 */
function juntarIdat(arquivo: Buffer): Buffer | null {
  const partes: Buffer[] = [];
  let posicao = 8;

  while (posicao + 8 <= arquivo.length) {
    const tamanho = arquivo.readUInt32BE(posicao);
    const nome = arquivo.subarray(posicao + 4, posicao + 8).toString("latin1");
    const inicio = posicao + 8;

    if (inicio + tamanho > arquivo.length) break;

    if (nome === "IDAT") partes.push(arquivo.subarray(inicio, inicio + tamanho));
    if (nome === "IEND") break;

    /* +12: comprimento (4) + nome (4) + CRC (4). O CRC não é conferido: o
       arquivo chega por upload autenticado, e um byte trocado no meio faz o
       `inflate` falhar de qualquer forma. */
    posicao = inicio + tamanho + 4;
  }

  return partes.length > 0 ? Buffer.concat(partes) : null;
}

/**
 * Desfaz os filtros por linha e devolve RGB puro.
 *
 * Cada linha do PNG começa com um byte dizendo como ela foi codificada em
 * relação à linha de cima (`b`) e ao pixel da esquerda (`a`). São cinco modos,
 * e o PNG escolhe um POR LINHA — implementar só o modo 0 funciona em imagens
 * pequenas e falha em qualquer coisa que um programa de verdade tenha salvo.
 *
 * `Paeth` (modo 4) é o mais usado pelos codificadores: ele escolhe entre os
 * três vizinhos aquele cuja soma prevê melhor o valor.
 */
function desfiltrar(bruto: Buffer, width: number, height: number, canais: number): Buffer {
  const porLinha = width * canais;
  /* Linha anterior JÁ desfiltrada, que é o que os filtros referenciam. */
  let anterior = Buffer.alloc(porLinha);
  const atual = Buffer.alloc(porLinha);

  const saida = Buffer.alloc(width * height * 3);
  let escrita = 0;

  for (let linha = 0; linha < height; linha += 1) {
    const base = linha * (porLinha + 1);
    const filtro = bruto[base]!;
    bruto.copy(atual, 0, base + 1, base + 1 + porLinha);

    for (let i = 0; i < porLinha; i += 1) {
      const a = i >= canais ? atual[i - canais]! : 0;
      const b = anterior[i]!;
      const c = i >= canais ? anterior[i - canais]! : 0;
      const x = atual[i]!;

      let valor: number;
      switch (filtro) {
        case 0: valor = x; break;
        case 1: valor = x + a; break;
        case 2: valor = x + b; break;
        case 3: valor = x + ((a + b) >> 1); break;
        case 4: valor = x + paeth(a, b, c); break;
        /* Filtro desconhecido: trata como "nenhum" em vez de abortar. Uma
           linha estranha é melhor que um certificado que não sai. */
        default: valor = x;
      }

      atual[i] = valor & 0xff;
    }

    escrita = escreverRgb(atual, saida, escrita, width, canais);
    anterior = Buffer.from(atual);
  }

  return saida;
}

/** O preditor de Paeth, como o RFC 2083 o define. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Converte uma linha já desfiltrada para RGB, achatando o alfa sobre branco.
 *
 * A conta do achatamento é a de composição sobre fundo opaco:
 * `resultado = cor × alfa + branco × (1 − alfa)`. Ignorar o alfa e copiar só a
 * cor faria o fundo transparente virar PRETO — que numa assinatura é um
 * retângulo escuro cobrindo o certificado.
 */
function escreverRgb(
  linha: Buffer,
  saida: Buffer,
  escrita: number,
  width: number,
  canais: number,
): number {
  let posicao = escrita;

  for (let x = 0; x < width; x += 1) {
    const base = x * canais;
    let r: number;
    let g: number;
    let b: number;
    let alfa = 255;

    if (canais === 1) {
      r = g = b = linha[base]!;
    } else if (canais === 2) {
      r = g = b = linha[base]!;
      alfa = linha[base + 1]!;
    } else if (canais === 3) {
      r = linha[base]!;
      g = linha[base + 1]!;
      b = linha[base + 2]!;
    } else {
      r = linha[base]!;
      g = linha[base + 1]!;
      b = linha[base + 2]!;
      alfa = linha[base + 3]!;
    }

    if (alfa === 255) {
      saida[posicao] = r;
      saida[posicao + 1] = g;
      saida[posicao + 2] = b;
    } else {
      const t = alfa / 255;
      saida[posicao] = Math.round(r * t + 255 * (1 - t));
      saida[posicao + 1] = Math.round(g * t + 255 * (1 - t));
      saida[posicao + 2] = Math.round(b * t + 255 * (1 - t));
    }

    posicao += 3;
  }

  return posicao;
}
