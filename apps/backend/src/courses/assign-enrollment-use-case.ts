import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  canAssignEnrollment,
  ENROLLMENT_REFUSAL_MESSAGE,
} from "@nerdlms/core/courses/enrollment-rules.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import { notify } from "../notifications/notify.ts";
import { dispatchWebhook } from "../api/webhook-dispatcher.ts";
import { createEnrollment, findEnrollmentSummary } from "./enrollment-repository.ts";
import { findTeamMemberIds } from "./team-repository.ts";

/**
 * Matrícula atribuída — F1-03.
 *
 * O gestor coloca a equipe no treinamento. É o outro lado da auto-inscrição:
 * `enrollment-use-case.ts` cuida de quem se matricula sozinho, este cuida de
 * quem é matriculado por alguém.
 *
 * Três verificações, e a ordem importa:
 *
 *   1. o PAPEL pode matricular alguém? (`can`)
 *   2. essas pessoas são da equipe de quem está matriculando?
 *   3. o curso aceita matrícula?
 *
 * A checagem de equipe vem antes da de curso porque recusar por "já está
 * matriculado" alguém de fora da equipe confirmaria a existência daquela
 * pessoa e daquela matrícula a um gestor que não deveria saber nada sobre ela.
 */

export interface AssignEnrollmentCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
  /** Quem matricular. Uma lista porque atribuir treinamento é ação de turma. */
  learnerIds: string[];
  ip?: string | null;
}

export interface AssignResult {
  /** Matriculados agora. */
  enrolled: number;
  /** Ignorados por já estarem no curso — não é erro. */
  skipped: number;
}

export type AssignOutcome =
  | { status: 200; result: AssignResult }
  | { status: 400 | 403 | 404; error: string };

export async function assignEnrollmentUseCase(
  command: AssignEnrollmentCommand,
): Promise<AssignOutcome> {
  if (command.learnerIds.length === 0) {
    return { status: 400, error: "Nenhuma pessoa selecionada." };
  }

  /* O papel primeiro: sem isso, um aluno descobriria pela mensagem de erro
     quem existe na base tentando matricular gente.

     `learnerId` é a PESSOA A MATRICULAR, não o ator. Passar o próprio ator
     aqui fazia a regra do aluno (`isAuthor(actor, resource.learnerId)`)
     responder "sim, pode matricular a si mesmo" — e um aluno atravessava esta
     porta para ser barrado só na checagem de equipe, com a mensagem errada.

     Basta a primeira pessoa da lista: a regra decide por papel, e um aluno é
     recusado para qualquer alvo que não seja ele mesmo. */
  const primeira = command.learnerIds[0]!;

  /* Esta rota é para matricular OUTRAS pessoas. Quem tenta se incluir na lista
     está usando o caminho errado — e o caminho certo (`enrollUseCase`) aplica
     a regra `assigned_only`, que impede o aluno de entrar sozinho em
     treinamento obrigatório. Sem esta recusa, bastaria vir por aqui para
     contorná-la. */
  if (command.learnerIds.includes(command.actor.id)) {
    return { status: 403, error: "Use a inscrição normal para se matricular." };
  }

  if (
    !can(command.actor, "enroll", {
      kind: "enrollment",
      learnerId: primeira,
      courseAuthorId: "",
    })
  ) {
    await recordAudit({
      actorId: command.actor.id,
      actorName: command.actorName,
      action: "enrollment_created",
      target: `curso ${command.courseId}`,
      outcome: "denied",
      ip: command.ip ?? null,
    });

    return { status: 403, error: "Sem permissão para matricular outras pessoas." };
  }

  /* Quem é da equipe. O admin não tem recorte de equipe — matricula qualquer
     pessoa do tenant —, e é por isso que a consulta recebe o papel. */
  const daEquipe = await findTeamMemberIds(command.actor);
  const forasteiro = command.learnerIds.find((id) => !daEquipe.has(id));

  if (forasteiro) {
    await recordAudit({
      actorId: command.actor.id,
      actorName: command.actorName,
      action: "enrollment_created",
      target: `curso ${command.courseId}`,
      outcome: "denied",
      ip: command.ip ?? null,
    });

    return { status: 403, error: ENROLLMENT_REFUSAL_MESSAGE.outside_team };
  }

  let enrolled = 0;
  let skipped = 0;

  for (const learnerId of command.learnerIds) {
    const summary = await findEnrollmentSummary(command.courseId, learnerId);

    /* Curso inexistente derruba a operação inteira: é engano de quem chamou,
       não situação a contornar pessoa a pessoa. */
    if (!summary) return { status: 404, error: "Curso não encontrado." };

    /* O resumo chama de `courseStatus` o que a regra chama de `status`. O
       mapeamento é explícito para o dia em que um dos dois nomes mudar. */
    const decision = canAssignEnrollment(
      { status: summary.courseStatus, enrollmentMode: summary.enrollmentMode },
      summary.enrolled,
      /* A equipe já foi verificada acima, para a lista inteira. */
      true,
    );

    if (!decision.allow) {
      /* Já matriculado é ignorado em silêncio — matricular uma turma em que
         metade já está no curso é normal, e falhar por isso obrigaria o gestor
         a descobrir quem já estava para refazer a seleção. */
      if (decision.reason === "already_enrolled") {
        skipped += 1;
        continue;
      }

      return { status: 400, error: ENROLLMENT_REFUSAL_MESSAGE[decision.reason] };
    }

    await createEnrollment(command.courseId, learnerId, command.actor.id);
    enrolled += 1;

    /* Avisa quem foi matriculado (F4-03). Antes disto, a pessoa descobria o
       curso novo abrindo a plataforma por acaso. */
    await notify({
      userId: learnerId,
      kind: "enrollment",
      title: `Você foi matriculado em ${summary.courseTitle}`,
      body: `${command.actorName} matriculou você no curso ${summary.courseTitle}.`,
      link: `/cursos/${command.courseId}`,
      values: { curso: summary.courseTitle },
    });

    /* E avisa quem integra (F5-02). O disparo nunca derruba a matrícula — o
       dispatcher engole o próprio erro.

       O tenant vem do ATOR: quem matricula está dentro do cliente, e não há
       `ownership` aqui, porque a autorização desta ação é por `enroll` e não
       por autoria do curso. */
    if (command.actor.tenantId) {
      await dispatchWebhook(command.actor.tenantId, "enrollment.created", {
        cursoId: command.courseId,
        cursoTitulo: summary.courseTitle,
        alunoId: learnerId,
        matriculadoPor: command.actor.id,
      });
    }
  }

  /* Um registro para a ação, não um por pessoa: o que se audita é "o gestor
     atribuiu este curso a N pessoas". */
  if (enrolled > 0) {
    await recordAudit({
      actorId: command.actor.id,
      actorName: command.actorName,
      action: "enrollment_created",
      target: `curso ${command.courseId}, ${enrolled} ${enrolled === 1 ? "pessoa" : "pessoas"}`,
      outcome: "allowed",
      ip: command.ip ?? null,
    });
  }

  return { status: 200, result: { enrolled, skipped } };
}
