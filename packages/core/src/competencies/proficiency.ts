/**
 * Nível de domínio, progressão e gaps — F6-02 (guia §20).
 *
 * Regras puras. O que elas respondem, e que o produto ainda não respondia:
 *
 *   "Quem sabe operar uma ETA, e em que nível?" — não "quem fez o curso".
 *
 * A distinção importa porque competência e curso não são a mesma coisa: alguém
 * pode ter a competência por experiência e nunca ter feito o curso, e alguém
 * pode ter feito o curso há seis anos e não operar mais nada.
 */

export type EvidenceSource =
  | "course"
  | "lesson"
  | "quiz"
  | "assignment"
  | "manual"
  | "external";

export interface Evidence {
  id: string;
  competencyId: string;
  level: number;
  source: EvidenceSource;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601, ou `null` quando não vence. */
  expiresAt: string | null;
  revokedAt: string | null;
  note?: string | null;
}

/**
 * Uma evidência CONTA hoje?
 *
 * Revogada nunca conta. Vencida também não — e é aí que competência difere de
 * badge: o badge vencido continua provando que a formação aconteceu; a
 * competência vencida deixa de afirmar que a pessoa sabe fazer. Quem operou uma
 * ETA em 2019 e nunca mais voltou não opera hoje, e um relatório que dissesse
 * que sim mandaria a pessoa errada para o campo.
 */
export function evidenceCounts(evidence: Evidence, agora = new Date()): boolean {
  if (evidence.revokedAt !== null) return false;
  if (evidence.expiresAt !== null && new Date(evidence.expiresAt) <= agora) return false;
  return true;
}

/**
 * O nível VIGENTE numa competência: a maior evidência que ainda conta.
 *
 * A MAIOR, não a mais recente. Fazer o curso básico depois do avançado não
 * rebaixa ninguém — quem já demonstrou o nível 3 continua no 3, e uma regra
 * "vale a última" transformaria uma revisão de conteúdo em perda de
 * qualificação.
 *
 * `0` significa "não tem": o framework começa no nível 1, e usar zero evita
 * confundir "não avaliado" com "avaliado no menor nível".
 */
export function currentLevel(evidences: Evidence[], agora = new Date()): number {
  let maior = 0;

  for (const evidence of evidences) {
    if (!evidenceCounts(evidence, agora)) continue;
    if (evidence.level > maior) maior = evidence.level;
  }

  return maior;
}

/** O nível por competência, para uma pessoa. */
export function levelsByCompetency(
  evidences: Evidence[],
  agora = new Date(),
): Map<string, number> {
  const porCompetencia = new Map<string, Evidence[]>();

  for (const evidence of evidences) {
    const lista = porCompetencia.get(evidence.competencyId);
    if (lista) lista.push(evidence);
    else porCompetencia.set(evidence.competencyId, [evidence]);
  }

  const niveis = new Map<string, number>();
  for (const [competencyId, lista] of porCompetencia) {
    const nivel = currentLevel(lista, agora);
    if (nivel > 0) niveis.set(competencyId, nivel);
  }

  return niveis;
}

export interface PlanItem {
  competencyId: string;
  competencyName: string;
  requiredLevel: number;
}

export interface Gap {
  competencyId: string;
  competencyName: string;
  requiredLevel: number;
  /** O que a pessoa tem hoje. `0` é "nada". */
  currentLevel: number;
  /** Quantos degraus faltam. */
  missing: number;
  /** `true` quando a pessoa TINHA e venceu — é urgência diferente de nunca ter tido. */
  expired: boolean;
}

export interface PlanProgress {
  /** Itens cumpridos. */
  met: number;
  total: number;
  /** 0 a 100, arredondado. */
  percent: number;
  gaps: Gap[];
}

/**
 * O relatório de gaps do §20: o que falta para cumprir o plano.
 *
 * A diferença entre "nunca teve" e "TINHA e venceu" é registrada de propósito.
 * As duas aparecem como gap, mas exigem ações diferentes: a primeira é
 * formação, a segunda é reciclagem — e quem venceu costuma ser mais urgente,
 * porque estava autorizado a fazer algo e deixou de estar sem ninguém notar.
 */
