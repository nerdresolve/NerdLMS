/**
 * O grafismo da organização — a grade de formas coloridas.
 *
 * NÃO é invenção nossa. Sai de `img-formas-coloridas-banner-home.svg`, do site
 * institucional: uma grade 6×6 de células de 109,64px, cada célula com UMA de
 * cinco formas, e a cor fixa por forma. As formas abaixo foram normalizadas
 * para a célula unitária a partir daquele arquivo, e a composição em
 * `BRANDING_GRID` é a de lá, célula a célula, conferida por comparação de
 * pixel contra as quatro rotações de cada primitiva.
 *
 * Substituiu a "Fluid Wave" — a onda era a assinatura gráfica de outra marca.
 * Curva orgânica não é o vocabulário da organização: aqui tudo é módulo,
 * canto reto e círculo.
 *
 * A COR É PROPRIEDADE DA FORMA, não da posição. É o que faz o grafismo ser
 * reconhecível mesmo num recorte de três células: meia-lua é azul, canto é
 * navy, triângulo é amarelo, folha é verde, anel é o ouro mais fechado.
 * Trocar a cor de uma forma descaracteriza o desenho.
 *
 * Mora no DOMÍNIO, e não no app, porque tem três consumidores: o componente
 * React, o gerador do protótipo e o CERTIFICADO EM PDF. Os três desenham o
 * mesmo grafismo por construção, não por coincidência — e o certificado é
 * gerado no servidor, longe de qualquer CSS.
 *
 * As cores saem como `var(--tile-…)` porque o consumidor majoritário é a web;
 * quem desenha fora do navegador (o PDF) resolve o token pela própria paleta.
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
}

export interface MosaicShape {
  viewBox: string;
  preserveAspectRatio: string;
  paths: MosaicPath[];
}

type Forma = "meia" | "canto" | "triangulo" | "folha" | "anel";

/**
 * As cinco primitivas, na célula unitária.
 *
 * Só `M`, `L`, `C` e `Z`, com coordenadas absolutas: assim todo número é
 * metade de um par (x, y) e a rotação abaixo pode transformá-los aos pares,
 * sem interpretar comando nenhum. Um `H` ou `V` quebraria essa premissa.
 */
const FORMAS: Record<Forma, string> = {
  /** Meia-lua: metade de cima reta, metade de baixo semicírculo. */
  meia: "M0 0.5L0 0L1 0L1 0.5C1 0.776 0.776 1 0.5 1C0.224 1 0 0.776 0 0.5Z",
  /** Quadrado com dois cantos OPOSTOS arredondados. */
  canto: "M1 1L0.5 1C0.224 1 0 0.776 0 0.5L0 0L0.5 0C0.776 0 1 0.224 1 0.5L1 1Z",
  /** Triângulo retângulo, ângulo reto no canto superior esquerdo. */
  triangulo: "M1 0L0 0L0 1L1 0Z",
  /** A folha do símbolo: dois arcos de canto a canto. */
  folha: "M1 0C1 0.552 0.552 1 0 1C0 0.448 0.448 0 1 0Z",
  /** Anel: círculo cheio com furo. Depende de `fill-rule: evenodd`. */
  anel:
    "M0.5 0C0.776 0 1 0.224 1 0.5C1 0.776 0.776 1 0.5 1C0.224 1 0 0.776 0 0.5C0 0.224 0.224 0 0.5 0Z" +
    "M0.5 0.731C0.372 0.731 0.269 0.628 0.269 0.5C0.269 0.372 0.372 0.269 0.5 0.269" +
    "C0.628 0.269 0.731 0.372 0.731 0.5C0.731 0.628 0.628 0.731 0.5 0.731Z",
};

/** A cor de cada forma. Fixa — ver o cabeçalho. */
const COR: Record<Forma, string> = {
  meia: "var(--tile-blue)",
  canto: "var(--tile-navy)",
  triangulo: "var(--tile-sun)",
  folha: "var(--tile-leaf)",
  anel: "var(--tile-ring)",
};

type Celula = [Forma, number];

/** A composição oficial, 6×6, na ordem [linha][coluna]. */
const BRANDING_GRID: Celula[][] = [
  [["anel", 0], ["folha", 0], ["canto", 0], ["folha", 90], ["anel", 0], ["meia", 180]],
  [["canto", 90], ["triangulo", 0], ["meia", 0], ["triangulo", 90], ["meia", 180], ["canto", 0]],
  [["meia", 0], ["anel", 0], ["folha", 90], ["canto", 0], ["folha", 0], ["triangulo", 270]],
  [["canto", 90], ["folha", 90], ["triangulo", 0], ["meia", 180], ["anel", 0], ["folha", 0]],
  [["triangulo", 180], ["meia", 0], ["canto", 90], ["canto", 0], ["triangulo", 270], ["meia", 180]],
  [["folha", 0], ["anel", 0], ["meia", 0], ["anel", 0], ["folha", 90], ["canto", 90]],
];

