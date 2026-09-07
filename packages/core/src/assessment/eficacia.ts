/**
 * Avaliação de eficácia do treinamento.
 *
 * Concluir o curso prova que a pessoa assistiu e passou na prova. Não prova que
 * ela faz o trabalho diferente por causa disso — e é essa a pergunta que uma
 * fiscalização faz. Por isso o instrutor volta, algum tempo depois, e registra
 * se o treinamento surtiu efeito no desempenho.
 *
 * O prazo existe para a avaliação não virar "quando der": tarde demais, ninguém
 * lembra do antes para comparar com o depois.
 *
 * O QUE ESTE MÓDULO NÃO DECIDE
 *
 * Se o registro basta para a norma que se pretende cumprir. Ele guarda quem
 * avaliou, quando, com que veredito e com que observação — o que uma auditoria
 * pede ver. Se o procedimento da empresa exige mais (evidência anexa, segunda
 * assinatura, reavaliação periódica), isso é decisão de quem responde pela
 * conformidade, não deste arquivo.
 *
 * Recebe datas e devolve situação. A consulta fica no repositório.
 */

/**
 * Quantos dias o instrutor tem para avaliar, contados da conclusão.
 *
 * Um número só, e não uma configuração por curso: hoje a regra é a mesma para
 * todo treinamento. O dia em que um curso precisar de prazo próprio, o lugar de
 * colocá-lo é uma coluna em `courses`, e esta constante vira o padrão.
 */
export const PRAZO_DA_AVALIACAO_DIAS = 90;

/**
 * A partir de quantos dias restantes a avaliação entra em alerta.
 *
 * Quinze dias é tempo de agendar uma conversa com a pessoa e o supervisor dela.
 * Alertar no último dia seria avisar quando já não dá para fazer nada.
 */
export const ALERTA_EM_DIAS = 15;

const DIA_EM_MS = 24 * 60 * 60 * 1000;

export type SituacaoDaEficacia = "avaliada" | "no-prazo" | "vence-em-breve" | "vencida";

export interface EntradaDaEficacia {
  /** Quando a pessoa concluiu o curso. */
  concluidoEm: Date;
  /** Quando o instrutor registrou a avaliação, ou `null` se ainda não. */
  avaliadoEm?: Date | null;
  /** O agora, injetado para o cálculo ser testável. */
  hoje: Date;
}

/** O último dia para avaliar. */
export function prazoDaAvaliacao(concluidoEm: Date): Date {
  return new Date(concluidoEm.getTime() + PRAZO_DA_AVALIACAO_DIAS * DIA_EM_MS);
}

/**
 * Dias que faltam para o prazo. Negativo quando já passou.
 *
 * Contado em dias inteiros para cima: com 0,3 dia restante ainda resta "1 dia",
 * porque quem lê "faltam 0 dias" entende que já perdeu.
 */
export function diasRestantes({ concluidoEm, hoje }: Omit<EntradaDaEficacia, "avaliadoEm">): number {
  const restante = prazoDaAvaliacao(concluidoEm).getTime() - hoje.getTime();
  return Math.ceil(restante / DIA_EM_MS);
}

/**
 * Em que pé está a avaliação desta conclusão.
 *
 * Avaliada é avaliada, mesmo fora do prazo: registrar em atraso é melhor que
 * não registrar, e apagar o registro por causa da data destruiria a evidência
 * que a avaliação existe para produzir. O atraso fica visível pela data, não
 * pela ausência.
 */
export function situacaoDaEficacia(entrada: EntradaDaEficacia): SituacaoDaEficacia {
  if (entrada.avaliadoEm) return "avaliada";

  const faltam = diasRestantes(entrada);

  if (faltam <= 0) return "vencida";
  if (faltam <= ALERTA_EM_DIAS) return "vence-em-breve";
  return "no-prazo";
}

/** Como a fila do instrutor descreve o prazo, em uma linha. */
export function prazoEmPalavras(entrada: EntradaDaEficacia): string {
  const situacao = situacaoDaEficacia(entrada);

  if (situacao === "avaliada") return "Avaliada";

  const faltam = diasRestantes(entrada);

  if (faltam <= 0) {
    const atraso = Math.abs(faltam);
    return atraso === 1 ? "Venceu ontem" : `Venceu há ${atraso} dias`;
  }

  return faltam === 1 ? "Vence amanhã" : `Faltam ${faltam} dias`;
}

/**
 * A ordem da fila: o que vence primeiro aparece primeiro.
 *
 * Vencidas no topo, e entre elas a mais antiga — é a que está esperando há mais
 * tempo. Ordenar por data de conclusão dá exatamente isso, porque o prazo é
 * sempre a conclusão mais um número fixo de dias.
 */
export function ordemDaFila<T extends { concluidoEm: Date }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => a.concluidoEm.getTime() - b.concluidoEm.getTime());
}

/** O veredito do instrutor sobre o efeito do treinamento no trabalho. */
export const VEREDITOS = {
  efetivo: "O treinamento surtiu efeito no desempenho",
  parcial: "Surtiu efeito em parte; há pontos a reforçar",
  inefetivo: "Não surtiu efeito; precisa de nova ação",
} as const;

export type Veredito = keyof typeof VEREDITOS;

export function ehVeredito(valor: unknown): valor is Veredito {
  return typeof valor === "string" && valor in VEREDITOS;
}
