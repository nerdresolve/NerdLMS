import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  canSelfEnroll,
  ENROLLMENT_REFUSAL_MESSAGE,
} from "@nerdlms/core/courses/enrollment-rules.ts";

import { createEnrollment, findEnrollmentSummary, setSaved } from "./enrollment-repository.ts";
import { dispatchWebhook } from "../api/webhook-dispatcher.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Casos de uso de matrícula e favorito.
 *
 * Duas checagens, nesta ordem: **o papel pode** (permissions) e **o curso
 * aceita** (enrollment-rules). Confundi-las deixaria um aluno se inscrever num
 * treinamento obrigatório só porque alunos podem se matricular.
 */

export interface EnrollCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
}

export type EnrollOutcome =
  | { status: 200; enrolled: true }
  | { status: 400 | 403 | 404; error: string };

export async function enrollUseCase(command: EnrollCommand): Promise<EnrollOutcome> {
  const summary = await findEnrollmentSummary(command.courseId, command.actor.id);
  if (!summary) return { status: 404, error: "Curso não encontrado." };

  const allowed = can(command.actor, "enroll", {
    kind: "enrollment",
    learnerId: command.actor.id,
    courseAuthorId: "",
  });
  if (!allowed) {
    return { status: 403, error: "Sem permissão para se matricular." };
  }

  /* A regra do curso vem depois da permissão: um aluno pode matricular-se, mas
     nem todo curso aceita auto-inscrição. */
  const decision = canSelfEnroll(
    { status: summary.courseStatus, enrollmentMode: summary.enrollmentMode },
    summary.enrolled,
  );

  if (!decision.allow) {
    /* "Já matriculado" não é erro do ponto de vista de quem clicou: o efeito
       desejado já está valendo. */
    if (decision.reason === "already_enrolled") return { status: 200, enrolled: true };
    return { status: 400, error: ENROLLMENT_REFUSAL_MESSAGE[decision.reason] };
  }

  /* Auto-inscrição: quem matricula é o próprio aluno. */
  await createEnrollment(command.courseId, command.actor.id, command.actor.id);

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "enrollment_created",
    target: command.courseId,
    outcome: "allowed",
  });

  /* Avisa quem integra (F5-02).

     `enrollment.created` precisa valer para QUALQUER matrícula. Disparar só na
     atribuição pelo gestor faria o integrador perder, sem erro nenhum, todo
     aluno que se inscreveu sozinho — o pior tipo de falha, a silenciosa. */
  if (command.actor.tenantId) {
    await dispatchWebhook(command.actor.tenantId, "enrollment.created", {
      cursoId: command.courseId,
      cursoTitulo: summary.courseTitle,
      alunoId: command.actor.id,
      /* Quem matriculou é o próprio aluno: é o que distingue esta da atribuída. */
      matriculadoPor: command.actor.id,
    });
  }

  return { status: 200, enrolled: true };
}

export interface SaveCommand {
  actor: Actor;
  courseId: string;
  saved: boolean;
}

export type SaveOutcome =
  | { status: 200; saved: boolean }
  | { status: 404; error: string };

/**
 * Marca ou desmarca o curso como favorito.
 *
 * Exige matrícula porque `saved` é uma coluna dela. Favoritar um curso em que
 * não se está inscrito precisaria de outra tabela, e a proposta trata favorito
 * como atalho dentro de "meus cursos".
 */
export async function saveUseCase(command: SaveCommand): Promise<SaveOutcome> {
  const changed = await setSaved(command.courseId, command.actor.id, command.saved);
  if (!changed) return { status: 404, error: "Matrícula não encontrada." };

  return { status: 200, saved: command.saved };
}
