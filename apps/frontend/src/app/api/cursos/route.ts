import {
  addLessonUseCase,
  addModuleUseCase,
  createCourseUseCase,
  publishCourseUseCase,
  retireCourseUseCase,
  updateCourseUseCase,
} from "@nerdlms/backend/courses/course-editor-use-case.ts";
import { courseMetadataUseCase } from "@nerdlms/backend/courses/course-metadata-use-case.ts";
import { reorderUseCase } from "@nerdlms/backend/courses/reorder-use-case.ts";
import { duplicateCourseUseCase } from "@nerdlms/backend/courses/duplicate-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * PATCH /api/cursos — salva título e resumo, ou publica.
 * POST  /api/cursos — cria curso, ou acrescenta módulo ou aula.
 *
 * Uma rota só porque todas as ações operam sobre o mesmo recurso e exigem a
 * mesma autorização: ser autor do curso. Separá-las multiplicaria a checagem
 * sem separar responsabilidade nenhuma.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const actor = actorOf(user);

  /* Reordenar é gesto próprio: o cliente manda a lista inteira na ordem nova,
     e o caso de uso confere que ela é uma permutação exata da atual. */
  if (body.reorder === "modules" || body.reorder === "lessons") {
    /* `parentId` é o curso (reordenando módulos) ou o módulo (reordenando
       aulas) — nos dois casos um UUID, e um valor livre viraria erro de banco
       dentro do caso de uso. */
    if (!isUuid(body.parentId)) {
      return Response.json({ error: "Destino não informado." }, { status: 400 });
    }

    if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((v: unknown) => isUuid(v))) {
      return Response.json({ error: "Ordem inválida." }, { status: 400 });
    }

    const outcome = await reorderUseCase({
      actor,
      parentId: String(body.parentId),
      orderedIds: body.orderedIds as string[],
      kind: body.reorder,
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  /* As demais ações operam sobre um curso identificado no corpo. Reordenar
     não passa por aqui: ela informa `parentId`, que é o curso OU o módulo. */
  if (!isUuid(body.courseId)) {
    return Response.json({ error: "Curso não informado." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";

  /* Metadados são um gesto próprio na interface — painel separado do título —
     e por isso um caminho próprio aqui. Sem isto, salvar a carga horária
     exigiria reenviar título e resumo para não apagá-los. */
  if (body.metadata === true) {
    const texto = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
    /* Extraído para variável: o type guard de `isUuid` não estreita dentro de
       um ternário passado como argumento. */
    const categoryId = isUuid(body.categoryId) ? body.categoryId : null;
    /* `body.courseId` já passou por `isUuid` na guarda acima, mas o
       estreitamento não sobrevive ao acesso à propriedade de um índice. */
    const courseId = String(body.courseId);
    const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

    const outcome = await courseMetadataUseCase({
      actor,
      actorName: user.fullName,
      courseId,
      categoryId,
      code: texto(body.code),
      workloadMinutes: numero(body.workloadMinutes),
      level:
        body.level === "basic" || body.level === "intermediate" || body.level === "advanced"
          ? body.level
          : null,
      language: texto(body.language),
      objectives: texto(body.objectives),
      audience: texto(body.audience),
      startsOn: texto(body.startsOn),
      endsOn: texto(body.endsOn),
      visibility: body.visibility === "unlisted" ? "unlisted" : "catalog",
      contentRelease: body.contentRelease === "sequential" ? "sequential" : "open",
      ...(Array.isArray(body.tags)
        ? { tags: body.tags.filter((t: unknown): t is string => typeof t === "string") }
        : {}),
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  /* Tirar do ar é ação própria: `archived` aposenta, `draft` devolve ao
     rascunho. Vem antes das demais porque não depende do título. */
  if (body.status === "archived" || body.status === "draft") {
    const outcome = await retireCourseUseCase({
      actor,
      actorName: user.fullName,
      courseId: body.courseId,
      status: body.status,
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  /* Publicar exige o título porque a regra recusa curso sem nome — e o título
     em edição pode não ser o que está gravado. */
  const outcome =
    body.publish === true
      ? await publishCourseUseCase({ actor, actorName: user.fullName, courseId: body.courseId, title })
      : await updateCourseUseCase({
          actor,
          actorName: user.fullName,
          courseId: body.courseId,
          title,
          summary: typeof body.summary === "string" ? body.summary : "",
        });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  /* Duplicar (F2-07): cria um curso NOVO a partir de outro, e por isso é POST.
     A cópia nasce rascunho e pertence a quem duplicou. */
  if (body.duplicate === true) {
    if (!isUuid(body.courseId)) {
      return Response.json({ error: "Curso não informado." }, { status: 400 });
    }

    const outcome = await duplicateCourseUseCase({
      actor: actorOf(user),
      actorName: user.fullName,
      courseId: String(body.courseId),
      ...(typeof body.title === "string" ? { title: body.title } : {}),
    });

    if (outcome.status !== 201) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }

    return Response.json(
      { courseId: outcome.courseId, modules: outcome.modules, lessons: outcome.lessons },
      { status: 201 },
    );
  }

  const actor = actorOf(user);
  const title = typeof body.title === "string" ? body.title : "";


  /* `moduleId` presente significa "aula dentro deste módulo"; `courseId`
     sozinho significa "módulo novo neste curso". */
  if (isUuid(body.moduleId)) {
    const outcome = await addLessonUseCase({
      actor,
      moduleId: body.moduleId,
      title,
      durationMinutes: body.durationMinutes,
      ...(typeof body.mediaKey === "string" && body.mediaKey ? { mediaKey: body.mediaKey } : {}),

      /* Aula de conteúdo (guia §4): o tipo vem da extensão e a contagem de
         páginas do próprio PDF, os dois calculados no cliente que já tem o
         arquivo em mãos. O caso de uso valida o tipo contra a lista que o
         produto sabe renderizar — um valor livre viraria erro de CHECK. */
      ...(typeof body.kind === "string" ? { kind: body.kind } : {}),
      ...(typeof body.pageCount === "number" ? { pageCount: body.pageCount } : {}),
      ...(typeof body.minSeconds === "number" ? { minSeconds: body.minSeconds } : {}),
    });

    if (outcome.status !== 201) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ lessonId: outcome.lessonId }, { status: 201 });
  }

  /* Sem `moduleId` nem `courseId`, o pedido é de curso NOVO: não há a que
     pendurá-lo. É o único caso do POST que não parte de algo existente. */
  if (!isUuid(body.courseId)) {
    if (typeof body.summary === "string" || title) {
      const outcome = await createCourseUseCase({
        actor,
        actorName: user.fullName,
        title,
        summary: typeof body.summary === "string" ? body.summary : "",
        ...(typeof body.project === "string" && body.project ? { project: body.project } : {}),
      });

      if (outcome.status !== 201) {
        return Response.json({ error: outcome.error }, { status: outcome.status });
      }
      return Response.json(
        { courseId: outcome.courseId, slug: outcome.slug },
        { status: 201 },
      );
    }

    return Response.json({ error: "Curso não informado." }, { status: 400 });
  }

  const outcome = await addModuleUseCase({ actor, courseId: body.courseId, title });
  if (outcome.status !== 201) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ moduleId: outcome.moduleId }, { status: 201 });
}
