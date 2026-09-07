/**
 * Analytics avançado — F6-06 (guia §21).
 *
 * O §21 abre dizendo "não confunda analytics com simples contador de visitas".
 * O produto já tinha os contadores — matrículas, conclusões, média de progresso,
 * usuários ativos. O que falta são as perguntas que exigem interpretação:
 *
 *   ABANDONO POR ETAPA — em que aula as pessoas param? É a métrica que diz o
 *   que consertar. "40% de conclusão" não diz nada acionável; "metade para na
 *   aula 3" diz exatamente onde olhar.
 *
 *   RETENÇÃO DE VÍDEO — até que ponto do vídeo as pessoas assistem. Distingue
 *   "ninguém abriu" de "todos abriram e saíram no primeiro minuto", que pedem
 *   ações opostas.
 *
 *   DAU/WAU/MAU — o hábito, não o volume. Uma plataforma com 1000 acessos de
 *   50 pessoas é diferente de 1000 acessos de 900 pessoas.
 *
 * Tudo puro: recebe dados e devolve números. Nada de consulta aqui.
 */

export interface LessonStep {
  lessonId: string;
  title: string;
  moduleTitle: string;
  /** A ordem da aula no curso, começando em 1. */
  position: number;
  /** Quantas pessoas concluíram ESTA aula. */
  completed: number;
  /** Quantas começaram (têm progresso registrado). */
  started: number;
  durationSeconds: number;
  /** Soma dos segundos assistidos por todo mundo. */
  watchedSeconds: number;
}

export interface DropoffPoint extends LessonStep {
  /** Quantas pessoas chegaram a esta aula — as que concluíram a anterior. */
  reached: number;
  /** Quantas pararam AQUI: chegaram e não concluíram. */
  droppedHere: number;
  /** Percentual de quem chegou e parou. */
  dropoffPercent: number;
  /** Percentual do total inicial que ainda está aqui. */
  retentionPercent: number;
}

/**
 * O funil do curso: onde as pessoas param.
 *
 * A conta é sequencial de propósito. "Chegou à aula 5" significa "concluiu a
 * aula 4" — não "abriu a aula 5". Um curso é uma sequência, e alguém que pulou
 * para o fim não passou pelo meio.
 *
 * `matriculados` entra separado porque a primeira aula tem de comparar com o
 * total de matriculados, não consigo mesma: se ninguém abriu a aula 1, o
 * abandono é de 100% dos matriculados, e uma conta que começa na própria aula
 * mostraria 0%.
 */
export function courseDropoff(steps: LessonStep[], matriculados: number): DropoffPoint[] {
  const ordenadas = [...steps].sort((a, b) => a.position - b.position);

  const pontos: DropoffPoint[] = [];
  let chegaram = matriculados;

  for (const etapa of ordenadas) {
    /* Quem chegou não pode ser menos que quem concluiu: acontece quando alguém
       conclui fora de ordem, e um número negativo de abandono não significa
       nada. */
    const alcance = Math.max(chegaram, etapa.completed);
    const pararam = Math.max(0, alcance - etapa.completed);

    pontos.push({
      ...etapa,
      reached: alcance,
      droppedHere: pararam,
      dropoffPercent: alcance === 0 ? 0 : Math.round((pararam / alcance) * 100),
      retentionPercent: matriculados === 0 ? 0 : Math.round((etapa.completed / matriculados) * 100),
    });

    /* Quem chega à próxima é quem concluiu esta. */
    chegaram = etapa.completed;
  }

  return pontos;
}

/**
 * A etapa onde MAIS gente para, em números absolutos.
 *
 * Absoluto e não percentual: uma aula onde 3 de 4 param tem 75% de abandono,
 * mas outra onde 40 de 200 param perde treze vezes mais gente. Quem vai
 * consertar precisa saber onde está o volume.
 *
 * `null` quando ninguém abandonou em lugar nenhum.
 */
