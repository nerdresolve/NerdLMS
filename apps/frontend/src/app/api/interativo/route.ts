import {
  findInteractiveOfLesson,
  findItem,
  findResponses,
  recordResponse,
  saveInteractive,
} from "@nerdlms/backend/interactive/interactive-repository.ts";
import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { courseOfLesson } from "@nerdlms/backend/courses/course-editor-repository.ts";
import {
  canCompleteInteractive,
  checkAnswer,
  summarize,
  toPublicItem,
  type InteractiveKind,
} from "@nerdlms/core/interactive/interactive.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * GET  /api/interativo?aula=id — o conteúdo interativo, SEM gabarito.
 * POST /api/interativo         — responde uma interação, ou salva o conteúdo.
 *
 * O GABARITO NUNCA SAI DAQUI. `toPublicItem` remove `correct` e `feedback` de
 * cada alternativa antes de serializar — mandá-los junto faria a resposta certa
 * aparecer no código-fonte da página, e a interação viraria decoração.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const lessonId = new URL(request.url).searchParams.get("aula");
  if (!lessonId || !isUuid(lessonId)) {
    return Response.json({ error: "Aula inválida." }, { status: 400 });
  }

  const conteudo = await findInteractiveOfLesson(user.tenant.id, lessonId);
  if (!conteudo) return Response.json({ error: "Não encontrado." }, { status: 404 });

  /* As respostas são POR MATRÍCULA. Sem matrícula, a pessoa vê o conteúdo mas
     não tem progresso — é o caso do instrutor revisando a própria aula. */
  const enrollmentId = await findEnrollmentId(await cursoDaAula(lessonId), user.id);

  const respostas = enrollmentId ? await findResponses(enrollmentId, conteudo.id) : [];

  return Response.json({
    id: conteudo.id,
    kind: conteudo.kind,
    title: conteudo.title,
    mediaUrl: conteudo.mediaUrl,
    requiredInteractions: conteudo.requiredInteractions,
    items: conteudo.items.map(toPublicItem),
    /* O que a pessoa já respondeu — só o id e se acertou, nunca o gabarito de
       quem ainda não respondeu. */
    responses: respostas.map((r) => ({
      itemId: r.itemId,
      answer: r.answer,
      correct: r.correct,
      attempts: r.attempts,
    })),
    summary: summarize(conteudo, respostas),
    canComplete: canCompleteInteractive(conteudo, respostas),
  });
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  /* Salvar o conteúdo é do instrutor; responder é de quem faz o curso. Duas
     ações na mesma rota, distinguidas por `acao` e não por adivinhar o corpo. */
  if (body.acao === "salvar") {
    return salvarConteudo(user, body);
  }

  if (!isUuid(body.itemId)) {
    return Response.json({ error: "Interação inválida." }, { status: 400 });
  }

  const encontrado = await findItem(user.tenant.id, String(body.itemId));
  if (!encontrado) return Response.json({ error: "Não encontrado." }, { status: 404 });

  const enrollmentId = await findEnrollmentId(
    await cursoDaAula(encontrado.lessonId),
    user.id,
  );

  if (!enrollmentId) {
    return Response.json({ error: "Você não está matriculado neste curso." }, { status: 403 });
  }

  const resposta = typeof body.answer === "string" ? body.answer : null;

  /* A CONFERÊNCIA É AQUI, no servidor. O navegador nunca recebeu o gabarito, e
     é por isso que ele não pode conferir. */
  const resultado = checkAnswer(encontrado.item, resposta);

  const attempts = await recordResponse({
    itemId: encontrado.item.id,
    enrollmentId,
    answer: resposta,
    correct: resultado.kind === "acknowledged" ? null : resultado.kind === "correct",
  });

  const conteudo = await findInteractiveOfLesson(user.tenant.id, encontrado.lessonId);
  const respostas = conteudo ? await findResponses(enrollmentId, conteudo.id) : [];

  return Response.json({
    result: resultado.kind,
    feedback: "feedback" in resultado ? resultado.feedback : null,
    /* A explicação só vai DEPOIS de responder — antes ela é o gabarito. */
    explanation: resultado.kind === "acknowledged" ? null : encontrado.item.body,
    attempts,
    ...(conteudo
      ? {
          summary: summarize(conteudo, respostas),
          canComplete: canCompleteInteractive(conteudo, respostas),
        }
      : {}),
  });
}

/** Salva o conteúdo interativo de uma aula — instrutor e admin. */
async function salvarConteudo(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
  body: Record<string, unknown>,
): Promise<Response> {
  const actor = actorOf(user);

  if (actor.role !== "admin" && actor.role !== "instructor") {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (!isUuid(body.lessonId)) {
    return Response.json({ error: "Aula inválida." }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  const kindsValidos: InteractiveKind[] = [
    "interactive_video",
    "image_hotspots",
    "flashcards",
  ];

  if (!kindsValidos.includes(kind as InteractiveKind)) {
    return Response.json({ error: "Tipo de conteúdo inválido." }, { status: 400 });
  }

  const itensBrutos = Array.isArray(body.items) ? body.items : [];

  const items = itensBrutos
    .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
    .filter((i) => typeof i.prompt === "string" && i.prompt.trim() !== "")
    .map((i, indice) => ({
      position: indice,
      atSeconds: numeroOuNulo(i.atSeconds),
      xPercent: numeroOuNulo(i.xPercent),
      yPercent: numeroOuNulo(i.yPercent),
      prompt: String(i.prompt),
      body: typeof i.body === "string" && i.body !== "" ? i.body : null,
      options: Array.isArray(i.options)
        ? i.options
            .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
            .filter((o) => typeof o.text === "string" && o.text.trim() !== "")
            .map((o) => ({
              text: String(o.text),
              correct: o.correct === true,
              ...(typeof o.feedback === "string" && o.feedback !== ""
                ? { feedback: o.feedback }
                : {}),
            }))
        : [],
      blocking: i.blocking !== false,
    }));

  const semGabarito = items.find(
    (i) => i.options.length > 0 && !i.options.some((o) => o.correct),
  );

  if (semGabarito) {
    /* Pergunta sem alternativa correta nunca pode ser acertada — e quem
       responder vai errar sem entender por quê. */
    return Response.json(
      { error: `A pergunta "${semGabarito.prompt.slice(0, 40)}" não tem alternativa correta.` },
      { status: 400 },
    );
  }

  const id = await saveInteractive({
    tenantId: user.tenant.id,
    lessonId: String(body.lessonId),
    kind: kind as InteractiveKind,
    title: String(body.title ?? "Conteúdo interativo"),
    mediaUrl: typeof body.mediaUrl === "string" && body.mediaUrl !== "" ? body.mediaUrl : null,
    requiredInteractions: numeroOuNulo(body.requiredInteractions),
    items,
  });

  return Response.json({ id }, { status: 201 });
}

function numeroOuNulo(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** O curso de uma aula, para achar a matrícula. */
async function cursoDaAula(lessonId: string): Promise<string> {
  return (await courseOfLesson(lessonId)) ?? "";
}
