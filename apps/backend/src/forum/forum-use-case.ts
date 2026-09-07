import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { extractMentions } from "@nerdlms/core/notifications/events.ts";

import { findEnrollmentId } from "../assessment/enrollment-lookup.ts";
import { findCourseOwnership } from "../courses/course-editor-repository.ts";
import { notify, notifyMany } from "../notifications/notify.ts";
import {
  createPost,
  createTopic,
  findSubscribers,
  findTopic,
  moderatePost,
  reportPost,
  setTopicFlags,
  subscribe,
  unsubscribe,
} from "./forum-repository.ts";
import {
  findCourseOfPost,
  findTenantOfCourse,
  findUsersByLogin,
} from "./mention-repository.ts";

/**
 * Fórum do curso — F4-01 e F4-02.
 *
 * Quem PARTICIPA é quem está matriculado; quem MODERA é o autor do curso ou um
 * admin. As duas permissões são distintas de propósito: o instrutor não precisa
 * estar matriculado no próprio curso para moderá-lo, e o aluno matriculado não
 * pode fixar tópico.
 */

/** Pode ler e escrever no fórum deste curso? */
async function canParticipate(actor: Actor, courseId: string): Promise<boolean> {
  if (await canModerate(actor, courseId)) return true;
  return (await findEnrollmentId(courseId, actor.id)) !== null;
}

/** Pode fixar, fechar e ocultar? */
async function canModerate(actor: Actor, courseId: string): Promise<boolean> {
  if (actor.role === "admin") return true;

  const ownership = await findCourseOwnership(courseId);
  return ownership?.authorId === actor.id;
}

export interface TopicCommand {
  actor: Actor;
  courseId: string;
  title: string;
  body: string;
}

/* Sucesso e falha em ramos separados por status: um `200 | 201` num ramo só
   impede o TypeScript de estreitar por `status !== 201`, e a rota precisa
   disso para ler `error` com segurança. */
export type ForumFailure = { status: 400 | 403 | 404; error: string };

/** Quem CRIA devolve o id; quem só age devolve 200. Tipos distintos para a
    rota poder estreitar por status e ler `error` com segurança. */
export type CreateOutcome = { status: 201; id: string } | ForumFailure;
export type ActionOutcome = { status: 200 } | ForumFailure;

export async function createTopicUseCase(command: TopicCommand): Promise<CreateOutcome> {
  const ownership = await findCourseOwnership(command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  if (!(await canParticipate(command.actor, command.courseId))) {
    /* 404 e não 403: quem não está no curso não precisa saber que ele tem
       fórum — a mesma regra de aula alheia. */
    return { status: 404, error: "Curso não encontrado." };
  }

  if (command.title.trim() === "" || command.body.trim() === "") {
    return { status: 400, error: "O tópico precisa de título e mensagem." };
  }

  const id = await createTopic({
    tenantId: ownership.tenantId,
    courseId: command.courseId,
    authorId: command.actor.id,
    title: command.title,
    body: command.body,
  });

  return { status: 201, id };
}

export interface PostCommand {
  actor: Actor;
  actorName: string;
  topicId: string;
  body: string;
  parentId?: string | null;
}

/**
 * Responde num tópico e avisa quem precisa saber.
 *
 * Duas notificações diferentes, e a ordem importa: quem foi MENCIONADO recebe
 * o aviso de menção, e não também o de resposta. Receber dois avisos da mesma
 * mensagem é o tipo de ruído que faz a pessoa desligar tudo.
 */
export async function createPostUseCase(command: PostCommand): Promise<CreateOutcome> {
  const topico = await findTopic(command.topicId, command.actor.id);
  if (!topico) return { status: 404, error: "Tópico não encontrado." };

  if (!(await canParticipate(command.actor, topico.courseId))) {
    return { status: 404, error: "Tópico não encontrado." };
  }

  /* Tópico fechado aceita leitura, recusa resposta. Moderador também não
     escreve: reabrir é o gesto correto, e responder num tópico fechado
     confundiria quem o fechou. */
  if (topico.closed) {
    return { status: 403, error: "Este tópico foi fechado." };
  }

  if (command.body.trim() === "") {
    return { status: 400, error: "Escreva uma mensagem." };
  }

  const id = await createPost({
    topicId: command.topicId,
    authorId: command.actor.id,
    body: command.body,
    parentId: command.parentId ?? null,
  });

  /* Quem escreve passa a acompanhar: respondeu, quer saber o que vem depois. */
  await subscribe(command.topicId, command.actor.id);

  /* O tenant vem do CURSO: sem ele, um `@ana` encontraria a Ana de outro
     cliente e a notificação atravessaria a fronteira. */
  const tenantId = await findTenantOfCourse(topico.courseId);
  const mencionados = tenantId
    ? await findUsersByLogin(extractMentions(command.body), tenantId)
    : [];
  const avisados = new Set<string>();

  for (const userId of mencionados) {
    if (userId === command.actor.id) continue; // mencionar a si mesmo não avisa

    await notify({
      userId,
      kind: "forum_mention",
      title: `${command.actorName} mencionou você`,
      body: `Em "${topico.title}": ${resumo(command.body)}`,
      link: `/forum/${command.topicId}`,
      values: { topico: topico.title, autor: command.actorName },
    });

    avisados.add(userId);
  }

  /* Os assinantes que NÃO foram mencionados: quem foi mencionado já recebeu. */
  const assinantes = (await findSubscribers(command.topicId, command.actor.id)).filter(
    (id) => !avisados.has(id),
  );

  await notifyMany(assinantes, {
    kind: "forum_reply",
    title: `Nova resposta em "${topico.title}"`,
    body: `${command.actorName}: ${resumo(command.body)}`,
    link: `/forum/${command.topicId}`,
    values: { topico: topico.title, autor: command.actorName },
  });

  return { status: 201, id };
}

/** As primeiras palavras, para o aviso não repetir a mensagem inteira. */
function resumo(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, " ");
  return limpo.length <= 120 ? limpo : `${limpo.slice(0, 117)}...`;
}