export function worstDropoff(pontos: DropoffPoint[]): DropoffPoint | null {
  let pior: DropoffPoint | null = null;

  for (const ponto of pontos) {
    if (ponto.droppedHere === 0) continue;
    if (!pior || ponto.droppedHere > pior.droppedHere) pior = ponto;
  }

  return pior;
}

export interface VideoRetention {
  lessonId: string;
  title: string;
  durationSeconds: number;
  /** Quantas pessoas abriram. */
  viewers: number;
  /** Média de segundos assistidos por quem abriu. */
  averageWatchedSeconds: number;
  /** 0 a 100: quanto do vídeo a pessoa média assiste. */
  retentionPercent: number;
  /** Quantas assistiram até o fim (>= 95%). */
  finished: number;
}

/**
 * Retenção de vídeo — quanto do vídeo as pessoas assistem.
 *
 * O 95% para "assistiu até o fim" não é arbitrário: créditos finais, o segundo
 * em que a pessoa fecha a aba, e o arredondamento do player fazem quase ninguém
 * chegar a 100%. Exigir 100% mostraria zero conclusões num vídeo que todo mundo
 * viu inteiro.
 */
export function videoRetention(
  steps: LessonStep[],
  finishedByLesson: Map<string, number>,
): VideoRetention[] {
  return steps
    .filter((etapa) => etapa.durationSeconds > 0)
    .map((etapa) => {
      const media = etapa.started === 0 ? 0 : etapa.watchedSeconds / etapa.started;

      return {
        lessonId: etapa.lessonId,
        title: etapa.title,
        durationSeconds: etapa.durationSeconds,
        viewers: etapa.started,
        averageWatchedSeconds: Math.round(media),
        /* Limitado a 100: o player reporta a posição, e uma pessoa que reviu um
           trecho pode somar mais que a duração. Passar de 100% seria dizer que
           ela assistiu mais vídeo do que existe. */
        retentionPercent: Math.min(100, Math.round((media / etapa.durationSeconds) * 100)),
        finished: finishedByLesson.get(etapa.lessonId) ?? 0,
      };
    });
}

export interface ActivityDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Pessoas distintas ativas naquele dia. */
  users: number;
}

export interface HabitMetrics {
  /**
   * Média de pessoas distintas por dia, nos últimos 30 dias.
   *
   * Com UMA casa decimal, não inteiro. Numa plataforma pequena — 4 pessoas
   * ativas num mês — a média inteira arredonda para 0, e a tela diria "0
   * pessoas por dia" logo acima de "4 na última semana". O número vira mentira
   * pelo arredondamento, não pelo cálculo.
   */
  dau: number;
  /** Pessoas distintas nos últimos 7 dias. */
  wau: number;
  /** Pessoas distintas nos últimos 30 dias. */
  mau: number;
  /**
   * DAU/MAU em percentual — a "aderência".
   *
   * É o número que distingue hábito de visita: 10% significa que a pessoa média
   * entra 3 dias por mês; 50% significa dia sim, dia não. Volume de acesso não
   * mostra isso.
   */
  stickiness: number;
}

/**
 * DAU, WAU, MAU e aderência.
 *
 * `dailyUsers` traz um dia por linha, com pessoas DISTINTAS. `wau` e `mau` vêm
 * separados porque não dá para derivá-los da série diária: somar os dias
 * contaria a mesma pessoa várias vezes, e a distinção é justamente o ponto.
 */
