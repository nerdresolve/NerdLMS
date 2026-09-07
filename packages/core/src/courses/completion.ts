import { aprovado } from "../assessment/retake.ts";
import type { ProgressSummary } from "./progress.ts";

/**
 * Quando um curso está concluído.
 *
 * A PERGUNTA MUDOU, E POR ISSO ESTA FUNÇÃO EXISTE
 *
 * Antes, concluir um curso era concluir as aulas — `courseProgress` respondia
 * tudo. Com prova obrigatória, deixou de responder: dá para assistir tudo e
 * reprovar, e um curso onde a pessoa reprovou não está concluído.
 *
 * `courseProgress` NÃO foi alterada de propósito. Ela mede consumo de aula, é
 * o que alimenta a barra de percentual, e é usada em oito lugares — mudar o
 * significado dela espalharia o efeito por telas que só querem saber quanto do
 * conteúdo foi visto. Aqui a pergunta é outra: o curso está fechado?
 *
 * O EFEITO QUE ISTO CORRIGE: o perfil listava certificado para quem tinha as
 * aulas em dia, e o botão de baixar devolvia recusa — a tela prometia o que o
 * servidor negava. Quem visse aquilo concluiria que o sistema estava quebrado,
 * e estaria certo.
 */

export type EstadoDoCurso =
  | "nao-comecou"
  | "em-andamento"
  /** Aulas em dia, prova pendente ou reprovada. */
  | "falta-prova"
  | "concluido";

export interface ProvaDoCurso {
  /** O curso exige nota? Nulo em curso sem prova, e aí as aulas bastam. */
  notaMinima: number | null;
  /** Melhor percentual já obtido. Nulo se nunca fez. */
  melhorPercentual: number | null;
}

export function estadoDoCurso(
  aulas: ProgressSummary,
  prova: ProvaDoCurso,
): EstadoDoCurso {
  if (aulas.status === "not_started") return "nao-comecou";
  if (aulas.status !== "completed") return "em-andamento";

  /* Sem exigência de nota, as aulas fecham o curso — é o comportamento de
     sempre, e cursos sem prova não passam a exigir uma que não têm. */
  if (prova.notaMinima === null) return "concluido";

  if (prova.melhorPercentual === null) return "falta-prova";

  return aprovado(prova.melhorPercentual) ? "concluido" : "falta-prova";
}

/** O curso está fechado? Atalho para quem só quer o sim ou não. */
export function cursoConcluido(aulas: ProgressSummary, prova: ProvaDoCurso): boolean {
  return estadoDoCurso(aulas, prova) === "concluido";
}

/** O que a tela escreve para cada estado. */
export const ROTULO_DO_ESTADO: Record<EstadoDoCurso, string> = {
  "nao-comecou": "Não iniciado",
  "em-andamento": "Em andamento",
  "falta-prova": "Aulas concluídas · falta a prova",
  concluido: "Concluído",
};

/**
 * O mesmo estado, no espaço de um selo de cartão.
 *
 * Mora aqui junto do rótulo longo de propósito: são duas redações da MESMA
 * coisa, e separá-las é como uma acaba dizendo "falta a prova" enquanto a
 * outra já diz "concluído".
 *
 * `falta-prova` é o único que precisava de selo próprio. Sem ele o cartão caía
 * no percentual das aulas e estampava "100%" num curso que não está fechado,
 * que é o número que a pessoa lê antes de qualquer palavra.
 */
export const ROTULO_CURTO_DO_ESTADO: Record<EstadoDoCurso, string> = {
  "nao-comecou": "Não iniciado",
  "em-andamento": "Em andamento",
  "falta-prova": "Falta a prova",
  concluido: "Concluído",
};
