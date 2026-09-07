/**
 * Nota de zero a dez, e a segunda chance que alguém precisa conceder.
 *
 * DUAS COISAS QUE ANDAM JUNTAS
 *
 * A escala mudou de percentual para zero a dez, com aprovação em 8,0. E o
 * reteste deixou de ser autosserviço: quem reprova PEDE, e um instrutor libera
 * com comentário.
 *
 * A segunda parte é o que dá sentido à primeira. Com três tentativas livres, a
 * primeira prova vira rascunho — quem reprova refaz no mesmo minuto e ninguém
 * fica sabendo. Reprovar só significa alguma coisa se custar alguma coisa; aqui
 * custa um pedido, e a resposta fica escrita.
 */

/** Aprovação. Em escala de dez, e não em percentual, porque é o que se lê. */
export const NOTA_MINIMA = 8;

/** A escala inteira. Existe como constante para não virar `10` solto no meio da conta. */
export const NOTA_MAXIMA = 10;

/**
 * O percentual guardado no banco, convertido para a escala de dez.
 *
 * A coluna continua em percentual DE PROPÓSITO: convertê-la reescreveria toda
 * nota já lançada, e uma migração que reescreve histórico é uma migração que
 * não se pode conferir depois. O que muda é a leitura.
 *
 * Arredonda para uma casa. Duas dariam a falsa impressão de precisão que uma
 * prova de quatro questões não tem — 3 de 4 são 7,5, e não 7,50.
 */
export function notaDeDez(percentual: number): number {
  if (!Number.isFinite(percentual)) return 0;
  const bruta = (Math.max(0, Math.min(100, percentual)) / 100) * NOTA_MAXIMA;
  return Math.round(bruta * 10) / 10;
}

/** Como a nota é escrita na tela: uma casa, vírgula decimal. */
export function notaFormatada(percentual: number): string {
  return notaDeDez(percentual).toFixed(1).replace(".", ",");
}

/** Passou? A comparação é feita na escala de dez, que é a que a regra fala. */
export function aprovado(percentual: number): boolean {
  /* A tolerância cobre o arredondamento: 79,96% viram 8,0 na tela, e reprovar
     quem a tela diz que passou seria indefensável. */
  return notaDeDez(percentual) >= NOTA_MINIMA - 0.001;
}

export type StatusPedido = "pending" | "approved" | "denied";

export interface EstadoDoReteste {
  /** Tentativas já enviadas. */
  tentativasUsadas: number;
  /** Retestes aprovados até agora. */
  retestesAprovados: number;
  /** Há pedido esperando decisão? */
  pedidoPendente: boolean;
  /** Já passou? Quem passou não precisa de reteste. */
  jaAprovado: boolean;
}

export type AcaoDoAluno =
  | { tipo: "fazer" }
  | { tipo: "pedir-reteste" }
  | { tipo: "aguardando" }
  | { tipo: "aprovado" }
  | { tipo: "sem-saida" };

/**
 * O que o aluno pode fazer agora.
 *
 * Uma função só, e a tela apenas desenha o que ela devolver. A alternativa —
 * cada tela decidindo com `if`s próprios — faz o botão aparecer numa e não na
 * outra, e ninguém descobre até alguém reclamar de não conseguir pedir.
 *
 * A conta das tentativas: uma de saída, mais uma por reteste aprovado. Quem
 * teve dois retestes aprovados tem três no total.
 */
export function acaoDoAluno(estado: EstadoDoReteste): AcaoDoAluno {
  if (estado.jaAprovado) return { tipo: "aprovado" };

  const permitidas = 1 + estado.retestesAprovados;

  if (estado.tentativasUsadas < permitidas) return { tipo: "fazer" };
  if (estado.pedidoPendente) return { tipo: "aguardando" };

  return { tipo: "pedir-reteste" };
}

/** O texto que a tela mostra para cada situação. */
export const MENSAGEM_DA_ACAO: Record<AcaoDoAluno["tipo"], string> = {
  fazer: "Fazer a prova",
  "pedir-reteste": "Solicitar reteste",
  aguardando: "Reteste solicitado, aguardando o instrutor",
  aprovado: "Aprovado",
  "sem-saida": "Prova indisponível",
};

export type DecisaoInput = {
  status: "approved" | "denied";
  comentario: string;
};

export type DecisaoResultado =
  | { ok: true; comentario: string }
  | { ok: false; erro: string };

/**
 * Valida a decisão do instrutor.
 *
 * O COMENTÁRIO É OBRIGATÓRIO, nos dois sentidos — aprovar e recusar. Uma
 * aprovação sem justificativa é um clique; com ela, existe registro de por que
 * aquela pessoa teve uma chance a mais, que é o que alguém vai querer entender
 * meses depois. E uma recusa sem motivo é a pior mensagem que um aluno pode
 * receber.
 *
 * O banco também exige, pelo `CHECK` da migração 038: a regra existe nos dois
 * lugares de propósito, porque um `INSERT` fora deste caminho não deve
 * conseguir gravar decisão muda.
 */
export function validarDecisao(input: DecisaoInput): DecisaoResultado {
  const comentario = input.comentario.trim();

  if (comentario.length < 3) {
    return {
      ok: false,
      erro:
        input.status === "approved"
          ? "Escreva por que está liberando o reteste."
          : "Escreva por que o reteste não foi liberado.",
    };
  }

  if (comentario.length > 1000) {
    return { ok: false, erro: "O comentário é longo demais." };
  }

  return { ok: true, comentario };
}
