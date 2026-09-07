import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import { canJoinClass, CLASS_REFUSAL_MESSAGE } from "@nerdlms/core/courses/classes.ts";

import { assignToClass, createClass, findClass, setClassStatus } from "./class-repository.ts";
import { authorizeCourse } from "./course-editor-use-case.ts";

/**
 * Turmas — F2-02.
 *
 * São DUAS autorizações diferentes, e confundi-las custou um defeito:
 *
 * - CRIAR e ABRIR/FECHAR turma é editar a oferta do curso, então vale
 *   `authorizeCourse` — quem manda é o autor;
 * - DISTRIBUIR pessoas em turmas é gesto do gestor, que não é autor de curso
 *   nenhum. Ali vale a permissão de `enroll`, a mesma de matricular.
 */

export interface CreateClassCommand {
  actor: Actor;
  courseId: string;
  name: string;
  instructorId?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  capacity?: number | null;
}

export type ClassOutcome =
  | { status: 200; classId?: string }
  | { status: 400 | 404 | 409; error: string };

export async function createClassUseCase(command: CreateClassCommand): Promise<ClassOutcome> {
  const ownership = await authorizeCourse(command.actor, command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  if (command.name.trim() === "") {
    return { status: 400, error: "A turma precisa de um nome." };
  }

  if (command.startsOn && command.endsOn && command.endsOn < command.startsOn) {
    return { status: 400, error: "O encerramento não pode ser anterior ao início." };
  }

  if (command.capacity !== undefined && command.capacity !== null && command.capacity <= 0) {
    return { status: 400, error: "O número de vagas precisa ser maior que zero." };
  }

  const classId = await createClass({
    tenantId: ownership.tenantId,
    courseId: command.courseId,
    name: command.name,
    instructorId: command.instructorId ?? null,
    startsOn: command.startsOn ?? null,
    endsOn: command.endsOn ?? null,
    capacity: command.capacity ?? null,
  });

  if (!classId) return { status: 409, error: "Já existe uma turma com este nome neste curso." };

  return { status: 200, classId };
}

export interface ClassStatusCommand {
  actor: Actor;
  courseId: string;
  classId: string;
  status: "open" | "closed";
}

export async function classStatusUseCase(command: ClassStatusCommand): Promise<ClassOutcome> {
  const ownership = await authorizeCourse(command.actor, command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  const turma = await findClass(command.classId);
  /* A turma precisa ser DESTE curso: sem esta conferência, o id de uma turma
     alheia seria fechado por quem só tem permissão sobre o próprio curso. */
  if (!turma || turma.courseId !== command.courseId) {
    return { status: 404, error: "Turma não encontrada." };
  }

  await setClassStatus(command.classId, command.status);
  return { status: 200 };
}

export interface AssignClassCommand {
  actor: Actor;
  courseId: string;
  classId: string;
  learnerIds: string[];
  /** Data de hoje em ISO, para a regra de turma encerrada. */
  today: string;
}

export type AssignClassOutcome =
  | { status: 200; moved: number }
  | { status: 400 | 404; error: string };

/**
 * Move matrículas para uma turma.
 *
 * As pessoas já estão matriculadas no curso — turma é organização de quem já
 * entrou, não uma segunda porta de entrada. Matricular e distribuir em turmas
 * são gestos separados de propósito: o gestor matricula trinta pessoas de uma
 * vez e depois decide quem vai em março e quem vai em abril.
 */
export async function assignClassUseCase(
  command: AssignClassCommand,
): Promise<AssignClassOutcome> {
  /* A autorização aqui NÃO é a de editar o curso.
     
     Distribuir em turmas é gesto do gestor, e o gestor não é autor de curso
     nenhum — `authorizeCourse` o recusava com 404, e a matrícula acontecia sem
     a turma sendo atribuída. Quem move gente entre turmas é quem pode
     matricular gente: a mesma permissão de `enroll`.
     
     O instrutor autor também passa, porque `can` lhe dá `enroll` sobre o
     próprio curso — mas é a permissão de matricular que manda, não a de
     editar. */
  if (
    !can(command.actor, "enroll", {
      kind: "enrollment",
      learnerId: command.learnerIds[0] ?? command.actor.id,
      courseAuthorId: "",
    })
  ) {
    return { status: 404, error: "Curso não encontrado." };
  }

  const turma = await findClass(command.classId);
  if (!turma || turma.courseId !== command.courseId) {
    return { status: 404, error: "Turma não encontrada." };
  }

  const decision = canJoinClass(turma, command.courseId, command.today);
  if (!decision.allow) {
    return { status: 400, error: CLASS_REFUSAL_MESSAGE[decision.reason] };
  }

  /* O teto vale para o LOTE inteiro, não pessoa a pessoa: aceitar as primeiras
     e recusar o resto deixaria o gestor sem saber quem entrou. */
  if (turma.capacity !== undefined && turma.enrolled + command.learnerIds.length > turma.capacity) {
    const vagas = Math.max(0, turma.capacity - turma.enrolled);
    return {
      status: 400,
      error:
        vagas === 0
          ? "Esta turma está lotada."
          : `Esta turma tem ${vagas} ${vagas === 1 ? "vaga" : "vagas"} e você selecionou ${command.learnerIds.length}.`,
    };
  }

  const moved = await assignToClass(command.classId, command.courseId, command.learnerIds);
  return { status: 200, moved };
}
