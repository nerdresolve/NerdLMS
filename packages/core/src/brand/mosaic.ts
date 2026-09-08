/**
 * O grafismo da marca — curvas longas e a marca em marca-d'água.
 *
 * A referência é a arte institucional da NerdResolve: fundo quase preto, duas
 * ou três curvas violeta atravessando de canto a canto, e a silhueta dos
 * óculos ampliada num canto, quase fundida ao fundo. Nada mais. É uma estética
 * de contraste alto e pouca tinta.
 *
 * O QUE NÃO FUNCIONOU, E POR QUÊ
 *
 * Primeiro veio uma malha regular de pontos, no espírito do `bg-grid-dots` do
 * site. Em escala de hero ela vira textura têxtil: centenas de círculos do
 * mesmo tamanho, em ritmo, desconfortáveis de olhar e sem relação com o
 * produto. Depois veio um traçado de circuito, que era tech demais no sentido
 * literal — diagrama de placa, não identidade.
 *
 * O que a marca faz é mais simples: curva longa, aberta, cortada pela borda.
 * Uma ou duas por peça. O resto é espaço.
 *
 * A COR SAI DE TOKEN, NÃO DA FORMA
 *
 * Cada caminho recebe `var(--tile-…)`, e os tokens são derivados da cor do
 * cliente em `tenancy/branding.ts`. Um cliente com marca própria vê o mesmo
 * desenho nos tons dele; não há cor fixa a "respeitar".
 *
 * Mora no DOMÍNIO, e não no app, porque tem três consumidores: o componente
 * React, o gerador do protótipo e o CERTIFICADO EM PDF. Os três desenham o
 * mesmo grafismo por construção, não por coincidência — e o certificado é
 * gerado no servidor, longe de qualquer CSS.
 */

export type MosaicVariant =
  | "vertical"
  | "horizontal"
  | "layered"
  | "organic"
  | "blob"
  | "band"
  | "art1"
  | "art2"
  | "art3"
  | "art4";

export interface MosaicPath {
  d: string;
  fill: string;
  /** Traço em vez de preenchimento. A largura vai em unidades do viewBox. */
  stroke?: string;
  strokeWidth?: number;
}

export interface MosaicShape {
  viewBox: string;
  preserveAspectRatio: string;
  paths: MosaicPath[];
}

