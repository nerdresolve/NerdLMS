/**
 * Certificado de conclusão.
 *
 * Separado de `pdf.ts` porque são decisões diferentes: lá é como escrever um
 * arquivo PDF, aqui é o que o certificado diz e como ele se parece. Trocar o
 * gerador não muda o texto, e mudar o texto não mexe no formato.
 *
 * O desenho segue o material da organização: uma faixa do grafismo da marca
 * na borda esquerda, a logo no topo, "CERTIFICADO DE" em letras espaçadas
 * sobre "CONCLUSÃO" em corpo grande, e uma linha de assinatura acima da
 * atribuição. O papel é branco e o bloco de cor fica na borda — o texto vive
 * no miolo, onde o contraste é máximo.
 */

import { MOSAIC_SHAPES } from "../brand/mosaic.ts";
import { NERD_LOGO } from "./logo.ts";
import {
  A4_LANDSCAPE,
  approximateWidth,
  buildPdfPages,
  rgb,
  type PdfColor,
  type PdfPage,
  type PdfShape,
  type PdfText,
} from "./pdf.ts";
import type { ItemDoPrograma } from "./certificate-verso.ts";
import { formatDuration } from "../courses/progress.ts";
import { NOME_PADRAO } from "../tenancy/branding.ts";

export interface CertificateData {
  learnerName: string;
  courseTitle: string;
  lessons: number;
  durationSeconds: number;
  /** Data de conclusão, em ISO. */
  completedAt: string;
  /** Identificador para conferência. */
  code: string;
  /**
   * Quem emite, impresso na linha de assinatura quando o curso não tem
   * instrutor definido.
   *
   * Vem do tenant que emitiu — é o nome que a pessoa reconhece no documento.
   * Omitido, cai no nome do produto: um nome de cliente fixo aqui sairia
   * impresso no certificado de TODOS os outros.
   */
  issuer?: string;
  /**
   * Quem assina, e a assinatura em si.
   *
   * Nulo quando o curso não tem instrutor definido, ou quando ele ainda não
   * enviou a digitalização. O certificado SAI DO MESMO JEITO — a emissão nunca
   * depende de um arquivo que alguém pode não ter enviado. Sem assinatura, a
   * área volta a ser a régua de três cores, que é o que havia antes.
   */
  signer?: {
    name: string;
    /** O papel de quem assina, escrito por extenso sob o nome. */
    title: string;
    /** RGB comprimido com Flate, como o PDF exige. Nulo = só o nome. */
    image?: { data: string; width: number; height: number } | null;
  } | null;
  /**
   * Onde conferir o código, já pronto para imprimir.
   *
   * O rodapé trazia `lms.exemplo.com/validar` escrito à mão, e esse
   * endereço não resolve. O código impresso ao lado só vale se quem recebe o
   * documento souber onde conferi-lo, e mandá-lo a um endereço morto é pior
   * que não mandar: ele tenta, falha, e conclui que o certificado é falso.
   *
   * Ausente ou nulo imprime uma orientação que se sustenta sozinha. Um
   * endereço só entra no papel quando existe de verdade — a instalação
   * declara o domínio dela, e nenhum valor é adivinhado aqui.
   */
  validacaoUrl?: string | null;
  /**
   * O conteúdo programático, que vira o VERSO do documento.
   *
   * Ausente gera certificado de uma página só, como antes. A emissão nunca
   * depende deste campo: um curso sem programa montado continua certificando
   * quem concluiu.
   */
  programa?: {
    itens: ItemDoPrograma[];
    total: number;
    truncado: boolean;
    /** Já por extenso: "4 horas", "1h30". */
    carga: string;
  } | null;
}

/* Os mesmos valores dos tokens do Design System. Repetidos como constante
   porque o PDF não lê CSS, e um import de `.css` daqui não faria sentido. */
const BRAND = rgb("#6D28D9"); // --blue-600
const BRAND_DEEP = rgb("#4C1D95"); // --blue-700, o azul do "NERDRESOLVE"
const INK = rgb("#18191B");
const MUTED = rgb("#494C50");
const PAPER = rgb("#FFFFFF");

/* As cores do grafismo. A cor é propriedade da FORMA, e o módulo da marca as
   nomeia como token CSS — aqui o token é resolvido para o valor, porque um
   PDF não tem folha de estilo. */
const TILE_BLUE = rgb("#A855F7");
const TILE_NAVY = rgb("#1E0F45");
const TILE_SUN = rgb("#EC4899");
const TILE_LEAF = rgb("#818CF8");
const TILE_RING = rgb("#C084FC");

