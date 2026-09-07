/**
 * Turmas — F2-02.
 *
 * Uma turma é um recorte da matrícula: mesmo curso, mesmo conteúdo, mesma
 * trilha de progresso, com instrutor, datas e relatório próprios.
 */

export interface CourseClass {
  id: string;
  courseId: string;
  name: string;
  instructorId?: string;
  instructorName?: string;
  /** ISO 8601 sem hora. */
  startsOn?: string;
  endsOn?: string;
  /** Teto de vagas. Ausente é "sem limite". */
  capacity?: number;
  status: "open" | "closed";
  /** Quantas pessoas já estão nesta turma. */
  enrolled: number;
}

export type ClassRefusal =
  | "class_closed"
  | "class_full"
  | "class_ended"
  | "wrong_course";

export const CLASS_REFUSAL_MESSAGE: Record<ClassRefusal, string> = {
  class_closed: "Esta turma não está aceitando matrículas.",
  class_full: "Esta turma está lotada.",
  class_ended: "Esta turma já foi encerrada.",
  wrong_course: "Esta turma não pertence a este curso.",
};

export type ClassDecision = { allow: true } | { allow: false; reason: ClassRefusal };

/**
 * Se dá para matricular alguém nesta turma.
 *
 * A ordem das recusas importa para a mensagem ser útil: uma turma encerrada e
 * lotada é primeiro encerrada — dizer "lotada" sugeriria que abrir vaga
 * resolveria, e não resolve.
 *
 * `hoje` é injetado para o teste não depender do relógio.
 */
export function canJoinClass(
  turma: CourseClass,
  courseId: string,
  hoje: string,
): ClassDecision {
  if (turma.courseId !== courseId) return { allow: false, reason: "wrong_course" };
  if (turma.status === "closed") return { allow: false, reason: "class_closed" };

  /* Datas ISO comparam como texto — é a razão de o formato ser AAAA-MM-DD. */
  if (turma.endsOn && turma.endsOn < hoje) return { allow: false, reason: "class_ended" };

  if (turma.capacity !== undefined && turma.enrolled >= turma.capacity) {
    return { allow: false, reason: "class_full" };
  }

  return { allow: true };
}

/** Vagas restantes. `null` quando a turma não tem teto. */
export function seatsLeft(turma: CourseClass): number | null {
  if (turma.capacity === undefined) return null;
  return Math.max(0, turma.capacity - turma.enrolled);
}

/**
 * O período da turma, para leitura.
 *
 * Devolve `null` quando não há data nenhuma: a turma contínua existe, e um
 * traço solto na tela não informaria nada.
 */
export function classPeriod(turma: CourseClass): string | null {
  const dia = (iso: string) => {
    const [ano, mes, d] = iso.split("-");
    return `${d}/${mes}/${ano}`;
  };

  if (turma.startsOn && turma.endsOn) return `${dia(turma.startsOn)} a ${dia(turma.endsOn)}`;
  if (turma.startsOn) return `A partir de ${dia(turma.startsOn)}`;
  if (turma.endsOn) return `Até ${dia(turma.endsOn)}`;

  return null;
}
