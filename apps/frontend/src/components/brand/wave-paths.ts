/**
 * Geometria do Fluid Wave (Design System §20).
 *
 * As formas vivem aqui como dados para que o componente React e o gerador de
 * preview desenhem exatamente a mesma onda — sem duas versões para divergir.
 * As cores vêm sempre de token: trocar `--wave-*` adapta tudo ao dark mode.
 */

export type WaveVariant = "horizontal" | "vertical" | "layered" | "organic" | "blob" | "band" | "split" | "edge";

export interface WavePath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface WaveShape {
  viewBox: string;
  preserveAspectRatio: string;
  paths: WavePath[];
}

export const WAVE_SHAPES: Record<WaveVariant, WaveShape> = {
  /** Wave A — curva ampla horizontal. */
  horizontal: {
    viewBox: "0 0 800 420",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      { d: "M-40,236 C140,150 300,320 470,236 C610,166 720,232 840,180 L840,460 L-40,460 Z", fill: "var(--wave-2)" },
      { d: "M-40,320 C120,250 320,380 500,300 C640,238 740,290 840,250 L840,460 L-40,460 Z", fill: "var(--wave-1)" },
      { d: "M-40,196 C160,110 300,270 480,190 C620,128 730,186 840,140", fill: "none", stroke: "var(--wave-line)", strokeWidth: 1.5 },
    ],
  },

  /** Wave B — curva vertical assimétrica (painel de login). */
  vertical: {
    viewBox: "0 0 520 720",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      { d: "M-40,96 C120,30 268,196 208,344 C160,462 34,506 -12,660 L-40,660 Z", fill: "var(--wave-2)" },
      { d: "M560,-40 C420,72 502,232 384,330 C264,430 348,606 262,760 L560,760 Z", fill: "var(--wave-1)" },
      { d: "M-40,470 C96,392 176,540 322,452 C426,390 494,432 560,376 L560,760 L-40,760 Z", fill: "var(--wave-3)" },
      { d: "M-40,556 C110,478 190,614 336,528 C438,468 500,514 560,462", fill: "none", stroke: "var(--wave-line)", strokeWidth: 1.5 },
    ],
  },

  /** Wave C — múltiplas ondas sobrepostas (hero do dashboard). */
  layered: {
    viewBox: "0 0 900 360",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      { d: "M420,-60 C560,40 520,180 640,250 C740,308 820,286 960,340 L960,-60 Z", fill: "var(--wave-1)" },
      { d: "M540,-60 C660,30 620,160 740,224 C820,266 890,254 960,290 L960,-60 Z", fill: "var(--wave-2)" },
      { d: "M-60,300 C120,246 260,352 440,306 C560,276 660,320 960,268 L960,420 L-60,420 Z", fill: "var(--wave-3)" },
      { d: "M-60,258 C140,196 280,306 470,254 C600,218 720,258 960,214", fill: "none", stroke: "var(--wave-line)", strokeWidth: 1.5 },
    ],
  },

  /** Wave D — forma orgânica abstrata (capas de curso). */
  organic: {
    viewBox: "0 0 480 270",
    preserveAspectRatio: "xMidYMid slice",
    paths: [
      { d: "M330,-40 C400,40 350,120 400,170 C436,206 470,206 520,240 L520,-40 Z", fill: "var(--wave-1)" },
      { d: "M-40,190 C60,140 130,220 230,180 C300,152 360,190 520,150 L520,310 L-40,310 Z", fill: "var(--wave-2)" },
      { d: "M-40,150 C70,100 140,180 250,140 C330,112 390,150 520,110", fill: "none", stroke: "var(--wave-line)", strokeWidth: 1.5 },
    ],
  },

  /**
   * Blob — geometria oficial do pacote (`components/brand/Wave.jsx`, shape
   * "blob"), usada atrás do hero do curso. Mantida idêntica à do pacote.
   */
  blob: {
    viewBox: "0 0 1000 580",
    preserveAspectRatio: "none",
    paths: [
      {
        d: "M540,60 C700,60 820,170 800,320 C782,458 640,540 500,520 C340,498 200,400 210,260 C220,124 380,60 540,60 Z",
        fill: "var(--wave-2)",
      },
      {
        d: "M540,60 C700,60 820,170 800,320 C782,458 640,540 500,520 C340,498 200,400 210,260 C220,124 380,60 540,60 Z",
        fill: "none",
        stroke: "var(--wave-line)",
        strokeWidth: 2,
      },
    ],
  },

  /**
   * Band — geometria oficial do pacote (shape "band"), usada como faixa suave
   * ao pé de estados vazios.
   */
  band: {
    viewBox: "0 0 1000 300",
    preserveAspectRatio: "none",
    paths: [
      {
        d: "M0,120 C180,40 320,190 520,140 C700,96 820,10 1000,60 L1000,300 L0,300 Z",
        fill: "var(--wave-soft)",
      },
    ],
  },

  /**
   * Split — a borda orgânica vertical entre o painel de marca e o formulário,
   * como na referência: o violeta avança em curva sobre a superfície clara.
   * O preenchimento é a cor de destino, passado por `edgeFill`.
   */
  split: {
    viewBox: "0 0 100 1000",
    preserveAspectRatio: "none",
    paths: [
      {
        d: "M100,0 L46,0 C92,170 8,330 52,500 C94,662 14,806 58,1000 L100,1000 Z",
        fill: "EDGE_FILL",
      },
    ],
  },

  /** Borda ondulada de transição entre duas superfícies. */
  edge: {
    viewBox: "0 0 390 36",
    preserveAspectRatio: "none",
    paths: [{ d: "M0,20 C70,-6 132,34 200,20 C268,6 330,26 390,12 L390,36 L0,36 Z", fill: "EDGE_FILL" }],
  },
};