const CERT_TILE: Record<string, PdfColor> = {
  "var(--tile-blue)": TILE_BLUE,
  "var(--tile-navy)": TILE_NAVY,
  "var(--tile-sun)": TILE_SUN,
  "var(--tile-leaf)": TILE_LEAF,
  "var(--tile-ring)": TILE_RING,
};

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

/** Margem lateral mínima. Abaixo disso o texto encosta na borda do papel. */
const MARGIN = 96;

/**
 * Centraliza uma linha, encolhendo a fonte se ela não couber.
 *
 * Nome de pessoa e título de curso vêm do cadastro e não têm limite prático:
 * "Operação e Manutenção de Estações de Tratamento de Água e Efluentes"
 * atravessaria a margem. Como o gerador não quebra linha, não há para onde o
 * excesso ir — então o corpo diminui até caber.
 *
 * Era de 150pt de cada lado enquanto as ondas invadiam as laterais. Agora o
 * grafismo está no topo e o miolo é branco de borda a borda: 96pt bastam, e
 * um nome longo cabe em corpo maior em vez de encolher.
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

  /* Piso de 40%: um nome muito longo precisa
     encolher bastante para não cair sobre o azul. Abaixo disso o texto ficaria
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
 * Uma FAIXA do grafismo da marca no topo, em cores cheias, e o resto do papel
 * limpo. É a composição do material da organização: bloco de formas de um
 * lado da divisa, conteúdo do outro, aresta reta entre os dois.
 *
 * O que havia antes eram massas de onda invadindo as duas laterais — a
 * assinatura gráfica da marca anterior. Nenhuma curva orgânica existe no
 * material da organização.
 *
 * A faixa é no TOPO, e não na lateral: `centered()` centra pelo papel inteiro,
 * e uma faixa só à esquerda deslocaria o eixo óptico do texto sem deslocar o
 * cálculo. Simetria aqui não é preferência de gosto, é o que mantém o
 * alinhamento correto.
 *
 * A cor entra em cheio, ao contrário das telas do produto: um certificado é
 * peça única, impressa e emoldurada, não um elemento que se repete a cada
 * rolagem.
 */
