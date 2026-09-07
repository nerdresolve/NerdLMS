/**
 * Geração de PDF mínima, sem dependência.
 *
 * A proposta exclui licenças de terceiros do escopo, e um certificado é uma
 * página com texto centralizado — não justifica arrastar uma biblioteca de
 * layout. O que existe aqui é o suficiente para isso e nada além: uma página,
 * fontes padrão, texto posicionado.
 *
 * Desenha texto, formas vetoriais com cor e imagem embutida. Forma vetorial
 * não é imagem: são operadores do próprio PDF (`re`, `m`, `c`, `f`), então
 * ondas e faixas saem nítidas em qualquer zoom e custam poucos bytes.
 *
 * Imagem entra como XObject com fluxo Flate — o mesmo algoritmo do PNG, então
 * os bytes de um PNG convertido para RGB passam direto, sem recompressão.
 *
 * **Limites conscientes:** sem fonte embutida e sem quebra automática de
 * linha. As fontes padrão do PDF (Helvetica) usam codificação WinAnsi, que
 * cobre o português — mas não caractere fora dela.
 *
 * Se um dia precisar de foto, assinatura digital ou texto fluindo em colunas,
 * a conversa passa a ser sobre biblioteca. Até lá, isto resolve sem
 * dependência e sem custo.
 */

export type PdfFont = "Helvetica" | "Helvetica-Bold";

export interface PdfText {
  text: string;
  /** Distância da borda esquerda, em pontos (72 por polegada). */
  x: number;
  /** Distância da borda INFERIOR — é a origem do PDF, não o topo. */
  y: number;
  size: number;
  font?: PdfFont;
  /** Preto quando ausente. */
  color?: PdfColor;
}

/**
 * Cor em RGB, cada canal de 0 a 1 — é a escala do PDF, não 0–255.
 *
 * `rgb("#7C3AED")` converte de hexadecimal, que é como a marca está escrita
 * nos tokens do Design System.
 */
export interface PdfColor {
  r: number;
  g: number;
  b: number;
}

export function rgb(hex: string): PdfColor {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

/** Retângulo preenchido. Usado para faixas e filetes. */
export interface PdfRect {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: PdfColor;
}

/**
 * Curva de Bézier fechada e preenchida — a onda da marca.
 *
 * `points` são pares de coordenadas: o primeiro é onde a linha começa, e os
 * demais vêm em trios (dois controles e um destino), como manda o operador
 * `c` do PDF.
 */
export interface PdfPath {
  kind: "path";
  start: [number, number];
  curves: Array<[number, number, number, number, number, number]>;
  /** Fecha a forma até estes pontos antes de preencher. */
  close: Array<[number, number]>;
  color: PdfColor;
  /** Quando presente, a forma é preenchida com degradê em vez de `color`. */
  gradient?: PdfGradient;
}

/**
 * Imagem embutida.
 *
 * `data` é RGB de 8 bits comprimido com Flate, em base64 — o formato que o
 * PDF consome sem conversão. `x`/`y` são o canto INFERIOR esquerdo, como todo
 * o resto do formato.
 */
export interface PdfImage {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Dimensões originais em pixels, para o PDF montar o XObject. */
  pixelWidth: number;
  pixelHeight: number;
  data: string;
}

/**
 * Gradiente linear entre duas cores, para preencher uma forma.
 *
 * O PDF resolve isto com um Shading (tipo 2, axial) mais uma função de
 * interpolação (tipo 2, exponencial). É mais verboso que uma cor sólida, mas
 * é o que separa uma massa chapada de uma que tem volume — e a referência do
 * certificado depende disso.
 */
export interface PdfGradient {
  from: PdfColor;
  to: PdfColor;
  /** Eixo do degradê, em coordenadas da página. */
  axis: [number, number, number, number];
}

/** Traço aberto, sem preenchimento: os fios claros dentro das ondas. */
export interface PdfStroke {
  kind: "stroke";
  start: [number, number];
  curves: Array<[number, number, number, number, number, number]>;
  color: PdfColor;
  width: number;
  /** 0–1. Fio de marca-d'água precisa quase sumir. */
  opacity?: number;
}

/** Pontos em grade — o ornamento discreto dos cantos. */
export interface PdfDots {
  kind: "dots";
  x: number;
  y: number;
  columns: number;
  rows: number;
  gap: number;
  radius: number;
  color: PdfColor;
}

/**
 * Forma vetorial a partir de um path no formato do SVG.
 *
 * Existe para o grafismo da marca (`@nerdlms/core/brand/mosaic.ts`) poder ser
 * desenhado no certificado com a MESMA geometria da tela. A alternativa era
 * embutir uma imagem do grafismo — que engordaria todo PDF emitido e sairia
 * borrada na impressão.
 *
 * Aceita só `M`, `L`, `C` e `Z` com coordenadas absolutas, que é exatamente o
 * que aquele módulo produz. O eixo Y é INVERTIDO na conversão: no SVG cresce
 * para baixo, no PDF para cima, e sem isso o desenho sai de cabeça para baixo.
 */
export interface PdfVector {
  kind: "vector";
  /** Path no formato do SVG, na caixa 0..`size` de cada eixo. */
  d: string;
  /** Canto INFERIOR esquerdo, em pontos da página. */
  x: number;
  y: number;
  /** Escala aplicada às coordenadas do path. */
  scale: number;
  /** Altura da caixa do path, para a inversão do eixo Y. */
  boxHeight: number;
  color: PdfColor;
  /** O anel do grafismo é um círculo com furo: precisa de `f*`. */
  evenOdd?: boolean;
}

export type PdfShape = PdfRect | PdfPath | PdfImage | PdfStroke | PdfDots | PdfVector;

/** A4 deitado, em pontos. O certificado é paisagem por convenção. */
export const A4_LANDSCAPE = { width: 842, height: 595 } as const;

/**
 * Escapa texto para um literal de string do PDF.
 *
 * Parênteses delimitam string no formato; um curso chamado "Água (potável)"
 * quebraria o arquivo inteiro sem isto.
 */
function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Converte para WinAnsi (cp1252), a codificação das fontes padrão.
 *
 * Acentos do português têm ponto de código diferente em UTF-8 e WinAnsi. Sem a
 * conversão, "conclusão" aparece como "conclusÃ£o" no leitor de PDF.
 */
function toWinAnsi(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 63;
    /* WinAnsi cobre até 0xFF com os mesmos pontos do Latin-1; acima disso, o
       caractere não existe na fonte padrão e vira "?". */
    out += code <= 0xff ? char : "?";
  }
  return out;
}