const LADO = BRANDING_GRID.length;

/**
 * Gira o path em torno do centro da célula e o desloca para (coluna, linha).
 *
 * A rotação é feita nos NÚMEROS, não num atributo `transform`: o path já sai
 * pronto, e quem desenha — React ou o gerador do protótipo — não precisa saber
 * que existe rotação. Um `transform` também obrigaria os dois renderizadores a
 * repassar o atributo, e é exatamente o tipo de detalhe que diverge.
 */
function posicionar(d: string, giro: number, coluna: number, linha: number): string {
  const numeros = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pronto: string[] = [];

  for (let i = 0; i < numeros.length; i += 2) {
    const x = numeros[i]!;
    const y = numeros[i + 1]!;
    const [rx, ry] =
      giro === 90 ? [1 - y, x] : giro === 180 ? [1 - x, 1 - y] : giro === 270 ? [y, 1 - x] : [x, y];
    pronto.push(arredonda(rx + coluna), arredonda(ry + linha));
  }

  /* Substitui número por número, na ordem, e não toca em mais nada: letras de
     comando e espaços continuam onde estavam, então o path segue válido sem
     este código precisar entender `M`, `L`, `C` ou `Z`. */
  let indice = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, () => pronto[indice++]!);
}

function arredonda(valor: number): string {
  return String(Math.round(valor * 1000) / 1000);
}

/**
 * Um recorte da grade oficial, com `colunas × linhas` células.
 *
 * O deslocamento é o que dá variedade sem inventar composição: cada superfície
 * enquadra um pedaço diferente do MESMO grafismo. A grade se repete, então
 * qualquer tamanho é atendido.
 */
function recorte(colunas: number, linhas: number, deslocaColuna: number, deslocaLinha: number): MosaicShape {
  const paths: MosaicPath[] = [];

  for (let linha = 0; linha < linhas; linha += 1) {
    for (let coluna = 0; coluna < colunas; coluna += 1) {
      const [forma, giro] = BRANDING_GRID[(linha + deslocaLinha) % LADO]![(coluna + deslocaColuna) % LADO]!;
      paths.push({ d: posicionar(FORMAS[forma], giro, coluna, linha), fill: COR[forma] });
    }
  }

  return { viewBox: `0 0 ${colunas} ${linhas}`, preserveAspectRatio: "xMidYMid slice", paths };
}

/**
 * Um recorte por superfície. `slice` em todos: o grafismo é modular, e esticar
 * uma célula deixaria o círculo oval — que é o erro mais visível que se pode
 * cometer com ele.
 */
export const MOSAIC_SHAPES: Record<MosaicVariant, MosaicShape> = {
  /** Painel de marca do login: alto e estreito. */
  vertical: recorte(2, 5, 0, 0),
  /** Capa de curso larga. */
  horizontal: recorte(5, 2, 2, 0),
  /** Hero do dashboard e a arte da landing. */
  layered: recorte(4, 3, 1, 2),
  /** Peça pequena: capa de curso, ladrilho da landing. */
  organic: recorte(3, 2, 3, 4),
  /** Hero de curso, de perfil e o cartão de nível. */
  blob: recorte(8, 3, 2, 1),
  /** Faixa: estado vazio e a régua de números da landing. Uma linha só — com
      duas, a altura da faixa cortava a segunda no meio e as formas ficavam
      decepadas. */
  band: recorte(14, 1, 0, 3),

  /* Capas de curso. TODAS com o mesmo tamanho de célula, e pequeno — três por
     quatro células numa capa de 350px dá formas grandes, que se leem de
     relance. O que muda entre elas é só o enquadramento.

     Uma delas já foi um recorte de 7×4: vinte e oito formas miúdas num cartão
     de 200px de altura. Sozinha parecia rica; ao lado das outras três numa
     grade, virava ruído — e o olho não tinha onde descansar. O grafismo da
     a organização funciona por repetição em ESCALA, não por densidade. */
  art1: recorte(2, 2, 0, 0),
  art2: recorte(2, 2, 3, 2),
  art3: recorte(2, 2, 1, 4),
  art4: recorte(2, 2, 4, 1),
};
