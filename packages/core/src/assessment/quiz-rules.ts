/**
 * Regras da prova — F3-03.
 *
 * Janela de realização, tempo, tentativas e randomização. Puras: as mesmas
 * decisões valem no servidor (que autoriza) e na tela (que explica).
 */

export type GradingMethod = "best" | "last" | "average" | "first";

export interface QuizSettings {
  passingScore: number;
  gradingMethod: GradingMethod;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  /** ISO 8601 com fuso. */
  opensAt?: string;
  closesAt?: string;
  /** Tolerância depois do fechamento, em minutos. */
  graceMinutes: number;
}

export type AttemptRefusal = "not_open" | "closed" | "no_attempts_left";

export const ATTEMPT_REFUSAL_MESSAGE: Record<AttemptRefusal, string> = {
  not_open: "Esta prova ainda não abriu.",
  closed: "Esta prova já foi encerrada.",
  no_attempts_left: "Você já usou todas as tentativas.",
};

export type AttemptDecision = { allow: true } | { allow: false; reason: AttemptRefusal };

/** O fechamento efetivo, já com o grace period. */
function effectiveClose(quiz: QuizSettings): Date | null {
  if (!quiz.closesAt) return null;

  const fecha = new Date(quiz.closesAt);
  return new Date(fecha.getTime() + quiz.graceMinutes * 60_000);
}

/**
 * Se dá para começar mais uma tentativa.
 *
 * A ordem das recusas importa para a mensagem ser útil: uma prova fechada e com
 * tentativas esgotadas informa o FECHAMENTO — dizer "sem tentativas" sugeriria
 * que esperar resolve, e não resolve.
 */
export function canStartAttempt(
  quiz: QuizSettings,
  tentativasUsadas: number,
  agora: Date,
): AttemptDecision {
  if (quiz.opensAt && agora < new Date(quiz.opensAt)) {
    return { allow: false, reason: "not_open" };
  }

  const fecha = effectiveClose(quiz);
  if (fecha && agora > fecha) return { allow: false, reason: "closed" };

  if (quiz.maxAttempts !== undefined && tentativasUsadas >= quiz.maxAttempts) {
    return { allow: false, reason: "no_attempts_left" };
  }

  return { allow: true };
}

/**
 * Até quando esta tentativa pode ser enviada.
 *
 * Dois tetos, e vale o menor: o cronômetro da tentativa e o fechamento da
 * prova. Começar trinta minutos antes de fechar não dá sessenta minutos de
 * prova — e ignorar isso deixaria a tentativa aberta depois do encerramento.
 */
export function deadlineFor(quiz: QuizSettings, iniciadaEm: Date): Date | null {
  const porTempo = quiz.timeLimitMinutes
    ? new Date(iniciadaEm.getTime() + quiz.timeLimitMinutes * 60_000)
    : null;

  const porJanela = effectiveClose(quiz);

  if (porTempo && porJanela) return porTempo < porJanela ? porTempo : porJanela;
  return porTempo ?? porJanela;
}

/** Se o prazo já passou. */
export function isExpired(quiz: QuizSettings, iniciadaEm: Date, agora: Date): boolean {
  const prazo = deadlineFor(quiz, iniciadaEm);
  return prazo !== null && agora > prazo;
}

/**
 * A nota que vale, entre várias tentativas.
 *
 * `null` sem tentativa nenhuma — e não zero. Zero é a nota de quem fez a prova
 * e errou tudo; quem não fez não tem nota, e confundir as duas reprovaria quem
 * ainda vai prestar.
 */
export function finalScore(percentuais: number[], metodo: GradingMethod): number | null {
  if (percentuais.length === 0) return null;

  switch (metodo) {
    case "best":
      return Math.max(...percentuais);
    case "last":
      return percentuais[percentuais.length - 1]!;
    case "first":
      return percentuais[0]!;
    case "average": {
      const soma = percentuais.reduce((total, n) => total + n, 0);
      return Math.round((soma / percentuais.length) * 100) / 100;
    }
  }
}

/**
 * Embaralha de forma ESTÁVEL, a partir de uma semente.
 *
 * A ordem precisa sobreviver a recarregar a página: com `Math.random()`, a
 * questão 3 vira outra ao atualizar, e quem já respondeu perde a referência do
 * que respondeu. A semente é o id da tentativa, então a ordem é a mesma
 * enquanto aquela tentativa durar e diferente na próxima.
 *
 * Não é aleatoriedade criptográfica — e não precisa ser: o que se quer é que
 * duas pessoas vejam ordens diferentes, não que a ordem seja imprevisível para
 * um adversário.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const lista = [...items];
  if (lista.length < 2) return lista;

  /* Hash simples da semente (FNV-1a de 32 bits). */
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  /* Gerador linear congruente: determinístico e suficiente aqui. */
  let estado = h >>> 0;
  const proximo = () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 4294967296;
  };

  /* Fisher-Yates, de trás para frente. */
  for (let i = lista.length - 1; i > 0; i -= 1) {
    const j = Math.floor(proximo() * (i + 1));
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
  }

  return lista;
}

/* ---------------------------------------------------------------------------
   A escolha, num lugar só
   --------------------------------------------------------------------------- */

/** O mínimo que esta decisão precisa saber sobre uma tentativa. */
export interface TentativaRegistrada {
  startedAt: string | Date;
  submittedAt?: string | Date | undefined;
}

/** `"nova"` cria; uma tentativa devolve ELA; `null` recusa. */
export type EscolhaDeTentativa<T> = "nova" | T | null;

/**
 * O que fazer diante das tentativas que já existem.
 *
 * POR QUE ISTO SAIU DO CASO DE USO
 *
 * A decisão precisa acontecer DUAS vezes: uma na leitura solta, para a resposta
 * saber dizer "a prova está fechada" ou "solicite um reteste"; outra dentro da
 * trava do banco, com os dados relidos, e essa é a que vale. Duas cópias da
 * mesma regra é como o teto de tentativas deixaria de existir de novo — a
 * segunda envelheceria calada.
 *
 * `maxAttempts` aqui já é o teto EFETIVO: o da prova mais os retestes
 * aprovados. Quem chama faz essa soma, porque é ela que conhece os retestes.
 *
 * A TENTATIVA ABERTA VOLTA, NÃO CONSOME
 *
 * Recarregar a página não pode gastar uma chance. Se há tentativa sem envio e
 * dentro do prazo, ela é a resposta — e é justamente isso que faz dezesseis
 * pedidos simultâneos devolverem 200 dezesseis vezes tendo criado UMA linha.
 *
 * ABANDONADA NÃO CONTA COMO USADA
 *
 * Só o envio consome. Quem abriu a prova, perdeu a conexão e deixou o prazo
 * vencer não gastou a chance — a tentativa vencida fica no histórico e uma
 * nova pode nascer. Contar o abandono puniria queda de rede como se fosse
 * resposta errada.
 */
export function escolhaDaTentativa<T extends TentativaRegistrada>(
  quiz: QuizSettings,
  anteriores: readonly T[],
  agora: Date,
): EscolhaDeTentativa<T> {
  const aberta = anteriores.find((tentativa) => !tentativa.submittedAt);

  if (aberta && !isExpired(quiz, new Date(aberta.startedAt), agora)) return aberta;

  const enviadas = anteriores.filter((tentativa) => tentativa.submittedAt).length;

  return canStartAttempt(quiz, enviadas, agora).allow ? "nova" : null;
}
