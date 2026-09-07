/**
 * Flexão do rótulo da unidade organizacional.
 *
 * A palavra que nomeia a unidade é escolha do cliente — "Concessionária" para
 * uma concessionária, "Filial" para uma rede de varejo, "Diretoria" para uma estatal — e
 * aparece no meio de frases: "Visão consolidada de todas as concessionárias".
 * Sem flexionar, a legenda ficaria "de todas as Concessionária".
 *
 * Vive no domínio, e não no componente, para o servidor também poder usá-la:
 * há telas que montam esse texto sem passar pelo contexto do React.
 */

/**
 * Plural em português.
 *
 * Regra suficiente para os termos que um cliente usa nesse papel: terminação em
 * `l` vira `is` (filial → filiais), em `r`/`s`/`z` ganha `es` (setor → setores),
 * e o resto ganha `s`. Um termo irregular produziria um plural desajeitado numa
 * legenda — o que é preferível a exigir que o cliente cadastre duas palavras.
 */
export function pluralOfUnit(label: string): string {
  const lower = label.toLocaleLowerCase("pt-BR").trim();
  if (!lower) return "unidades";
  if (lower.endsWith("l")) return `${lower.slice(0, -1)}is`;
  if (/[rsz]$/.test(lower)) return `${lower}es`;
  return `${lower}s`;
}

/** O rótulo em minúsculas, para o meio de uma frase. */
export function lowerUnit(label: string): string {
  return label.toLocaleLowerCase("pt-BR").trim() || "unidade";
}
