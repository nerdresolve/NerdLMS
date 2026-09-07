/**
 * Certificado de conclusão.
 *
 * Separado de `pdf.ts` porque são decisões diferentes: lá é como escrever um
 * arquivo PDF, aqui é o que o certificado diz e como ele se parece. Trocar o
 * gerador não muda o texto, e mudar o texto não mexe no formato.
 *
 * O desenho segue a referência aprovada: massas de onda violeta nos dois cantos,
 * a logo no topo, "CERTIFICADO DE" em letras espaçadas sobre
 * "CONCLUSÃO" em corpo grande, e uma linha de assinatura acima da atribuição.
 * O fundo é claro e as ondas ocupam as laterais — o texto vive no miolo
 * branco, onde o contraste é máximo.
 */

import { LOGO_CERTIFICADO } from "./logo.ts";
import {
  A4_LANDSCAPE,
  approximateWidth,
  buildPdf,
  rgb,
  type PdfColor,
  type PdfShape,
  type PdfText,
} from "./pdf.ts";
import { formatDuration } from "../courses/progress.ts";

export interface CertificateData {
  learnerName: string;
  courseTitle: string;
  lessons: number;
  durationSeconds: number;
  /** Data de conclusão, em ISO. */
  completedAt: string;
  /** Identificador para conferência. */
  code: string;
}

/* Os mesmos valores dos tokens do Design System. Repetidos como constante
   porque o PDF não lê CSS, e um import de `.css` daqui não faria sentido. */
const BRAND = rgb("#6D28D9"); // --violet-600
const BRAND_DEEP = rgb("#7C3AED"); // --violet-500
const BRAND_DARK = rgb("#5B21B6"); // --violet-700, a ponta densa do degradê
const BRAND_LIGHT = rgb("#A855F7"); // a ponta clara
const WAVE_SOFT = rgb("#EDE9FE");
const WAVE_PALE = rgb("#F5F3FF");
const DOTS = rgb("#DDD1FE"); // ornamento discreto dos cantos
const HAIRLINE = rgb("#FFFFFF"); // fios dentro do violeta
const INK = rgb("#1B0B33");
const MUTED = rgb("#6B6479");
const PAPER = rgb("#FFFFFF");

/** Data por extenso em pt-BR, como um certificado se escreve. */
function longDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Espaça as letras de um texto.
 *
 * "CERTIFICADO DE" aparece na referência com respiro entre caracteres. O
 * gerador não expõe `Tc` (character spacing), e inserir espaços resolve sem
 * mexer no formato — o custo é o texto ficar assim para quem copiar do PDF,
 * o que num título de certificado é irrelevante.
 */
function spaced(text: string): string {
  return text.split("").join(" ");
}

/** Margem lateral mínima. Abaixo disso o texto encosta nas ondas. */
const MARGIN = 150;

/**
 * Centraliza uma linha, encolhendo a fonte se ela não couber.
 *
 * Nome de pessoa e título de curso vêm do cadastro e não têm limite prático:
 * "Operação e Manutenção de Estações de Tratamento de Água e Efluentes"
 * atravessaria a margem. Como o gerador não quebra linha, não há para onde o
 * excesso ir — então o corpo diminui até caber.
 *
 * A margem aqui é larga (150pt de cada lado) porque as ondas invadem as
 * laterais: um texto que respeitasse só a borda do papel cairia sobre o violeta.
 */
function centered(
  text: string,
  y: number,
  size: number,
  bold = false,
  color = INK,
): PdfText {
  const available = A4_LANDSCAPE.width - MARGIN * 2;
  let fitted = size;

  /* Piso de 40%: as ondas invadem as laterais, e um nome muito longo precisa
     encolher bastante para não cair sobre o violeta. Abaixo disso o texto ficaria
     ilegível — se um dia alguém tiver um nome que não caiba nem assim, é caso
     de quebrar em duas linhas, não de diminuir mais. */
  while (approximateWidth(text, fitted, bold) > available && fitted > size * 0.4) {
    fitted -= 0.5;
  }

  const x = (A4_LANDSCAPE.width - approximateWidth(text, fitted, bold)) / 2;
  return {
    text,
    x: Math.max(MARGIN * 0.4, x),
    y,
    size: fitted,
    color,
    ...(bold ? { font: "Helvetica-Bold" as const } : {}),
  };
}

/**
 * O desenho de fundo.
 *
 * A ordem importa: o que vem antes é pintado primeiro. Papel, depois as
 * massas claras, depois as escuras — cada camada cobre parte da anterior, e é
 * dessa sobreposição que sai a profundidade das ondas da referência.
 */
