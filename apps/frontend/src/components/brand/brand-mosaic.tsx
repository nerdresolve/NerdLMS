/**
 * O grafismo da Exemplo S.A., em SVG.
 *
 * Substitui o `FluidWave`: a onda era a assinatura de outra marca, e nenhuma
 * curva orgânica aparece no material da Exemplo S.A.. A geometria vem de
 * `@nerdlms/core/brand/mosaic.ts`, extraída do arquivo oficial do site institucional e
 * compartilhada com o gerador do protótipo — as duas superfícies desenham o
 * mesmo grafismo por construção.
 */

import { MOSAIC_SHAPES, type MosaicVariant } from "@nerdlms/core/brand/mosaic.ts";

interface BrandMosaicProps {
  variant: MosaicVariant;
  className?: string;
  /**
   * `cor` usa as quatro cores da marca. `silhueta` usa um só branco
   * translúcido, com a MESMA geometria.
   *
   * A distinção existe porque no site institucional o grafismo colorido
   * aparece UMA vez — o banner da home — e em nenhuma outra página. Repetido,
   * ele deixa de ser assinatura e vira papel de parede: numa grade de sete
   * capas de curso viravam sete anéis amarelos do mesmo tamanho, em ritmo,
   * disputando com os títulos.
   *
   * Então: cor onde é o gráfico DA TELA, silhueta onde o elemento se repete.
   * A forma continua sendo a mesma, e é ela que carrega o reconhecimento.
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
      {shape.paths.map((path, index) => (
        <path key={index} d={path.d} fill={tone === "silhueta" ? "var(--tile-ghost)" : path.fill} />
      ))}
    </svg>
  );
}