export function habitMetrics(
  dailyUsers: ActivityDay[],
  wau: number,
  mau: number,
): HabitMetrics {
  /* A média é sobre os dias do PERÍODO, não sobre os dias com atividade: um dia
     sem ninguém é um zero que conta. Ignorá-lo inflaria a média de uma
     plataforma que ficou parada metade do mês. */
  const dias = dailyUsers.length;
  const soma = dailyUsers.reduce((total, dia) => total + dia.users, 0);

  /* Uma casa decimal: `Math.round` daria 0 para uma média de 0,4, e a tela
     mostraria "0 pessoas por dia" ao lado de "4 na última semana". */
  const dau = dias === 0 ? 0 : Math.round((soma / dias) * 10) / 10;

  return {
    dau,
    wau,
    mau,
    /* A aderência sai do DAU sem arredondar de novo — arredondar duas vezes
       transformaria 0,4/8 = 5% em 0%. */
    stickiness: mau === 0 ? 0 : Math.round((dau / mau) * 100),
  };
}

export interface AbandonedEnrollment {
  learnerId: string;
  learnerName: string;
  courseId: string;
  courseTitle: string;
  percent: number;
  /** Dias desde o último progresso. */
  daysIdle: number;
}

/**
 * Cursos ABANDONADOS — o §21 pede este número por nome.
 *
 * Abandono não é "não concluiu": quem começou ontem não abandonou nada. É
 * COMEÇOU, NÃO TERMINOU e PAROU DE MEXER há tempo suficiente.
 *
 * 30 dias por padrão. É arbitrário, e assumidamente: menos pegaria férias, mais
 * deixaria o problema envelhecer antes de alguém ver. O parâmetro existe porque
 * treinamento obrigatório com prazo de uma semana precisa de outro corte.
 */
export function abandonedEnrollments(
  candidatos: AbandonedEnrollment[],
  diasParados = 30,
): AbandonedEnrollment[] {
  return candidatos
    .filter((item) => item.percent > 0 && item.percent < 100)
    .filter((item) => item.daysIdle >= diasParados)
    .sort((a, b) => b.daysIdle - a.daysIdle);
}

export interface DepartmentPerformance {
  department: string;
  learners: number;
  /** Média de progresso, 0 a 100. */
  averagePercent: number;
  completed: number;
  /** Matrículas, não pessoas. */
  enrollments: number;
  completionRate: number;
}

/**
 * Desempenho por departamento — o "performance por departamento" do §21.
 *
 * Ordena por taxa de conclusão CRESCENTE: quem abre este relatório quer saber
 * onde intervir, e a área com pior número é a resposta. Ordenar pela melhor
 * colocaria a boa notícia em cima e esconderia o problema no fim da lista.
 */
export function departmentPerformance(
  rows: Array<{
    department: string | null;
    learnerId: string;
    percent: number;
    completed: boolean;
  }>,
): DepartmentPerformance[] {
  const porArea = new Map<
    string,
    { pessoas: Set<string>; soma: number; matriculas: number; concluidas: number }
  >();

  for (const row of rows) {
    /* Sem departamento vira um grupo próprio, e não some do relatório: gente
       sem lotação cadastrada existe, e escondê-la faria o total não fechar. */
    const area = row.department ?? "Sem unidade";

    const atual = porArea.get(area) ?? {
      pessoas: new Set<string>(),
      soma: 0,
      matriculas: 0,
      concluidas: 0,
    };

    atual.pessoas.add(row.learnerId);
    atual.soma += row.percent;
    atual.matriculas += 1;
    if (row.completed) atual.concluidas += 1;

    porArea.set(area, atual);
  }

  return [...porArea]
    .map(([department, dados]) => ({
      department,
      learners: dados.pessoas.size,
      /* Média por MATRÍCULA, não por pessoa: quem faz cinco cursos e vai bem em
         todos pesa mais que quem faz um — e é isso que "desempenho da área"
         significa. */
      averagePercent: dados.matriculas === 0 ? 0 : Math.round(dados.soma / dados.matriculas),
      completed: dados.concluidas,
      enrollments: dados.matriculas,
      completionRate:
        dados.matriculas === 0 ? 0 : Math.round((dados.concluidas / dados.matriculas) * 100),
    }))
    .sort((a, b) => a.completionRate - b.completionRate);
}