function background(): PdfShape[] {
  const { width, height } = A4_LANDSCAPE;

  return [
    { kind: "rect", x: 0, y: 0, width, height, color: PAPER },

    /* Véu de canto: dois tons muito claros que impedem o miolo de ser branco
       puro de ponta a ponta. Na referência eles aparecem como uma névoa atrás
       da logo e no rodapé. */
    {
      kind: "path",
      start: [width, height],
      curves: [
        [width - 210, height - 4, width - 128, height - 96, width - 286, height - 128],
        [width - 430, height - 158, width - 320, height - 30, width - 520, height],
      ],
      close: [
        [width - 520, height],
        [width, height],
      ],
      color: WAVE_PALE,
    },
    {
      kind: "path",
      start: [0, 0],
      curves: [
        [190, 66, 402, -18, 604, 38],
        [726, 72, 792, 24, width, 60],
      ],
      close: [
        [width, 0],
        [0, 0],
      ],
      color: WAVE_PALE,
    },

    /* ---------------------------------------------------------- esquerda
       A massa dominante, em duas camadas com degradê.

       O perfil é LARGO EM CIMA e estreito embaixo, como na referência: a
       borda desce em S, abrindo sobre o topo e recolhendo-se no rodapé. O
       inverso disso (estreito em cima) faz a forma parecer uma coluna, e
       largura constante cria uma cintura reta no meio do miolo. */
    {
      kind: "path",
      start: [0, height],
      curves: [
        [96, height - 30, 210, height - 130, 196, 372],
        [184, 236, 66, 150, 44, 0],
      ],
      close: [
        [0, 0],
        [0, height],
      ],
      color: BRAND_LIGHT,
      gradient: { from: BRAND_LIGHT, to: BRAND, axis: [0, height, 210, 40] },
    },
    {
      kind: "path",
      start: [0, height],
      curves: [
        [64, height - 34, 148, height - 140, 134, 368],
        [124, 240, 30, 156, 8, 0],
      ],
      close: [
        [0, 0],
        [0, height],
      ],
      color: BRAND_DEEP,
      gradient: { from: BRAND_DARK, to: BRAND_DEEP, axis: [0, height, 150, 60] },
    },

    /* Fio claro acompanhando a borda interna: some quase por completo, mas é
       o que faz a massa parecer água em movimento em vez de recorte. */
    {
      kind: "stroke",
      start: [22, height - 18],
      curves: [
        [104, height - 52, 190, height - 152, 176, 370],
        [164, 244, 58, 162, 34, 34],
      ],
      color: HAIRLINE,
      width: 1.1,
      opacity: 0.34,
    },

    /* ----------------------------------------------------------- direita
       Mesmo perfil da esquerda, espelhado e com a barriga MAIS BAIXA — as
       duas iguais deixariam a página simétrica demais para uma marca que usa
       água como signo. */
    {
      kind: "path",
      start: [width, 0],
      curves: [
        [width - 82, 34, width - 178, 150, width - 166, 272],
        [width - 154, 400, width - 56, 476, width - 30, height],
      ],
      close: [
        [width, height],
        [width, 0],
      ],
      color: BRAND,
      gradient: { from: BRAND, to: BRAND_LIGHT, axis: [width, 0, width - 220, height] },
    },
    {
      kind: "path",
      start: [width, 0],
      curves: [
        [width - 52, 38, width - 118, 156, width - 108, 268],
        [width - 98, 390, width - 24, 470, width - 4, height],
      ],
      close: [
        [width, height],
        [width, 0],
      ],
      color: BRAND_DEEP,
      gradient: { from: BRAND_DEEP, to: BRAND, axis: [width, 0, width - 160, height] },
    },
    {
      kind: "stroke",
      start: [width - 24, 26],
      curves: [
        [width - 92, 58, width - 162, 168, width - 150, 272],
        [width - 138, 394, width - 52, 466, width - 26, height - 22],
      ],
      color: HAIRLINE,
      width: 1.1,
      opacity: 0.3,
    },

    /* Faixa suave sob o rodapé, atravessando a página inteira: terminando no
       meio, o fecho reto criaria um bico contra a massa da direita. */
    {
      kind: "path",
      start: [0, 0],
      curves: [
        [180, 58, 400, -20, 600, 34],
        [720, 66, 790, 22, width, 56],
      ],
      close: [
        [width, 0],
        [0, 0],
      ],
      color: WAVE_SOFT,
    },

    /* Ornamento de pontos nos dois cantos, como na referência: um respiro
       gráfico onde a página ficaria vazia. */
    {
      kind: "dots",
      x: width - 224,
      y: height - 92,
      columns: 14,
      rows: 4,
      gap: 13,
      radius: 1.25,
      color: DOTS,
    },
    {
      kind: "dots",
      x: 126,
      y: 126,
      columns: 9,
      rows: 3,
      gap: 13,
      radius: 1.25,
      color: DOTS,
    },

    /* A logo do certificado. Proporção preservada: a origem é 600x165, e a
       altura sai da razão — esticar a marca seria erro de identidade. */
    {
      kind: "image",
      x: (width - 138) / 2,
      y: height - 116,
      width: 138,
      height: 138 * (LOGO_CERTIFICADO.height / LOGO_CERTIFICADO.width),
      pixelWidth: LOGO_CERTIFICADO.width,
      pixelHeight: LOGO_CERTIFICADO.height,
      data: LOGO_CERTIFICADO.data,
    },

    /* Filete curto entre os metadados e a data. */
    { kind: "rect", x: (width - 76) / 2, y: height - 420, width: 76, height: 0.7, color: rgb("#DDD1FE") },

    /* Rubrica e a linha sobre a qual ela repousa. O traço é desenhado, não
       uma imagem: é uma marca gráfica da plataforma, não a assinatura de uma
       pessoa física — e escanear a rubrica de alguém para embutir num PDF
       gerado em massa seria outra conversa. */
    ...signature(width / 2, 118),
    { kind: "rect", x: (width - 190) / 2, y: 104, width: 190, height: 0.7, color: rgb("#B9A5E8") },
  ];
}

