/**
 * Fluid Wave — elemento gráfico proprietário (Design System §2, §19, §20).
 *
 * SVG puro colorido por tokens: independente de resolução, responsivo,
 * compatível com dark mode e sem imagem estática. A geometria vem de
 * `wave-paths.ts`, compartilhada com o gerador de preview — as duas
 * superfícies desenham a mesma onda por construção.
 */

import { WAVE_SHAPES, type WaveVariant } from "./wave-paths.ts";

interface FluidWaveProps {
  variant: WaveVariant;
  className?: string;
  /**
   * Para as variantes "edge" e "split": a cor da superfície de destino — aquela
   * sobre a qual a onda avança.
   *
   * O padrão é `--surface-card`, o mesmo token que o painel do formulário usa
   * como fundo. Antes apontava para `--color-surface`, que **não existe em
   * nenhum arquivo de tokens**: o `fill` ficava inválido, o SVG caía no preto
   * padrão, e a borda orgânica virava uma tarja preta entre as duas colunas do
   * login. Como `--surface-card` já muda no tema escuro, a onda acompanha.
   */
  edgeFill?: string;
}

export function FluidWave({ variant, className, edgeFill = "var(--surface-card)" }: FluidWaveProps) {
  const shape = WAVE_SHAPES[variant];

  return (
    <svg
      className={className}
      viewBox={shape.viewBox}
      preserveAspectRatio={shape.preserveAspectRatio}
      aria-hidden="true"
      focusable="false"
    >
      {shape.paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill={path.fill === "EDGE_FILL" ? edgeFill : (path.fill ?? "none")}
          {...(path.stroke ? { stroke: path.stroke, strokeWidth: path.strokeWidth ?? 1.5 } : {})}
        />
      ))}
    </svg>
  );
}
