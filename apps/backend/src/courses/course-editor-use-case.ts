import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  COURSE_REFUSAL_MESSAGE,
  canPublish,
  durationFromMinutes,
  validateCourseEdit,
} from "@nerdlms/core/courses/course-editing.ts";

import { uniqueSlug } from "@nerdlms/core/courses/slug.ts";

import {
  createCourse,
  createLesson,
  createModule,
  findCourseOwnership,
  findCourseSlugs,
  findModuleCourse,
  publishCourse,
  setCourseStatus,
  updateCourse,
} from "./course-editor-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Casos de uso da edição de curso.
 *
 * Todos passam por `authorize`, que resolve autoria antes de qualquer escrita.
 * Um curso de outro instrutor responde 404, e não 403: confirmar a existência
 * já seria informação.
 */

/** Falha comum a todas as escritas do editor. */
export type EditorFailure = { status: 400 | 404; error: string };

export type CreateOutcome =
  | { status: 201; courseId: string; slug: string }
  | { status: 400 | 403; error: string };
export type UpdateOutcome = { status: 200; title: string; summary: string } | EditorFailure;
export type PublishOutcome = { status: 200 } | EditorFailure;
export type ModuleOutcome = { status: 201; moduleId: string } | EditorFailure;
export type LessonOutcome = { status: 201; lessonId: string } | EditorFailure;

/**
 * Confere que o curso existe e que o ator pode escrever nele.
 *
 * Exportada para os casos de uso que editam OUTRAS partes do curso —
 * metadados, ordem dos módulos — usarem a mesma decisão. Reimplementá-la em
 * cada um garantiria que uma das cópias divergisse.
 */
export async function authorizeCourse(actor: Actor, courseId: string) {
  const ownership = await findCourseOwnership(courseId);
  if (!ownership) return null;

  const allowed = can(actor, "update", {
    kind: "course",
    authorId: ownership.authorId,
    status: ownership.status,
  });

  return allowed ? ownership : null;
}

export interface UpdateCourseCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
  title: string;
  summary: string;
}

export async function updateCourseUseCase(
  command: UpdateCourseCommand,
): Promise<UpdateOutcome> {
  const ownership = await authorizeCourse(command.actor, command.courseId);
  if (!ownership) {
    /* A tentativa fica registrada mesmo respondendo 404: para quem tentou, o
       curso "não existe"; para quem audita, alguém tentou editar o que não é
       seu. É essa assimetria que torna o registro útil. */
    await recordAudit({
      actorId: command.actor.id,
      actorName: command.actorName,
      action: "access_denied",
      target: `edição de curso (${command.courseId})`,
      outcome: "denied",
    });
    return { status: 404, error: "Curso não encontrado." };
  }

  const validated = validateCourseEdit({ title: command.title, summary: command.summary });
  if (!validated.ok) {
    return { status: 400, error: COURSE_REFUSAL_MESSAGE[validated.reason] };
  }

  await updateCourse(command.courseId, validated.title, validated.summary);
  return { status: 200, title: validated.title, summary: validated.summary };
}

export interface PublishCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
  title: string;
}

export async function publishCourseUseCase(command: PublishCommand): Promise<PublishOutcome> {
  const ownership = await authorizeCourse(command.actor, command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  /* A contagem de aulas vem do banco, não do que o cliente afirma: publicar um
     curso vazio deixaria alunos matriculados em nada. */
  const decision = canPublish({ title: command.title, lessonCount: ownership.lessons });

  if (!decision.ok) {
    return { status: 400, error: COURSE_REFUSAL_MESSAGE[decision.reason] };
  }

  await publishCourse(command.courseId);

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "course_published",
    target: command.title,
    outcome: "allowed",
  });

  return { status: 200 };
}

export interface ModuleCommand {
  actor: Actor;
  courseId: string;
  title: string;
}