/**
 * Birreta e relógio ao lado dos números do curso.
 *
 * Desenhados como vetor, não vindos de uma fonte de ícones: embutir uma fonte
 * inteira para dois glifos custaria mais que estas poucas curvas, e o
 * resultado escala igual.
 */
function metaIcons(
  x0: number,
  y: number,
  /** Distância, a partir de `x0`, de cada ícone. Medida pelo texto que o
      precede — chutar a posição faz o relógio cair sobre o número. */
  offsets: [number, number],
): PdfShape[] {
  const birreta = x0 + offsets[0];
  const relogio = x0 + offsets[1];

  return [
    /* Birreta: o losango do topo e a haste. */
    {
      kind: "path",
      start: [birreta - 8, y + 3],
      curves: [
        [birreta - 8, y + 3, birreta, y + 8, birreta, y + 8],
        [birreta, y + 8, birreta + 8, y + 3, birreta + 8, y + 3],
        [birreta + 8, y + 3, birreta, y - 2, birreta, y - 2],
      ],
      close: [[birreta - 8, y + 3]],
      color: MUTED,
    },
    {
      kind: "stroke",
      start: [birreta - 4.5, y + 1],
      curves: [[birreta - 4.5, y - 4, birreta + 4.5, y - 4, birreta + 4.5, y + 1]],
      color: MUTED,
      width: 1.2,
    },

    /* Relógio: circunferência mais dois ponteiros. */
    {
      kind: "stroke",
      start: [relogio - 6, y + 3],
      curves: [
        [relogio - 6, y + 6.3, relogio - 3.3, y + 9, relogio, y + 9],
        [relogio + 3.3, y + 9, relogio + 6, y + 6.3, relogio + 6, y + 3],
        [relogio + 6, y - 0.3, relogio + 3.3, y - 3, relogio, y - 3],
        [relogio - 3.3, y - 3, relogio - 6, y - 0.3, relogio - 6, y + 3],
      ],
      color: MUTED,
      width: 1.1,
    },
    {
      kind: "stroke",
      start: [relogio, y + 6],
      curves: [[relogio, y + 4, relogio, y + 3, relogio, y + 3]],
      color: MUTED,
      width: 1.1,
    },
    {
      kind: "stroke",
      start: [relogio, y + 3],
      curves: [[relogio + 1.4, y + 3, relogio + 2.8, y + 3, relogio + 3.2, y + 3]],
      color: MUTED,
      width: 1.1,
    },
  ];
}

/**
 * A rubrica sobre a linha de assinatura.
 *
 * Um traço contínuo em três curvas, com a inclinação de uma assinatura à mão.
 * Não representa ninguém: identifica o documento como emitido pela
 * plataforma, e o que dá fé é o código de verificação, conferível na página
 * pública.
 */
function signature(x: number, y: number): PdfShape[] {
  const traco = (
    start: [number, number],
    curves: Array<[number, number, number, number, number, number]>,
    width: number,
    color: PdfColor,
  ): PdfShape => ({ kind: "stroke", start, curves, color, width });

  return [
    traco(
      [x - 44, y - 6],
      [
        [x - 36, y + 22, x - 22, y + 30, x - 16, y + 8],
        [x - 10, y - 14, x - 20, y - 18, x - 14, y + 4],
        [x - 8, y + 24, x + 6, y + 26, x + 14, y + 2],
      ],
      1.5,
      BRAND_DEEP,
    ),
    traco(
      [x + 12, y + 2],
      [
        [x + 20, y + 20, x + 30, y + 22, x + 36, y + 4],
        [x + 42, y - 12, x + 50, y + 14, x + 62, y + 10],
      ],
      1.5,
      BRAND_DEEP,
    ),
  ];
}

