/**
 * Livro de notas e entrega de trabalhos — F3-05, F3-08, F3-09.
 *
 * A nota é LANÇAMENTO, não campo: `grade_entries` é append-only, e a nota
 * vigente de uma atividade é a última lançada. Ver o comentário da 012.
 */

export interface GradeEntry {
  id: string;
  /** A prova ou o trabalho avaliado. */
  activityId: string;
  activityKind: "quiz" | "assignment";
  pointsEarned: number;
  pointsPossible: number;
  /** Peso na nota final do curso. */
  weight: number;
  /** ISO 8601. Decide qual lançamento vale. */
  createdAt: string;
  feedback?: string;
  reason?: string;
}

/**
 * A nota vigente de cada atividade.
 *
 * A comparação é pela DATA, não pela ordem de chegada: depender da ordem
 * deixaria a regra refém da cláusula `ORDER BY` de quem consultou — e uma
 * consulta futura sem ordenação faria a nota antiga vencer a revisão.
 */
export function currentGrades(entries: GradeEntry[]): GradeEntry[] {
  const porAtividade = new Map<string, GradeEntry>();

  for (const entry of entries) {
    const atual = porAtividade.get(entry.activityId);
    if (!atual || entry.createdAt > atual.createdAt) {
      porAtividade.set(entry.activityId, entry);
    }
  }

  return [...porAtividade.values()];
}

/**
 * A nota final do curso, em percentual.
 *
 * Média ponderada dos percentuais de cada atividade, usando só a nota vigente —
 * sem isso uma reavaliação contaria duas vezes.
 *
 * `null` quando não há atividade avaliada, e não zero: quem ainda não fez prova
 * nenhuma não tirou zero, e mostrar zero reprovaria antecipadamente quem está
 * no meio do curso.
 */
export function courseGrade(entries: GradeEntry[]): number | null {
  const vigentes = currentGrades(entries);
  if (vigentes.length === 0) return null;

  let somaPesos = 0;
  let somaPonderada = 0;

  for (const nota of vigentes) {
    if (nota.weight <= 0 || nota.pointsPossible <= 0) continue;

    const percentual = (nota.pointsEarned / nota.pointsPossible) * 100;
    somaPonderada += percentual * nota.weight;
    somaPesos += nota.weight;
  }

  /* Tudo com peso zero: não há nota, e dividir aqui daria NaN na tela. */
  if (somaPesos === 0) return null;

  return Math.round((somaPonderada / somaPesos) * 100) / 100;
}

/**
 * Se a nota atinge o mínimo exigido para o certificado — F3-09.
 *
 * Sem exigência declarada, concluir as aulas basta: é o comportamento de hoje,
 * e cursos existentes não podem passar a exigir uma prova que não têm.
 *
 * Com exigência e SEM nota, bloqueia. Quem não foi avaliado não atingiu o
 * mínimo — liberar daria certificado a quem não fez a prova, que é o oposto do
 * ponto de exigir nota.
 */
export function meetsCertificateGrade(
  minimo: number | undefined,
  notaAtual: number | null,
): boolean {
  if (minimo === undefined) return true;
  if (notaAtual === null) return false;

  return notaAtual >= minimo;
}

export interface SubmissionRules {
  dueAt?: string;
  latePolicy: "block" | "accept" | "penalty";
  latePenaltyPercent: number;
  maxAttempts?: number;
}

export type SubmissionRefusal = "past_due" | "no_attempts_left";

export const SUBMISSION_REFUSAL_MESSAGE: Record<SubmissionRefusal, string> = {
  past_due: "O prazo de entrega já passou.",
  no_attempts_left: "Você já usou todas as tentativas de envio.",
};

export type SubmissionDecision =
  | { allow: true; late: boolean }
  | { allow: false; reason: SubmissionRefusal };

/**
 * Se dá para entregar, e se a entrega conta como atrasada.
 *
 * O atraso volta junto com a permissão porque as duas coisas se decidem no
 * mesmo instante: gravar "entregou" sem gravar "atrasado" perderia a
 * informação, e recalculá-la depois daria outra resposta se o professor
 * estendesse o prazo.
 */
export function canSubmit(
  regras: SubmissionRules,
  entregasFeitas: number,
  agora: Date,
): SubmissionDecision {
  if (regras.maxAttempts !== undefined && entregasFeitas >= regras.maxAttempts) {
    return { allow: false, reason: "no_attempts_left" };
  }

  if (!regras.dueAt) return { allow: true, late: false };

  const atrasada = agora > new Date(regras.dueAt);

  if (atrasada && regras.latePolicy === "block") {
    return { allow: false, reason: "past_due" };
  }

  return { allow: true, late: atrasada };
}

/**
 * Desconta a nota por atraso.
 *
 * A política `accept` marca o atraso sem punir: punir é decisão do professor, e
 * um desconto automático que ele não configurou seria uma nota que ele não deu.
 */
export function applyLatePenalty(pontos: number, atrasada: boolean, descontoPercent: number): number {
  if (!atrasada || descontoPercent <= 0) return pontos;

  const restante = Math.max(0, 100 - descontoPercent) / 100;
  return Math.round(pontos * restante * 100) / 100;
}