export async function addModuleUseCase(
  command: ModuleCommand,
): Promise<ModuleOutcome> {
  const ownership = await authorizeCourse(command.actor, command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  const title = command.title.trim();
  if (title.length === 0) return { status: 400, error: "O módulo precisa de um título." };

  const moduleId = await createModule(command.courseId, title);
  return { status: 201, moduleId };
}

export interface LessonCommand {
  actor: Actor;
  moduleId: string;
  title: string;
  /** Vem de um `<input>`: pode ser qualquer coisa. */
  durationMinutes: unknown;
  /** Chave do arquivo no storage, quando a aula já sobe com ele. */
  mediaKey?: string;

  /* Aula de conteúdo (guia §4). Ausentes numa aula de vídeo comum. */
  kind?: string;
  textContent?: string | null;
  externalUrl?: string | null;
  /** Páginas do documento — o denominador de "chegou ao fim". */
  pageCount?: number | null;
  minSeconds?: number | null;
}

export async function addLessonUseCase(
  command: LessonCommand,
): Promise<LessonOutcome> {
  /* A autoria é do CURSO, não do módulo: sem esta busca, bastaria conhecer o
     id de um módulo alheio para escrever nele. */
  const courseId = await findModuleCourse(command.moduleId);
  if (!courseId) return { status: 404, error: "Módulo não encontrado." };

  const ownership = await authorizeCourse(command.actor, courseId);
  if (!ownership) return { status: 404, error: "Módulo não encontrado." };

  const title = command.title.trim();
  if (title.length === 0) return { status: 400, error: "A aula precisa de um título." };

  /* A chave precisa apontar para dentro do curso: aceitar qualquer texto
     deixaria alguém apontar a aula para o arquivo de outro curso, e o
     download é emitido a partir dela. */
  const mediaKey =
    command.mediaKey && command.mediaKey.startsWith(`aulas/${courseId}/`)
      ? command.mediaKey
      : undefined;

  /* Só os tipos que o produto sabe renderizar. Um valor livre entraria no
     CHECK do banco como erro 500, e um tipo que nenhuma tela conhece deixaria
     a aula em branco para o aluno. */
  const TIPOS = [
    "video", "pdf", "slides", "document", "spreadsheet",
    "image", "audio", "text", "link", "scorm",
  ];

  const kind = command.kind && TIPOS.includes(command.kind) ? command.kind : "video";

  const lessonId = await createLesson(
    command.moduleId,
    title,
    durationFromMinutes(command.durationMinutes),
    mediaKey,
    {
      kind,
      textContent: command.textContent ?? null,
      externalUrl: command.externalUrl ?? null,
      pageCount: command.pageCount ?? null,
      minSeconds: command.minSeconds ?? null,
    },
  );
  return { status: 201, lessonId };
}


export interface CreateCourseCommand {
  actor: Actor;
  actorName: string;
  title: string;
  summary: string;
  /** Projeto do curso. Herda o de quem cria quando ausente. */
  project?: string | undefined;
}

/**
 * Criação de curso.
 *
 * O curso nasce **rascunho e vazio**, com quem cria como autor. Não há como
 * criar já publicado: publicar exige aula, e um curso recém-criado não tem
 * nenhuma — `canPublish` recusaria de qualquer forma.
 *
 * A autoria vem do ator, nunca do corpo da requisição. Aceitar `authorId` de
 * fora deixaria um instrutor criar curso em nome de outro, e a partir daí
 * editá-lo seria negado a ele mesmo — o dono passaria a ser outra pessoa.
 *
 * A recusa aqui é 403, e não 404 como nas demais escritas do editor: não há
 * recurso cuja existência esconder. Quem não pode criar simplesmente não pode.
 */
export async function createCourseUseCase(
  command: CreateCourseCommand,
): Promise<CreateOutcome> {
  /* `status: "draft"` no recurso porque é o que o curso será. Perguntar sobre
     o estado final é o que torna a checagem honesta. */
  const allowed = can(command.actor, "create", {
    kind: "course",
    authorId: command.actor.id,
    status: "draft",
  });
  if (!allowed) return { status: 403, error: "Sem permissão para criar curso." };

  const validated = validateCourseEdit({ title: command.title, summary: command.summary });
  if (!validated.ok) {
    return { status: 400, error: COURSE_REFUSAL_MESSAGE[validated.reason] };
  }

  /* Sem tenant não há onde criar: curso pertence a um cliente, e criar sem
     recorte deixaria a linha órfã (a coluna é NOT NULL). */
  if (!command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para criar curso." };
  }

  const slug = uniqueSlug(validated.title, await findCourseSlugs(command.actor.tenantId));

  const courseId = await createCourse({
    tenantId: command.actor.tenantId,
    slug,
    title: validated.title,
    summary: validated.summary,
    authorId: command.actor.id,
    project: command.project?.trim() || null,
  });

  /* Entra na auditoria: criar curso é ato de autoria, e saber quem criou o quê
     importa quando o catálogo cresce. */
  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "course_created",
    target: `curso ${validated.title}`,
    outcome: "allowed",
  });

  return { status: 201, courseId, slug };
}


export interface RetireCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
  /** `archived` aposenta; `draft` devolve ao rascunho. */
  status: "draft" | "archived";
}

/**
 * Aposenta o curso, ou devolve ao rascunho.
 *
 * Não há exclusão, e é decisão: apagar um curso levaria junto a matrícula, o
 * progresso e os comentários de quem passou por ele, e o certificado já
 * emitido passaria a apontar para nada — o código impresso no PDF deixaria de
 * conferir no validador público.
 *
 * A diferença entre os dois estados:
 *
 * - `archived` — sai do catálogo, não aceita matrícula nova, e quem já cursava
 *   continua com acesso ao conteúdo e ao certificado. É o que se usa quando o
 *   conteúdo envelheceu.
 * - `draft` — some para todo mundo que não é o autor, inclusive para quem
 *   estava matriculado. É para corrigir publicação prematura, não para
 *   aposentar: usar `draft` num curso com gente dentro tira o acesso dessa
 *   gente, e por isso o caso de uso recusa quando há matrícula.
 */
export async function retireCourseUseCase(command: RetireCommand): Promise<PublishOutcome> {
  const ownership = await authorizeCourse(command.actor, command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  if (command.status === "draft" && ownership.enrollments > 0) {
    return {
      status: 400,
      error:
        "Este curso já tem alunos matriculados. Arquive em vez de voltar para rascunho: " +
        "arquivar tira do catálogo e mantém o acesso de quem já começou.",
    };
  }

  await setCourseStatus(command.courseId, command.status);

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    /* Reaproveita `course_deleted` do vocabulário de auditoria: do ponto de
       vista de quem audita, o curso saiu do ar. O alvo diz qual foi o estado. */
    action: "course_deleted",
    target: `curso ${command.courseId} → ${command.status}`,
    outcome: "allowed",
  });

  return { status: 200 };
}