/** Largura aproximada de um texto, para centralizar. */
export function approximateWidth(text: string, size: number, bold = false): number {
  /* Helvetica tem largura variável; 0.5em por caractere é a média que erra
     pouco em texto latino, e centralizar com erro de poucos pontos é
     imperceptível. Medir de verdade exigiria a tabela de métricas da fonte. */
  return text.length * size * (bold ? 0.55 : 0.5);
}

/** Uma página: seu tamanho e o que há nela. */
export interface PdfPage {
  /** Tamanho em pontos. Ausente usa A4 deitado. */
  size?: { width: number; height: number };
  texts: PdfText[];
  shapes?: PdfShape[];
}

/**
 * Monta o PDF de UMA página.
 *
 * Mantém esta assinatura porque o certificado a usa, e ele é o documento que a
 * plataforma emite em produção. Por dentro delega para `buildPdfPages`.
 */
export function buildPdf(
  texts: PdfText[],
  page = A4_LANDSCAPE,
  shapes: PdfShape[] = [],
): Uint8Array {
  return buildPdfPages([{ size: page, texts, shapes }]);
}

/**
 * Monta o PDF de várias páginas.
 *
 * A estrutura é a mínima que um leitor aceita: catálogo, a árvore de páginas,
 * uma página com seu conteúdo para cada entrada, e duas fontes. A tabela xref
 * no fim é obrigatória — é por ela que o leitor encontra cada objeto.
 *
 * POR QUE OS RECURSOS SÃO COMPARTILHADOS
 *
 * Imagem, degradê e opacidade viram objetos próprios no arquivo, e cada página
 * precisa declará-los nos seus `Resources` para o content stream conseguir
 * invocá-los pelo nome. Reunir tudo numa lista só e declarar a mesma lista em
 * todas as páginas custa algumas referências repetidas e evita o erro que a
 * numeração por página convidaria: o `/Im0` da página 2 apontando para a
 * imagem da página 1, que o leitor aceita em silêncio e desenha errado.
 */
