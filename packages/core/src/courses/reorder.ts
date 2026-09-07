/**
 * Reordenação de módulos e aulas — F2-06.
 *
 * A regra é pura e mora aqui porque roda nos dois lados: no cliente, para a
 * lista se mover na hora do gesto (arrastar ou apertar a seta), e no servidor,
 * para gravar as posições. Duplicá-la faria a tela e o banco discordarem sobre
 * onde o item ficou.
 */

/**
 * Move o item de `from` para `to`, devolvendo uma lista NOVA.
 *
 * Índice inválido devolve a lista intacta em vez de lançar: o botão "subir" da
 * primeira aula e o "descer" da última chegam aqui naturalmente, e a tela não
 * teria o que fazer com um erro que ela mesma poderia evitar. Ela desabilita
 * esses botões; isto é a segunda linha.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...list];
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];

  const copia = [...list];
  const [item] = copia.splice(from, 1);
  if (item === undefined) return [...list];

  copia.splice(to, 0, item);
  return copia;
}

export interface PositionUpdate {
  id: string;
  position: number;
}

/**
 * A lista ordenada vira as posições a gravar.
 *
 * Começa em 1, como a 001 gravou (`index + 1`). Renumera tudo em vez de mexer
 * só no que mudou: o banco pode ter 1, 5, 9 por causa de remoções antigas, e
 * uma renumeração parcial deixaria buracos que fazem a próxima inserção
 * calcular a posição errada.
 */
export function reorderPositions(ids: readonly string[]): PositionUpdate[] {
  return ids.map((id, index) => ({ id, position: index + 1 }));
}