/** Duas casas: o SVG não precisa de mais, e o arquivo encolhe. */
function f(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/**
 * Curva longa, de canto a canto, com uma única inflexão.
 *
 * Os pontos de controle ficam FORA do segmento (a 40% e 60% do vão, deslocados
 * na perpendicular) para a curva sair aberta em vez de arqueada: é o traço da
 * arte institucional, que atravessa a peça sem fechar em nenhum ponto.
 */
function curva(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  desvio: number,
  cor: string,
  largura: number,
): MosaicPath {
  const dx = x2 - x1;
  const dy = y2 - y1;
  /* Perpendicular normalizada: é ela que empurra os controles para fora. */
  const comp = Math.hypot(dx, dy) || 1;
  const px = -dy / comp;
  const py = dx / comp;

  const c1x = x1 + dx * 0.4 + px * desvio;
  const c1y = y1 + dy * 0.4 + py * desvio;
  const c2x = x1 + dx * 0.6 - px * desvio;
  const c2y = y1 + dy * 0.6 - py * desvio;

  return {
    d: `M ${f(x1)} ${f(y1)} C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x2)} ${f(y2)}`,
    fill: "none",
    stroke: cor,
    strokeWidth: largura,
  };
}

/**
 * A silhueta dos óculos, normalizada na caixa unitária.
 *
 * É a marca em marca-d'água: na arte institucional ela aparece ampliada num
 * canto, quase fundida ao fundo.
 *
 * GERADO do vetor oficial (`docs/brand/nerdresolve-mark.svg`), não desenhado
 * à mão: o contorno tem dezenas de curvas, e aproximá-lo com uma dúzia de
 * Béziers saiu deformado na tela. O arquivo usa só `M`, `L`, `C` e `Z` com
 * coordenadas absolutas, então normalizar é dividir cada par pelo bbox —
 * nenhum comando precisa ser interpretado.
 */
const OCULOS_UNITARIO =
  "M 0.3641 0.9752 L 0.3512 0.998 L 0.278 0.9989 C0.198,1.0 0.1945,0.9995 0.1538,0.9811 C0.1056,0.9593 0.1059,0.9606 0.067,0.6284 C0.033,0.3372 0.0339,0.3439 0.022,0.3092 C0.0093,0.2724 0.0073,0.2545 0.0031,0.138 C0.0,0.0521 0.0011,0.0359 0.0114,0.0127 C0.0163,0.0017 0.0317,0.0 0.1251,0.0 C0.2426,0.0001 0.2974,0.0109 0.333,0.0412 C0.3593,0.0635 0.3644,0.0723 0.394,0.147 C0.4299,0.2377 0.4514,0.2905 0.5206,0.457 L 0.5825 0.606 L 0.5838 0.4036 C0.5846,0.2652 0.5861,0.1957 0.5882,0.1836 C0.5927,0.1587 0.6212,0.0915 0.6364,0.0697 C0.675,0.0149 0.7234,0.0005 0.869,0.0003 C0.954,0.0002 0.9823,0.0027 0.9872,0.0106 C0.9986,0.0291 1.0,0.0516 0.9961,0.152 C0.9917,0.2666 0.9914,0.2686 0.9779,0.308 C0.9671,0.3392 0.9652,0.3527 0.9386,0.5791 C0.9055,0.8613 0.8991,0.9088 0.8914,0.9301 C0.872,0.9843 0.8422,0.997 0.7328,0.9975 C0.6494,0.998 0.6464,0.9975 0.6364,0.9803 C0.6307,0.9706 0.5821,0.8577 0.5285,0.7295 C0.4748,0.6013 0.4271,0.4879 0.4225,0.4777 L 0.4142 0.4588 L 0.4142 0.6363 C0.4142,0.7676 0.4133,0.8207 0.4107,0.8406 C0.4065,0.8726 0.382,0.9433 0.3641,0.9752 ZM 0.675 0.8965 C0.6949,0.9057 0.7549,0.8978 0.7778,0.8831 C0.8225,0.8543 0.8597,0.8057 0.868,0.7654 C0.8718,0.7468 0.8837,0.6332 0.8936,0.5216 C0.9151,0.2776 0.917,0.2164 0.9041,0.1857 C0.8972,0.1692 0.8941,0.1686 0.8181,0.1688 C0.6965,0.169 0.6605,0.1934 0.6457,0.2849 C0.6438,0.2971 0.6429,0.3863 0.6429,0.5625 C0.6429,0.7781 0.6435,0.8264 0.6467,0.8462 C0.6516,0.8765 0.6587,0.889 0.675,0.8965 ZM 0.2468 0.8954 C0.278,0.9069 0.3337,0.899 0.3419,0.8819 C0.3445,0.8765 0.3467,0.8723 0.3483,0.8668 C0.3549,0.8451 0.3549,0.8029 0.355,0.5794 L 0.355 0.565 L 0.3551 0.2881 L 0.3474 0.2601 C0.3286,0.1917 0.2881,0.1695 0.1817,0.169 C0.1407,0.1688 0.1039,0.1715 0.0999,0.175 C0.095,0.1793 0.0915,0.1905 0.0889,0.2101 C0.0856,0.2355 0.0856,0.2468 0.0892,0.3061 C0.0966,0.4318 0.1266,0.7436 0.1341,0.7744 C0.1451,0.8191 0.2001,0.8781 0.2468,0.8954 Z";

/** Proporção largura/altura do vetor oficial. */
const OCULOS_RAZAO = 3.197;

/**
 * Posiciona a silhueta numa caixa do viewBox.
 *
 * A substituição casa PARES de números porque, com só `M`, `L`, `C` e `Z`
 * absolutos, todo número é metade de um par (x, y). Um `H` ou `V` no caminho
 * quebraria essa premissa.
 */
function oculos(x: number, y: number, largura: number, cor: string): MosaicPath {
  const altura = largura / OCULOS_RAZAO;
  const d = OCULOS_UNITARIO.replace(
    /(-?\d+\.?\d*)([ ,])(-?\d+\.?\d*)/g,
    (_m, a: string, sep: string, b: string) =>
      `${f(x + parseFloat(a) * largura)}${sep}${f(y + parseFloat(b) * altura)}`,
  );
  return { d, fill: cor };
}

const CURVA = "var(--tile-blue)";
const CURVA_FRACA = "var(--tile-navy)";
const MARCA_DAGUA = "var(--tile-ghost)";

/**
 * As variantes.
 *
 * `slice` em quase todas: a curva é maior que a peça e sai pelas bordas. É o
 * corte que dá a sensação de continuidade — mostrar a curva inteira dentro da
 * caixa a transforma num arco desenhado ali, que é outra coisa.
 */
export const MOSAIC_SHAPES: Record<MosaicVariant, MosaicShape> = {
  /** Coluna do login e da recuperação de senha. */
  vertical: {
    viewBox: "0 0 520 720",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      oculos(250, 430, 380, MARCA_DAGUA),
      curva(-60, 200, 580, 40, 70, CURVA, 3),
      curva(-60, 760, 580, 520, 90, CURVA_FRACA, 2.5),
    ],
  },

  /** Faixas horizontais largas — cabeçalhos de seção. */
  horizontal: {
    viewBox: "0 0 800 420",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      oculos(520, 190, 420, MARCA_DAGUA),
      curva(-60, 120, 860, 30, 60, CURVA, 3),
      curva(-60, 440, 860, 300, 80, CURVA_FRACA, 2.5),
    ],
  },

  /** Hero do painel. A marca-d'água fica à direita, longe do texto. */
  layered: {
    viewBox: "0 0 900 360",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      oculos(600, 130, 460, MARCA_DAGUA),
      curva(-60, 90, 960, 20, 55, CURVA, 3),
      curva(-60, 400, 960, 250, 75, CURVA_FRACA, 2.5),
    ],
  },

  /** Capa de curso. */
  organic: {
    viewBox: "0 0 480 270",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      oculos(300, 100, 280, MARCA_DAGUA),
      curva(-40, 70, 520, 20, 40, CURVA, 2.5),
    ],
  },

  /** Hero do curso. */
  blob: {
    viewBox: "0 0 1000 580",
    preserveAspectRatio: "none",
    paths: [
      oculos(560, 200, 620, MARCA_DAGUA),
      curva(-60, 180, 1060, 60, 80, CURVA, 4),
      curva(-60, 640, 1060, 420, 100, CURVA_FRACA, 3),
    ],
  },

  /**
   * Faixa do certificado.
   *
   * NA CÉLULA UNITÁRIA (0..1), ao contrário das outras: o gerador do PDF escala
   * cada caminho por `largura/14` e desenha as 14 colunas. Um viewBox em pixels
   * aqui sairia 1400 vezes maior que a página.
   *
   * SEM TRAÇO, só preenchimento: o desenhador do PDF preenche caminho e não
   * pinta contorno. A "curva" vira uma lente cheia, que é a assinatura mais
   * reconhecível da marca em tamanho pequeno.
   */
  band: {
    viewBox: "0 0 1 1",
    preserveAspectRatio: "none",
    paths: [
      { d: "M 0 0.46 L 1 0.46 L 1 0.56 L 0 0.56 Z", fill: CURVA_FRACA },
      oculos(0.2, 0.28, 0.6, CURVA),
    ],
  },

  /* Quatro capas de curso, para a grade não repetir o mesmo desenho. A
     diferença é a posição da marca e a inclinação da curva, não a cor: cor por
     variante brigaria com a personalização por cliente. */
  art1: {
    viewBox: "0 0 480 270",
    preserveAspectRatio: "xMidYMid slice",
    paths: [oculos(290, 90, 300, MARCA_DAGUA), curva(-40, 50, 520, 10, 35, CURVA, 2.5)],
  },
  art2: {
    viewBox: "0 0 480 270",
    preserveAspectRatio: "xMidYMid slice",
    paths: [oculos(-60, 120, 320, MARCA_DAGUA), curva(-40, 230, 520, 90, 45, CURVA, 2.5)],
  },
  art3: {
    viewBox: "0 0 480 270",
    preserveAspectRatio: "xMidYMid slice",
    paths: [oculos(240, 150, 340, MARCA_DAGUA), curva(-40, 120, 520, 40, 50, CURVA, 2.5)],
  },
  art4: {
    viewBox: "0 0 480 270",
    preserveAspectRatio: "xMidYMid slice",
    paths: [oculos(180, 40, 280, MARCA_DAGUA), curva(-40, 200, 520, 130, 40, CURVA, 2.5)],
  },
};
