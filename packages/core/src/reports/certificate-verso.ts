/**
 * O verso do certificado: o que foi ensinado, e não só que alguém concluiu.
 *
 * POR QUE ELE EXISTE
 *
 * A frente prova a conclusão. Ela não diz o que o treinamento cobriu, e é isso
 * que uma auditoria de segurança do trabalho pergunta: qual foi o conteúdo,
 * quantas horas, quem ministrou, em que data. Um certificado que só afirma
 * "concluiu o curso X" obriga quem audita a ir atrás do programa em outro
 * lugar, e o vínculo entre os dois documentos passa a depender de confiança.
 *
 * O QUE ELE NÃO RESOLVE, e é importante estar escrito
 *
 * Imprimir o conteúdo programático é NECESSÁRIO e não é SUFICIENTE para
 * conformidade com a NR-1. A norma trata também de qualificação de quem
 * ministra, registro de frequência e adequação do treinamento ao risco da
 * função. Nada disso é decidido por um gerador de PDF.
 *
 * Este módulo entrega uma peça verificável do conjunto; quem atesta a
 * conformidade é a área de segurança do trabalho, olhando o processo inteiro.
 */

import { formatDuration } from "../courses/progress.ts";

/**
 * A estrutura mínima para montar o programa.
 *
 * Não recebe `CourseOutline` porque o programa não depende do progresso de
 * ninguém: ele é o mesmo para toda a turma. Pedir o outline obrigaria quem
 * emite o certificado a construir um, com uma matrícula, para listar títulos.
 */
export interface CursoDoPrograma {
  modules: Array<{
    title: string;
    lessons: Array<{ title: string; durationSeconds: number }>;
  }>;
}

/** Uma linha do conteúdo programático. */
export interface ItemDoPrograma {
  /** "1", "1.1", "2"… O nível é dado pelo ponto. */
  numero: string;
  titulo: string;
  /** Ausente em módulo, presente em aula. */
  duracao?: string;
  modulo: boolean;
}

export interface VersoDoCertificado {
  itens: ItemDoPrograma[];
  /** Quantas linhas o programa tem, para a página decidir se cabe. */
  total: number;
  /** `true` quando o programa foi cortado por não caber na página. */
  truncado: boolean;
}

/**
 * Quantas linhas cabem no verso de uma A4 deitada.
 *
 * Medida a partir do desenho: a área útil abaixo do cabeçalho e acima do
 * rodapé comporta esta quantidade com o corpo em 9pt. Passar disso empurraria
 * texto para fora da página, que é o defeito que ninguém percebe até imprimir.
 */
export const LINHAS_POR_PAGINA = 34;

/**
 * O programa do curso, na ordem em que é cursado.
 *
 * Módulo numerado em inteiro, aula em decimal. É a convenção de plano de
 * ensino, e ela dispensa recuo para quem lê impresso em preto e branco.
 */
export function programaDoCurso(
  curso: CursoDoPrograma,
  limite = LINHAS_POR_PAGINA,
): VersoDoCertificado {
  const itens: ItemDoPrograma[] = [];

  curso.modules.forEach((modulo, iModulo) => {
    itens.push({
      numero: String(iModulo + 1),
      titulo: modulo.title,
      modulo: true,
    });

    modulo.lessons.forEach((aula, iAula) => {
      itens.push({
        numero: `${iModulo + 1}.${iAula + 1}`,
        titulo: aula.title,
        duracao: formatDuration(aula.durationSeconds),
        modulo: false,
      });
    });
  });

  /* Cortar é melhor que transbordar, e dizer que cortou é melhor que cortar em
     silêncio: quem audita precisa saber que a lista continua. */
  const truncado = itens.length > limite;

  return {
    itens: truncado ? itens.slice(0, limite) : itens,
    total: itens.length,
    truncado,
  };
}

/**
 * A carga horária que vai no verso.
 *
 * Prefere a DECLARADA, e cai na soma dos vídeos quando não há. As duas medem
 * coisas diferentes: um curso com 40 minutos de vídeo pode valer quatro horas
 * contando leitura e exercício, e é o número declarado que a área de
 * treinamento defende numa auditoria.
 */
export function cargaDoCertificado(
  declaradaMinutos: number | undefined,
  videoSegundos: number,
): { minutos: number; origem: "declarada" | "video" } {
  if (declaradaMinutos && declaradaMinutos > 0) {
    return { minutos: declaradaMinutos, origem: "declarada" };
  }

  return { minutos: Math.round(videoSegundos / 60), origem: "video" };
}

/** "4 horas", "1h30", "45 minutos". A mesma escrita da aba Sobre. */
export function cargaPorExtenso(minutos: number): string {
  if (minutos <= 0) return "não informada";

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${resto} minutos`;
  if (resto === 0) return horas === 1 ? "1 hora" : `${horas} horas`;

  return `${horas}h${String(resto).padStart(2, "0")}`;
}
