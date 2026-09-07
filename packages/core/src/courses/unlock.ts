/**
 * Pré-requisitos e liberação progressiva — F2-04 e F2-05.
 *
 * Os dois compartilham este motor porque são a mesma pergunta com alvos
 * diferentes: "esta pessoa pode abrir isto agora?". O guia §11 pede critérios
 * combináveis, e combinar é o que este avaliador faz.
 */

import { lessonStatus } from "./progress.ts";
import type { Course, Enrollment } from "./types.ts";

export type UnlockKind =
  | "course_completed"
  | "module_completed"
  | "lesson_completed"
  | "min_grade"
  | "competency"
  | "date"
  | "class_member";

export interface UnlockRule {
  kind: UnlockKind;
  requiredCourseId?: string;
  requiredModuleId?: string;
  requiredLessonId?: string;
  requiredClassId?: string;
  requiredDate?: string;
  requiredGrade?: number;
  /** Rótulo do que é exigido, para a mensagem na tela. */
  requiredLabel?: string;
}

/** O que se sabe sobre a pessoa, para avaliar as regras. */
export interface UnlockContext {
  completedCourses: Set<string>;
  completedModules: Set<string>;
  completedLessons: Set<string>;
  classIds: Set<string>;
  /** Hoje em ISO (AAAA-MM-DD). Injetado para o teste não depender do relógio. */
  today: string;
}

export type UnlockResult =
  | { unlocked: true }
  | { unlocked: false; blockedBy: UnlockRule; reason: string };

/** A frase que a tela mostra quando o conteúdo está bloqueado. */
export function unlockReason(regra: UnlockRule): string {
  const alvo = regra.requiredLabel;

  switch (regra.kind) {
    case "course_completed":
      return alvo ? `Conclua “${alvo}” primeiro.` : "Conclua o curso anterior primeiro.";
    case "module_completed":
      return alvo ? `Conclua o módulo “${alvo}” primeiro.` : "Conclua o módulo anterior primeiro.";
    case "lesson_completed":
      return alvo ? `Conclua “${alvo}” primeiro.` : "Conclua a aula anterior primeiro.";
    case "date": {
      const [ano, mes, dia] = (regra.requiredDate ?? "").split("-");
      return `Disponível a partir de ${dia}/${mes}/${ano}.`;
    }
    case "class_member":
      return "Disponível apenas para uma turma específica.";
    case "min_grade":
      return `Exige nota mínima de ${regra.requiredGrade ?? 0}.`;
    case "competency":
      return "Exige uma competência que você ainda não tem.";
  }
}

/** Se UMA regra está satisfeita. */
function satisfied(regra: UnlockRule, ctx: UnlockContext): boolean {
  switch (regra.kind) {
    case "course_completed":
      return !!regra.requiredCourseId && ctx.completedCourses.has(regra.requiredCourseId);

    case "module_completed":
      return !!regra.requiredModuleId && ctx.completedModules.has(regra.requiredModuleId);

    case "lesson_completed":
      return !!regra.requiredLessonId && ctx.completedLessons.has(regra.requiredLessonId);

    case "class_member":
      return !!regra.requiredClassId && ctx.classIds.has(regra.requiredClassId);

    case "date":
      /* Datas ISO comparam como texto, e o dia da liberação já conta:
         "a partir de 15/03" abre NO dia 15. */
      return !!regra.requiredDate && ctx.today >= regra.requiredDate;

    /* Nota e competência dependem de F3 e F6, que não existem.

       Bloquear é a escolha deliberada: liberar por não saber avaliar deixaria
       um curso que exige nota 70 aberto a quem não fez prova nenhuma, e esse é
       o erro que importa evitar. Quando a avaliação existir, esta é a única
       linha que muda. */
    case "min_grade":
    case "competency":
      return false;
  }
}

/**
 * Todas as regras precisam ser atendidas (E lógico).
 *
 * O guia fala em condições combinadas, e a combinação natural de
 * pré-requisitos é conjuntiva: "concluiu o básico E é da turma de março".
 * Um OU seria expressável, mas nenhum caso real pedido o exige — e oferecer os
 * dois exigiria uma interface de construção de expressões que ninguém pediu.
 *
 * O motivo devolvido é o PRIMEIRO não atendido: a tela mostra uma frase, e
 * listar cinco pendências de uma vez seria pior que apontar a próxima.
 */
export function evaluateUnlock(regras: UnlockRule[], ctx: UnlockContext): UnlockResult {
  for (const regra of regras) {
    if (!satisfied(regra, ctx)) {
      return { unlocked: false, blockedBy: regra, reason: unlockReason(regra) };
    }
  }

  return { unlocked: true };
}

/** Curso com a política de liberação (a coluna da 009). */
export type ReleasableCourse = Course & { contentRelease?: "open" | "sequential" };

/**
 * Se a aula está liberada para quem tem esta matrícula.
 *
 * Duas fontes de bloqueio, somadas:
 *
 * - a política SEQUENCIAL do curso, derivada da posição da aula. É um atalho
 *   para o caso mais comum de liberação progressiva: escrever uma regra por
 *   aula daria N-1 regras que o instrutor esqueceria de refazer ao inserir uma
 *   aula no meio;
 * - as REGRAS explícitas da aula, que valem mesmo em curso aberto.
 */
export function lessonUnlockState(
  course: ReleasableCourse,
  enrollment: Enrollment,
  lessonId: string,
  regras: UnlockRule[],
  today = "1970-01-01",
): UnlockResult {
  const todas = course.modules.flatMap((m) => m.lessons);
  const posicao = todas.findIndex((l) => l.id === lessonId);

  if (course.contentRelease === "sequential" && posicao > 0) {
    const anterior = todas[posicao - 1]!;

    if (lessonStatus(anterior, enrollment) !== "completed") {
      const regra: UnlockRule = {
        kind: "lesson_completed",
        requiredLessonId: anterior.id,
        requiredLabel: anterior.title,
      };

      return { unlocked: false, blockedBy: regra, reason: unlockReason(regra) };
    }
  }

  const concluidas = new Set(
    todas.filter((l) => lessonStatus(l, enrollment) === "completed").map((l) => l.id),
  );

  return evaluateUnlock(regras, {
    completedCourses: new Set(),
    completedModules: new Set(),
    completedLessons: concluidas,
    classIds: new Set(),
    today,
  });
}