function background(signer: CertificateData["signer"]): PdfShape[] {
  const { width, height } = A4_LANDSCAPE;

  const grade = MOSAIC_SHAPES.band; // 14 colunas × 1 linha
  const colunas = 14;
  const celula = width / colunas;

  const tiles: PdfShape[] = grade.paths.map((path) => ({
    kind: "vector" as const,
    d: path.d,
    x: 0,
    y: height - celula,
    scale: celula,
    boxHeight: 1,
    color: CERT_TILE[path.fill] ?? BRAND_DEEP,
    /* O anel é círculo com furo; sem `evenOdd` ele fecha e vira disco. */
    evenOdd: true,
  }));

  return [
    { kind: "rect", x: 0, y: 0, width, height, color: PAPER },

    /* Fundo da faixa: o navy cobre o que a grade deixar vazado, para a faixa
       ser um bloco e não um mosaico com buracos brancos. */
    { kind: "rect", x: 0, y: height - celula, width, height: celula, color: BRAND_DEEP },
    ...tiles,

    /* A logo real da organização, abaixo da faixa. Proporção preservada: a
       altura sai da razão do arquivo — esticar a marca seria erro de
       identidade. */
    {
      kind: "image",
      x: (width - 132) / 2,
      y: height - celula - 62,
      width: 132,
      height: 132 * (NERD_LOGO.height / NERD_LOGO.width),
      pixelWidth: NERD_LOGO.width,
      pixelHeight: NERD_LOGO.height,
      data: NERD_LOGO.data,
    },

    /* Filete curto entre os metadados e a data. */
    { kind: "rect", x: (width - 76) / 2, y: height - 424, width: 76, height: 0.7, color: TILE_BLUE },

    /* A linha sobre a qual a marca de assinatura repousa. */
    { kind: "rect", x: (width - 190) / 2, y: 104, width: 190, height: 0.7, color: rgb("#DDD1FE") },
    ...signature(width / 2, 112, signer),

    /* Régua das três cores no pé da página, de borda a borda: fecha a
       composição contra a faixa do topo. */
    { kind: "rect", x: 0, y: 0, width: width / 3, height: 6, color: TILE_SUN },
    { kind: "rect", x: width / 3, y: 0, width: width / 3, height: 6, color: TILE_LEAF },
    { kind: "rect", x: (width * 2) / 3, y: 0, width: width / 3, height: 6, color: TILE_BLUE },
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
 * O que fica sobre a linha de assinatura.
 *
 * COM ASSINATURA: a digitalização que o instrutor enviou, escalada para caber
 * sem deformar. O limite é a ALTURA, não a largura — assinatura é traço largo e
 * baixo, e limitar pela largura deixaria uma faixa de 8 pontos, ilegível. A
 * largura só entra como teto para o caso raro de uma assinatura quase quadrada.
 *
 * SEM ASSINATURA: a régua de três cores, que era o que havia antes. Ela não
 * representa ninguém — identifica o documento como emitido pela plataforma, e
 * quem dá fé é o código de verificação, conferível na página pública. Vale
 * enquanto o instrutor não enviou a dele, e é o que garante que a emissão nunca
 * dependa de um arquivo.
 */
function signature(
  x: number,
  y: number,
  signer: CertificateData["signer"],
): PdfShape[] {
  const imagem = signer?.image;

  if (imagem && imagem.width > 0 && imagem.height > 0) {
    /* O TETO DE ALTURA NÃO É GOSTO: é a distância até a linha "Concluído em",
       cuja base fica em `height - 436`. A primeira versão usava 46 e sobrava
       UM PONTO de folga — os descendentes da data encostavam no topo da
       assinatura, e só se via renderizando o PDF.

       Escrito como conta, e não como número, para que mexer no layout acima
       quebre isto de forma visível em vez de recriar a colisão em silêncio.
       `FOLGA` é o respiro mínimo entre os dois blocos. */
    const baseDaData = A4_LANDSCAPE.height - 436;
    const FOLGA = 16;
    const alturaMaxima = Math.max(18, baseDaData - FOLGA - y);
    const larguraMaxima = 180;

    const proporcao = imagem.width / imagem.height;
    let altura = alturaMaxima;
    let largura = altura * proporcao;

    if (largura > larguraMaxima) {
      largura = larguraMaxima;
      altura = largura / proporcao;
    }

    return [
      {
        kind: "image",
        x: x - largura / 2,
        /* Apoiada SOBRE a linha, não centrada nela: assinatura repousa no
           papel pautado, e é assim que o olho espera encontrá-la. */
        y,
        width: largura,
        height: altura,
        pixelWidth: imagem.width,
        pixelHeight: imagem.height,
        data: imagem.data,
      },
    ];
  }

  const largura = 34;

  return [
    { kind: "rect", x: x - largura * 1.5, y: y + 4, width: largura, height: 5, color: TILE_SUN },
    { kind: "rect", x: x - largura * 0.5, y: y + 4, width: largura, height: 5, color: TILE_LEAF },
    { kind: "rect", x: x + largura * 0.5, y: y + 4, width: largura, height: 5, color: TILE_BLUE },
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

    /* Atribuição sob a linha de assinatura.

       Quem assina é o instrutor responsável pelo curso, quando há um. O NOME
       IMPRESSO não é redundante com a assinatura: rabisco sozinho não
       identifica ninguém, e é a linha impressa que permite conferir de quem é.
       É como todo certificado sério faz.

       Sem instrutor definido, a atribuição volta a ser da plataforma — que é o
       que o documento sempre foi antes desta mudança. */
    ...(data.signer
      ? [
          centered(spaced(data.signer.name.toUpperCase()), 86, 9.5, true, BRAND_DEEP),
          centered(data.signer.title, 72, 9, false, MUTED),
        ]
      : [
          centered(spaced((data.issuer ?? NOME_PADRAO).toUpperCase()), 86, 9.5, true, BRAND_DEEP),
          centered("Plataforma de Ensino", 72, 9, false, MUTED),
        ]),

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
       se quem recebe o documento souber onde conferi-lo.

       E só quando ele existe. Sem domínio declarado, a orientação aponta para
       a área de treinamento, que é uma porta que sempre abre. */
    {
      text: data.validacaoUrl
        ? `Confira em ${data.validacaoUrl}`
        : "Confira o código com a área de treinamento.",
      x: width - 296,
      y: 44,
      size: 9,
      font: "Helvetica-Bold",
      color: BRAND_DEEP,
    },
  ];

  const frente: PdfPage = {
    size: A4_LANDSCAPE,
    texts,
    shapes: [
      ...background(data.signer),
      ...metaIcons(metaX, metaY + 4, [ICONE / 2, xIconeTempo - metaX + ICONE / 2]),
    ],
  };

  const verso = versoDoCertificado(data);

  return buildPdfPages(verso ? [frente, verso] : [frente]);
}

/**
 * O verso: o conteúdo programático e os dados que uma auditoria pede.
 *
 * A frente prova a conclusão e não diz o que foi ensinado. Quem audita
 * treinamento de segurança pergunta o conteúdo, a carga, quem ministrou e a
 * data; sem o verso, o vínculo entre o certificado e o programa do curso
 * depende de procurar os dois documentos e confiar que se referem ao mesmo
 * treinamento.
 *
 * Só é gerado quando há programa. Uma segunda página em branco levantaria mais
 * dúvida do que a ausência dela.
 */
function versoDoCertificado(data: CertificateData): PdfPage | null {
  const programa = data.programa;
  if (!programa || programa.itens.length === 0) return null;

  const { width, height } = A4_LANDSCAPE;
  const margem = 92;
  const textos: PdfText[] = [];

  /* Cabeçalho, mais discreto que o da frente: este lado é documento de
     consulta, e repetir a solenidade competiria com ele. */
  textos.push({
    text: spaced("CONTEÚDO PROGRAMÁTICO"),
    x: margem,
    y: height - 74,
    size: 11,
    font: "Helvetica-Bold",
    color: BRAND_DEEP,
  });

  textos.push({
    text: data.courseTitle,
    x: margem,
    y: height - 96,
    size: 10,
    color: MUTED,
  });

  /* A ficha de auditoria, numa linha só. O que uma conferência procura
     primeiro: quem, quanto, quando e sob qual código. */
  const ficha = [
    `Participante: ${data.learnerName}`,
    `Carga horária: ${programa.carga}`,
    `Conclusão: ${longDate(data.completedAt)}`,
    `Código: ${data.code}`,
  ].join("     ");

  textos.push({
    text: ficha,
    x: margem,
    y: height - 122,
    size: 8.5,
    color: INK,
  });

  if (data.signer) {
    textos.push({
      text: `Ministrado por: ${data.signer.name} (${data.signer.title})`,
      x: margem,
      y: height - 137,
      size: 8.5,
      color: INK,
    });
  }

  /* O programa. Módulo em negrito, aula recuada: em preto e branco o recuo é
     o que separa os dois níveis, porque a cor não sobrevive à fotocópia. */
  let y = height - 176;

  for (const item of programa.itens) {
    const recuo = item.modulo ? 0 : 18;

    textos.push({
      text: item.numero,
      x: margem + recuo,
      y,
      size: item.modulo ? 9 : 8.5,
      font: item.modulo ? "Helvetica-Bold" : "Helvetica",
      color: item.modulo ? BRAND_DEEP : MUTED,
    });

    textos.push({
      text: item.titulo,
      x: margem + recuo + 34,
      y,
      size: item.modulo ? 9 : 8.5,
      font: item.modulo ? "Helvetica-Bold" : "Helvetica",
      color: item.modulo ? BRAND_DEEP : INK,
    });

    if (item.duracao) {
      textos.push({
        text: item.duracao,
        x: width - margem - approximateWidth(item.duracao, 8),
        y,
        size: 8,
        color: MUTED,
      });
    }

    y -= item.modulo ? 17 : 13.5;
  }

  if (programa.truncado) {
    textos.push({
      text: `Lista parcial: o curso tem ${programa.total} itens no programa.`,
      x: margem,
      y: y - 6,
      size: 8,
      font: "Helvetica-Bold",
      color: MUTED,
    });
  }

  /* A ressalva de sempre, e uma a mais.

     Dizer o que o documento NÃO é vale mais que repetir o que ele é: quem
     recebe precisa saber que a conformidade com a norma depende de outros
     registros, e não de ter este papel em mãos. */
  textos.push({
    text: "Documento de conclusão interna, emitido pela plataforma de ensino da organização.",
    x: margem,
    y: 46,
    size: 7.5,
    color: MUTED,
  });

  textos.push({
    text:
      "A conformidade com normas de segurança do trabalho depende também de registro de " +
      "frequência e de qualificação de quem ministra.",
    x: margem,
    y: 34,
    size: 7.5,
    color: MUTED,
  });

  return {
    size: A4_LANDSCAPE,
    texts: textos,
    shapes: [
      { kind: "rect", x: 0, y: 0, width, height, color: PAPER },
      /* Filete no topo em vez da faixa do mosaico: a faixa tem 60pt de altura
         e comeria a área que o programa precisa. */
      { kind: "rect", x: 0, y: height - 5, width, height: 5, color: BRAND_DEEP },
      { kind: "rect", x: 0, y: height - 7, width: 150, height: 2, color: TILE_SUN },
      { kind: "rect", x: margem, y: height - 152, width: width - margem * 2, height: 0.7, color: rgb("#D8DCE2") },
      { kind: "rect", x: margem, y: 62, width: width - margem * 2, height: 0.7, color: rgb("#D8DCE2") },
    ],
  };
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
