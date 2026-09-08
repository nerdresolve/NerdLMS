/**
 * O grafismo da marca, em SVG: traçado de circuito.
 *
 * A geometria vem de `@nerdlms/core/brand/mosaic.ts` e é compartilhada com o
 * gerador do protótipo e com o certificado em PDF — as três superfícies
 * desenham o mesmo grafismo por construção, não por coincidência.
 */

import { MOSAIC_SHAPES, type MosaicVariant } from "@nerdlms/core/brand/mosaic.ts";

interface BrandMosaicProps {
  variant: MosaicVariant;
  className?: string;
  /**
   * `cor` usa os acentos da marca. `silhueta` usa um só tom translúcido, com a
   * MESMA geometria.
   *
   * A distinção existe porque o grafismo colorido é assinatura: aparece uma vez
   * por tela. Repetido, vira papel de parede — numa grade de sete capas de
   * curso, sete anéis do mesmo tamanho em ritmo disputam com os títulos.
   *
   * Então: cor onde é o gráfico DA TELA, silhueta onde o elemento se repete.
   */
  tone?: "cor" | "silhueta";
}

export function BrandMosaic({ variant, className, tone = "cor" }: BrandMosaicProps) {
  const shape = MOSAIC_SHAPES[variant];

  return (
    <svg
      className={className}
      viewBox={shape.viewBox}
      preserveAspectRatio={shape.preserveAspectRatio}
      /* O anel é um círculo com furo, e o furo só existe com `evenodd`: no
         padrão `nonzero` ele fecharia e viraria um disco. */
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
    >
      {shape.paths.map((path, index) => {
        /* Trilha é traço, nó é preenchimento. Sem repassar `stroke` a trilha
           some: `fill: "none"` num caminho aberto não desenha nada. */
        const cor = tone === "silhueta" ? "var(--tile-ghost)" : undefined;
        return path.stroke ? (
          <path
            key={index}
            d={path.d}
            fill="none"
            stroke={cor ?? path.stroke}
            strokeWidth={path.strokeWidth ?? 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path key={index} d={path.d} fill={cor ?? path.fill} />
        );
      })}
    </svg>
  );
}
