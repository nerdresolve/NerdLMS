/**
 * Quantas páginas tem um PDF — sem biblioteca.
 *
 * O projeto já escreve PDF do zero (`pdf.ts`), e contar é bem mais simples que
 * gerar: a estrutura declara o total no `/Count` do nó raiz da árvore de
 * páginas, e quando não declara, basta contar os objetos `/Type /Page`.
 *
 * Isto existe porque a aula de documento precisa de um DENOMINADOR: sem saber
 * quantas páginas o arquivo tem, não há como distinguir quem leu as quarenta de
 * quem abriu a primeira — que é exatamente o critério de conclusão pedido.
 *
 * Devolve `null` quando não dá para saber. `null` e não zero: zero seria lido
 * como "documento vazio" e travaria a conclusão para sempre, enquanto `null`
 * significa "não sei" e a regra de conclusão libera.
 */

/** Acima disto, o arquivo está malformado ou é hostil. */
const MAXIMO_RAZOAVEL = 10_000;

export function countPdfPages(bytes: Uint8Array): number | null {
  if (bytes.length === 0) return null;

  /* `latin1` porque o PDF mistura texto e binário: decodificar como UTF-8
     corromperia bytes altos e poderia partir um `/Count` ao meio. Aqui só
     interessa a estrutura, que é ASCII. */
  const texto = new TextDecoder("latin1").decode(bytes);

  /* Não se exige o cabeçalho `%PDF`.

     A primeira versão recusava tudo que não começasse com ele, e isso recusaria
     PDF com lixo antes do cabeçalho — que existe — enquanto a estrutura que
     realmente interessa (`/Count`, `/Type /Page`) estaria lá.

     Um arquivo que NÃO é PDF simplesmente não tem essa estrutura, e a função
     devolve `null` por não encontrar nada. É a mesma resposta, sem recusar o
     que dava para ler. */

  /* O `/Count` da RAIZ é o total. Um PDF com páginas em árvore tem `/Count` em
     cada nó, e o da raiz é sempre o maior — por isso o máximo, e não o
     primeiro encontrado. */
  let maior = 0;
  for (const m of texto.matchAll(/\/Count\s+(\d+)/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maior) maior = n;
  }

  if (maior > 0) {
    return maior <= MAXIMO_RAZOAVEL ? maior : null;
  }

  /* Sem `/Count`: conta os objetos de página.

     `(?!s)` impede casar `/Pages`, que é o NÓ da árvore e não uma página — uma
     regex ingênua contaria os dois e o documento teria uma página a mais. */
  const paginas = [...texto.matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;

  if (paginas === 0) return null;
  return paginas <= MAXIMO_RAZOAVEL ? paginas : null;
}