export function buildPdfPages(paginas: PdfPage[]): Uint8Array {
  if (paginas.length === 0) throw new Error("Um PDF precisa de ao menos uma página.");

  /* Recursos reunidos de TODAS as páginas, na ordem em que aparecem. É esta
     lista que dá o índice de cada nome (`/Im0`, `/Sh0`, `/GS0`). */
  const todas = paginas.flatMap((p) => p.shapes ?? []);

  const images = todas.filter((shape): shape is PdfImage => shape.kind === "image");

  const gradients = todas.filter(
    (shape): shape is PdfPath & { gradient: PdfGradient } =>
      shape.kind === "path" && shape.gradient !== undefined,
  );

  /* Opacidade também é objeto (ExtGState): o PDF não tem alfa inline. */
  const opacities = [
    ...new Set(
      todas
        .filter((shape): shape is PdfStroke => shape.kind === "stroke")
        .map((shape) => shape.opacity ?? 1)
        .filter((value) => value < 1),
    ),
  ];

  /* Objetos 1 e 2 são catálogo e árvore; 3 e 4, as fontes. Cada página ocupa
     dois: ela e o seu conteúdo. As imagens começam depois de todas elas. */
  const primeiraPagina = 5;
  const primeiraImagem = primeiraPagina + paginas.length * 2;
  const primeiroShading = primeiraImagem + images.length;
  const primeiroGState = primeiroShading + gradients.length * 2;

  /** Uma forma, em operadores do PDF. */
  function desenhar(shape: PdfShape): string {

    if (shape.kind === "image") {
      const nome = `/Im${images.indexOf(shape)}`;
      /* `cm` posiciona e escala: a matriz é [largura 0 0 altura x y], e o
         `q`/`Q` isola a transformação para não afetar o que vem depois. */
      return (
        `q ${shape.width} 0 0 ${shape.height} ${shape.x} ${shape.y} cm ${nome} Do Q`
      );
    }

    if (shape.kind === "dots") {
      /* Cada ponto é um círculo aproximado por quatro Béziers — o PDF não
         tem primitiva de círculo. `k` é a constante que faz a curva passar
         rente ao arco (4/3·(√2−1)). */
      const { r, g, b } = shape.color;
      const k = shape.radius * 0.5523;
      const circulos: string[] = [];

      for (let coluna = 0; coluna < shape.columns; coluna += 1) {
        for (let linha = 0; linha < shape.rows; linha += 1) {
          const cx = shape.x + coluna * shape.gap;
          const cy = shape.y + linha * shape.gap;
          const raio = shape.radius;
          circulos.push(
            `${cx - raio} ${cy} m ` +
              `${cx - raio} ${cy + k} ${cx - k} ${cy + raio} ${cx} ${cy + raio} c ` +
              `${cx + k} ${cy + raio} ${cx + raio} ${cy + k} ${cx + raio} ${cy} c ` +
              `${cx + raio} ${cy - k} ${cx + k} ${cy - raio} ${cx} ${cy - raio} c ` +
              `${cx - k} ${cy - raio} ${cx - raio} ${cy - k} ${cx - raio} ${cy} c f`,
          );
        }
      }
      return `${r} ${g} ${b} rg ${circulos.join(" ")}`;
    }

    if (shape.kind === "vector") {
      const { r, g, b } = shape.color;
      /* Os comandos do SVG e os do PDF são quase os mesmos operadores; o que
         muda é a ordem (posfixa) e o eixo Y. */
      const px = (valor: number) => (shape.x + valor * shape.scale).toFixed(3);
      const py = (valor: number) => (shape.y + (shape.boxHeight - valor) * shape.scale).toFixed(3);

      const ops: string[] = [];
      for (const trecho of shape.d.matchAll(/([MLCZ])([^MLCZ]*)/g)) {
        const comando = trecho[1];
        const n = (trecho[2]!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        if (comando === "Z") ops.push("h");
        else if (comando === "M") ops.push(`${px(n[0]!)} ${py(n[1]!)} m`);
        else if (comando === "L") ops.push(`${px(n[0]!)} ${py(n[1]!)} l`);
        else {
          for (let i = 0; i + 5 < n.length; i += 6) {
            ops.push(
              `${px(n[i]!)} ${py(n[i + 1]!)} ${px(n[i + 2]!)} ${py(n[i + 3]!)} ` +
                `${px(n[i + 4]!)} ${py(n[i + 5]!)} c`,
            );
          }
        }
      }

      return `${r} ${g} ${b} rg ${ops.join(" ")} ${shape.evenOdd ? "f*" : "f"}`;
    }

    if (shape.kind === "stroke") {
      const { r, g, b } = shape.color;
      const curves = shape.curves.map((curve) => `${curve.join(" ")} c`).join(" ");
      const alpha = shape.opacity ?? 1;
      const gs = alpha < 1 ? `/GS${opacities.indexOf(alpha)} gs ` : "";
      return (
        `q ${gs}${r} ${g} ${b} RG ${shape.width} w ` +
        `${shape.start[0]} ${shape.start[1]} m ${curves} S Q`
      );
    }

    const { r, g, b } = shape.color;
    if (shape.kind === "rect") {
      return `${r} ${g} ${b} rg ${shape.x} ${shape.y} ${shape.width} ${shape.height} re f`;
    }

    const curves = shape.curves.map((curve) => `${curve.join(" ")} c`).join(" ");
    const lines = shape.close.map(([x, y]) => `${x} ${y} l`).join(" ");
    const contorno = `${shape.start[0]} ${shape.start[1]} m ${curves} ${lines} h`;

    if (shape.gradient) {
      /* O caminho vira recorte (`W n`) e o Shading pinta dentro dele. Sem o
         recorte, o degradê cobriria a página inteira. */
      /* `findIndex` em vez de `indexOf`: a lista foi estreitada por um type
         guard, e comparar identidade evita a incompatibilidade de tipo. */
      const indice = gradients.findIndex((item) => item === shape);
      return `q ${contorno} W n /Sh${indice} sh Q`;
    }

    return `${r} ${g} ${b} rg ${contorno} f`;
  }

  const conteudos = paginas.map((pagina) => {
    /* Formas primeiro: no PDF quem vem depois pinta por cima, e o texto
       precisa ficar acima das faixas de fundo. */
    const drawn = (pagina.shapes ?? []).map(desenhar).join("\n");

    const written = pagina.texts
      .map((item) => {
        const font = item.font === "Helvetica-Bold" ? "/F2" : "/F1";
        const safe = escapePdfText(toWinAnsi(item.text));
        const color = item.color ?? { r: 0, g: 0, b: 0 };
        return (
          `BT ${color.r} ${color.g} ${color.b} rg ${font} ${item.size} Tf ` +
          `${item.x} ${item.y} Td (${safe}) Tj ET`
        );
      })
      .join("\n");

    return [drawn, written].filter(Boolean).join("\n");
  });

  const xobjects = images
    .map((_, index) => `/Im${index} ${primeiraImagem + index} 0 R`)
    .join(" ");

  /* Cada gradiente ocupa DOIS objetos: a função de interpolação e o shading
     que a usa. O nome aponta para o segundo. */
  const shadings = gradients
    .map((_, index) => `/Sh${index} ${primeiroShading + index * 2 + 1} 0 R`)
    .join(" ");

  const gstates = opacities
    .map((_, index) => `/GS${index} ${primeiroGState + index} 0 R`)
    .join(" ");

  const recursos =
    `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>` +
    `${xobjects ? ` /XObject << ${xobjects} >>` : ""}` +
    `${shadings ? ` /Shading << ${shadings} >>` : ""}` +
    `${gstates ? ` /ExtGState << ${gstates} >>` : ""} >>`;

  const filhos = paginas
    .map((_, index) => `${primeiraPagina + index * 2} 0 R`)
    .join(" ");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${filhos}] /Count ${paginas.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ...paginas.flatMap((pagina, index) => {
      const tamanho = pagina.size ?? A4_LANDSCAPE;
      const conteudo = conteudos[index]!;
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${tamanho.width} ${tamanho.height}] ` +
          `${recursos} /Contents ${primeiraPagina + index * 2 + 1} 0 R >>`,
        `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
      ];
    }),
    ...images.map((image) => {
      /* `latin1` porque o arquivo inteiro é gravado nessa codificação no fim:
         os bytes comprimidos precisam sair exatamente como estão. */
      const bytes = Buffer.from(image.data, "base64").toString("latin1");
      return (
        `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} ` +
        `/Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /FlateDecode /Length ${bytes.length} >>\nstream\n${bytes}\nendstream`
      );
    }),
    /* Cada gradiente: função exponencial (interpola de C0 a C1) seguida do
       shading axial que a usa. `Extend` prolonga a cor além das pontas do
       eixo, senão a forma fica sem preenchimento fora do trecho do degradê. */
    ...gradients.flatMap((shape, index) => {
      const { from, to, axis } = shape.gradient;
      return [
        `<< /FunctionType 2 /Domain [0 1] ` +
          `/C0 [${from.r} ${from.g} ${from.b}] /C1 [${to.r} ${to.g} ${to.b}] /N 1 >>`,
        `<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${axis.join(" ")}] ` +
          `/Function ${primeiroShading + index * 2} 0 R ` +
          `/Extend [true true] >>`,
      ];
    }),
    ...opacities.map((alpha) => `<< /Type /ExtGState /ca ${alpha} /CA ${alpha} >>`),
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  /* `latin1` e não `utf8`: o texto já foi convertido para WinAnsi, e gravar em
     UTF-8 desfaria a conversão — cada byte precisa sair como está. */
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