/**
 * Monta o PDF do certificado.
 *
 * O rodapé traz o código e a ressalva de que não equivale a certificação
 * regulatória — a proposta é explícita quanto a isso (seção 6), e um
 * certificado que não diz o que não é acaba usado como se fosse.
 */
export function buildCertificate(data: CertificateData): Uint8Array {
  const { width, height } = A4_LANDSCAPE;

  /* A linha de metadados NÃO é uma string só.
     Estimar onde um ícone cai dentro de um texto com espaços acumula erro —
     `approximateWidth` é uma média, e o desvio de cada espaço soma. Aqui cada
     pedaço tem coordenada própria, calculada a partir da largura medida, e o
     ícone fica ancorado ao pedaço que ele acompanha. */
  const aulas = `${data.lessons} ${data.lessons === 1 ? "aula" : "aulas"}`;
  const duracao = formatDuration(data.durationSeconds);

  const ICONE = 13; // espaço reservado para cada ícone
  const RESPIRO = 10; // entre ícone e texto
  const SEPARADOR = 22; // largura do "·" com folga dos dois lados

  const larguraAulas = approximateWidth(aulas, 12);
  const larguraDuracao = approximateWidth(duracao, 12);
  const metaLargura =
    ICONE + RESPIRO + larguraAulas + SEPARADOR + ICONE + RESPIRO + larguraDuracao;

  const metaY = height - 404;
  const metaX = (width - metaLargura) / 2;
  const xAulas = metaX + ICONE + RESPIRO;
  const xSeparador = xAulas + larguraAulas + SEPARADOR / 2 - 2;
  const xIconeTempo = xAulas + larguraAulas + SEPARADOR;
  const xDuracao = xIconeTempo + ICONE + RESPIRO;

  const texts: PdfText[] = [
    centered("Plataforma de Ensino", height - 132, 10, false, MUTED),

    centered(spaced("CERTIFICADO DE"), height - 178, 12.5, true, BRAND_DEEP),
    centered(spaced("CONCLUSÃO"), height - 222, 32, true, BRAND),

    centered("Certificamos que", height - 262, 12, false, MUTED),
    centered(data.learnerName, height - 306, 33, true, INK),
    centered("concluiu o curso", height - 340, 12, false, MUTED),
    centered(data.courseTitle, height - 372, 19, true, BRAND),

    /* O espaço extra abre lugar para os ícones desenhados em `metaIcons`:
       eles são vetor e não ocupam largura no texto, então o recuo precisa
       vir daqui. */
    { text: aulas, x: xAulas, y: metaY, size: 12, color: MUTED },
    { text: "·", x: xSeparador, y: metaY, size: 12, color: MUTED },
    { text: duracao, x: xDuracao, y: metaY, size: 12, color: MUTED },

    centered(`Concluído em ${longDate(data.completedAt)}`, height - 436, 12, false, MUTED),

    /* Atribuição sob a linha de assinatura. */
    centered(spaced("NERDRESOLVE"), 86, 9.5, true, BRAND_DEEP),
    centered("Plataforma de Ensino", 72, 9, false, MUTED),

    /* Rodapé sobre o miolo claro, não sobre as ondas: por isso o texto é
       escuro aqui, ao contrário da versão anterior. */
    {
      text: `Código de verificação: ${data.code}`,
      x: 118,
      y: 44,
      size: 9,
      font: "Helvetica-Bold",
      color: BRAND_DEEP,
    },
    {
      text: "Documento de conclusão interna.",
      x: 118,
      y: 30,
      size: 8,
      color: MUTED,
    },
    {
      text: "Não equivale a certificação regulatória ou acadêmica.",
      x: 118,
      y: 20,
      size: 8,
      color: MUTED,
    },
    /* O endereço de validação, não a home: o código impresso ao lado só serve
       se quem recebe o documento souber onde conferi-lo. */
    {
      text: "Confira em exemplo.com.br/validar",
      x: width - 296,
      y: 44,
      size: 9,
      font: "Helvetica-Bold",
      color: BRAND_DEEP,
    },
  ];

  return buildPdf(texts, A4_LANDSCAPE, [
    ...background(),
    ...metaIcons(metaX, metaY + 4, [ICONE / 2, xIconeTempo - metaX + ICONE / 2]),
  ]);
}

/**
 * Código de verificação a partir da matrícula.
 *
 * Determinístico: o mesmo certificado gera o mesmo código toda vez, então
 * reemitir não invalida o que já foi impresso. Curto o bastante para alguém
 * digitar ao conferir.
 */
export function certificateCode(enrollmentId: string): string {
  return enrollmentId.replace(/-/g, "").slice(0, 12).toUpperCase();
}