export function planProgress(
  items: PlanItem[],
  evidences: Evidence[],
  agora = new Date(),
): PlanProgress {
  const vigentes = levelsByCompetency(evidences, agora);

  /* Os níveis ignorando o vencimento: é o que distingue "nunca teve" de
     "venceu". Sem esta segunda passada, as duas situações seriam
     indistinguíveis no relatório. */
  const semVencimento = levelsByCompetency(
    evidences.map((e) => ({ ...e, expiresAt: null })),
    agora,
  );

  const gaps: Gap[] = [];
  let met = 0;

  for (const item of items) {
    const atual = vigentes.get(item.competencyId) ?? 0;

    if (atual >= item.requiredLevel) {
      met += 1;
      continue;
    }

    const jaTeve = semVencimento.get(item.competencyId) ?? 0;

    gaps.push({
      competencyId: item.competencyId,
      competencyName: item.competencyName,
      requiredLevel: item.requiredLevel,
      currentLevel: atual,
      missing: item.requiredLevel - atual,
      expired: jaTeve >= item.requiredLevel,
    });
  }

  return {
    met,
    total: items.length,
    /* Plano sem item é 100%, não 0%: não há nada por fazer. Dividir por zero
       daria NaN, e mostrar 0% acusaria de incompleto quem não deve nada. */
    percent: items.length === 0 ? 100 : Math.round((met / items.length) * 100),
    gaps,
  };
}

/**
 * O rótulo do nível, a partir da escala do framework.
 *
 * O nível é 1-based porque é assim que uma pessoa conta degraus; o array é
 * 0-based. Trocar os dois é o erro clássico aqui, e ele aparece como "Básico"
 * onde deveria estar "Intermediário" — plausível o bastante para passar.
 */
export function levelLabel(levels: string[], level: number): string {
  if (level <= 0) return "Não avaliado";

  return levels[level - 1] ?? `Nível ${level}`;
}

export interface CompetencyNode {
  id: string;
  parentId: string | null;
}

/**
 * O nível de uma competência-mãe, derivado das filhas.
 *
 * Uma competência composta — "Tratamento de água" — vale o MENOR nível entre as
 * filhas, não a média nem o maior. Quem domina coagulação e não domina
 * filtração não trata água: a corrente vale o elo mais fraco, e uma média
 * esconderia exatamente o elo que impede a tarefa.
 *
 * Só vale para quem tem filhas. Competência-folha usa a própria evidência.
 */
export function derivedLevel(
  competencyId: string,
  nodes: CompetencyNode[],
  levels: Map<string, number>,
): number {
  const filhas = nodes.filter((node) => node.parentId === competencyId);

  if (filhas.length === 0) return levels.get(competencyId) ?? 0;

  let menor = Number.POSITIVE_INFINITY;

  for (const filha of filhas) {
    /* Recursivo: a árvore pode ter mais de dois andares, e o nível de uma
       filha que também tem filhas vem das netas. */
    const nivel = derivedLevel(filha.id, nodes, levels);
    if (nivel < menor) menor = nivel;
  }

  return menor === Number.POSITIVE_INFINITY ? 0 : menor;
}

/**
 * As evidências que vencem em breve — a recertificação do §33.
 *
 * Quem tem competência vencendo em 30 dias precisa ser avisado ANTES, não
 * depois: depois já é o gestor descobrindo que mandou alguém sem qualificação
 * para o campo.
 */
export function expiringSoon(
  evidences: Evidence[],
  dias: number,
  agora = new Date(),
): Evidence[] {
  const limite = new Date(agora);
  limite.setDate(limite.getDate() + dias);

  return evidences.filter((evidence) => {
    if (!evidenceCounts(evidence, agora)) return false;
    if (evidence.expiresAt === null) return false;

    return new Date(evidence.expiresAt) <= limite;
  });
}
