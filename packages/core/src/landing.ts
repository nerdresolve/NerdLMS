/**
 * Conteúdo da tela de acesso inicial — TASK-021.
 *
 * Os números eram da referência visual: "+10 mil alunos", "94% de satisfação".
 * Numa página pública, com a marca da organização, isso é afirmação sobre o
 * negócio de uma empresa real — e nenhum deles era verdade (o banco tinha 13
 * pessoas e 7 cursos). Agora vêm de contagem real, montada por quem chama
 * (ISSUE-009).
 *
 * Satisfação saiu de vez: não existe pesquisa, então não há de onde tirar o
 * número. Inventar uma métrica de percepção é pior que omiti-la.
 */

export interface LandingStat {
  value: string;
  label: string;
}

export interface LandingPoint {
  icon: "book-open" | "clock" | "trending-up";
  title: string;
  text: string;
}

/** Os três pontos da seção "Sobre a plataforma". */
export const LANDING_POINTS: LandingPoint[] = [
  {
    icon: "book-open",
    title: "Cursos da operação",
    text: "Operação de poços, integridade de ativos, segurança de campo e meio ambiente.",
  },
  {
    icon: "clock",
    title: "Retoma onde parou",
    text: "A posição da aula fica salva e acompanha o aparelho que você usar.",
  },
  {
    icon: "trending-up",
    title: "Progresso por curso",
    text: "Você e seu gestor veem o avanço por módulo e por curso, sem planilha à parte.",
  },
];

export interface PlatformNumbers {
  learners: number;
  courses: number;
  lessons: number;
  completedLessons: number;
}

/**
 * Abrevia número grande sem mentir sobre a grandeza.
 *
 * 1.234 vira "1,2 mil"; 980 continua "980". Arredondar para baixo é
 * deliberado: melhor a plataforma parecer menor do que é do que maior.
 */
function abbreviate(value: number): string {
  if (value < 1000) return String(value);

  const milhares = Math.floor(value / 100) / 10;
  return `${String(milhares).replace(".", ",")} mil`;
}

/**
 * Os números da plataforma, a partir de contagem real.
 *
 * Um número zerado é omitido em vez de exibido: "0 alunos" numa página de
 * apresentação diz mais sobre o estado da instalação do que sobre o produto.
 */
export function landingStats(numbers: PlatformNumbers): LandingStat[] {
  const stats: LandingStat[] = [];

  if (numbers.learners > 0) {
    stats.push({
      value: abbreviate(numbers.learners),
      label: numbers.learners === 1 ? "Aluno" : "Alunos",
    });
  }
  if (numbers.courses > 0) {
    stats.push({
      value: abbreviate(numbers.courses),
      label: numbers.courses === 1 ? "Curso" : "Cursos",
    });
  }
  if (numbers.lessons > 0) {
    stats.push({ value: abbreviate(numbers.lessons), label: "Aulas" });
  }
  if (numbers.completedLessons > 0) {
    stats.push({ value: abbreviate(numbers.completedLessons), label: "Aulas concluídas" });
  }

  return stats;
}