export interface ModerateCommand {
  actor: Actor;
  topicId?: string;
  postId?: string;
  pinned?: boolean;
  closed?: boolean;
  hide?: boolean;
  reason?: string | null;
}

export async function moderateUseCase(command: ModerateCommand): Promise<ActionOutcome> {
  if (command.topicId) {
    const topico = await findTopic(command.topicId, command.actor.id);
    if (!topico) return { status: 404, error: "Tópico não encontrado." };

    if (!(await canModerate(command.actor, topico.courseId))) {
      return { status: 403, error: "Sem permissão para moderar este fórum." };
    }

    await setTopicFlags(command.topicId, {
      ...(command.pinned !== undefined ? { pinned: command.pinned } : {}),
      ...(command.closed !== undefined ? { closed: command.closed } : {}),
    });

    return { status: 200 };
  }

  if (command.postId && command.hide !== undefined) {
    const courseId = await findCourseOfPost(command.postId);
    if (!courseId) return { status: 404, error: "Mensagem não encontrada." };

    if (!(await canModerate(command.actor, courseId))) {
      return { status: 403, error: "Sem permissão para moderar este fórum." };
    }

    await moderatePost(command.postId, command.hide, command.actor.id, command.reason ?? null);
    return { status: 200 };
  }

  return { status: 400, error: "Nada a moderar." };
}

export interface ReportCommand {
  actor: Actor;
  postId: string;
  reason: string;
}

/** Denunciar é de qualquer participante — é o contrário de moderar. */
export async function reportUseCase(command: ReportCommand): Promise<ActionOutcome> {
  const courseId = await findCourseOfPost(command.postId);
  if (!courseId) return { status: 404, error: "Mensagem não encontrada." };

  if (!(await canParticipate(command.actor, courseId))) {
    return { status: 404, error: "Mensagem não encontrada." };
  }

  if (command.reason.trim() === "") {
    return { status: 400, error: "Diga o motivo da denúncia." };
  }

  await reportPost(command.postId, command.actor.id, command.reason);
  return { status: 200 };
}

export interface SubscribeCommand {
  actor: Actor;
  topicId: string;
  subscribe: boolean;
}

export async function subscribeUseCase(command: SubscribeCommand): Promise<ActionOutcome> {
  const topico = await findTopic(command.topicId, command.actor.id);
  if (!topico) return { status: 404, error: "Tópico não encontrado." };

  if (!(await canParticipate(command.actor, topico.courseId))) {
    return { status: 404, error: "Tópico não encontrado." };
  }

  if (command.subscribe) await subscribe(command.topicId, command.actor.id);
  else await unsubscribe(command.topicId, command.actor.id);

  return { status: 200 };
}

