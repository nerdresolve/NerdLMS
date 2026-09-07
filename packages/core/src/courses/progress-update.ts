/**
 * Regra de avanço do progresso.
 *
 * Existe separada de `progress.ts` porque aquele arquivo **lê** progresso
 * (percentual, situação, ponto de retomada) e este **decide como ele muda**.
 * São perguntas diferentes, e a de escrita é a que precisa valer igual nos dois
 * lados: o player envia posição, o servidor decide se aceita.
 *
 * A regra do protótipo (`learner-store.js`) vira contrato aqui, para que a
 * versão que grava no banco e a que roda na demonstração não divirjam.
 */

import { isLessonCompleted } from "./progress.ts";

export interface ProgressUpdate {
  lessonId: string;
  /** Posição alcançada, em segundos. */
  watchedSeconds: number;
}

export type ProgressDecision =
  | { accept: true; watchedSeconds: number; completed: boolean }
  | { accept: false; reason: ProgressRejection };

export type ProgressRejection = "invalid_input" | "unknown_lesson" | "no_progress";

/**
 * Decide se uma posição assistida deve ser gravada.
 *
 * **O progresso nunca retrocede.** Rever um trecho, arrastar o vídeo para trás
 * ou uma requisição atrasada chegando fora de ordem não podem apagar o que a
 * pessoa já assistiu — e é exatamente isso que aconteceria se o servidor
 * gravasse cegamente o que recebe.
 *
 * A posição também é limitada à duração da aula: um cliente adulterado que
 * enviasse 10 horas numa aula de 20 minutos ganharia conclusão de graça, e o
 * percentual do curso passaria de 100%.
 */
export function decideProgress(
  update: ProgressUpdate,
  durationSeconds: number,
  currentSeconds: number,
): ProgressDecision {
  const seconds = Number(update.watchedSeconds);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return { accept: false, reason: "invalid_input" };
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { accept: false, reason: "unknown_lesson" };
  }

  /* Nunca além do fim da aula: é o teto que impede conclusão forjada. */
  const capped = Math.min(Math.round(seconds), durationSeconds);

  if (capped <= currentSeconds) {
    return { accept: false, reason: "no_progress" };
  }

  return {
    accept: true,
    watchedSeconds: capped,
    completed: isLessonCompleted(capped, durationSeconds),
  };
}

/**
 * A posição que marca a aula como concluída.
 *
 * Concluir registra a duração inteira, e não o limiar de 90%: quem clicou em
 * "concluir" terminou a aula, e gravar 90% faria a barra parar perto do fim
 * para sempre.
 */
export function completionSeconds(durationSeconds: number): number {
  return Math.max(0, Math.round(durationSeconds));
}
