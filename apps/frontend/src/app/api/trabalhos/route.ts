import {
  gradeEssayUseCase,
  gradeSubmissionUseCase,
  submitAssignmentUseCase,
} from "@nerdlms/backend/assessment/assignment-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/trabalhos — entrega um trabalho.
 * PATCH /api/trabalhos — corrige (trabalho ou dissertativa da prova).
 *
 * As duas correções moram na mesma rota porque são o mesmo gesto — alguém lê,
 * pontua e comenta — e exigem a mesma autorização: ser dono do curso.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.assignmentId)) {
    return Response.json({ error: "Trabalho não informado." }, { status: 400 });
  }

  /* Os arquivos já subiram para o storage por URL assinada; aqui vêm só os
     metadados. O mesmo desenho do vídeo e do material (DEC-009). */
  const arquivos = Array.isArray(body.files)
    ? body.files.flatMap((f: unknown) => {
        if (typeof f !== "object" || f === null) return [];
        const item = f as Record<string, unknown>;

        if (typeof item.name !== "string" || typeof item.storageKey !== "string") return [];

        return [
          {
            name: item.name,
            storageKey: item.storageKey,
            sizeBytes: typeof item.sizeBytes === "number" ? item.sizeBytes : 0,
          },
        ];
      })
    : [];

  const outcome = await submitAssignmentUseCase({
    actor: actorOf(user),
    assignmentId: String(body.assignmentId),
    text: typeof body.text === "string" ? body.text : null,
    files: arquivos,
  });

  if (outcome.status !== 201) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ submissionId: outcome.submissionId, late: outcome.late }, { status: 201 });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (typeof body.points !== "number" || !Number.isFinite(body.points)) {
    return Response.json({ error: "Informe a nota." }, { status: 400 });
  }

  const actor = actorOf(user);
  const feedback = typeof body.feedback === "string" ? body.feedback : null;

  /* Dissertativa da prova: identificada pelo par tentativa + questão. */
  if (isUuid(body.attemptId) && isUuid(body.questionId)) {
    const outcome = await gradeEssayUseCase({
      actor,
      attemptId: String(body.attemptId),
      questionId: String(body.questionId),
      points: body.points,
      feedback,
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  if (!isUuid(body.submissionId)) {
    return Response.json({ error: "Entrega não informada." }, { status: 400 });
  }

  /* Notas por critério, quando o trabalho tem rubrica. A soma delas vira a
     nota — o `points` do corpo é ignorado nesse caso. */
  const rubricScores = Array.isArray(body.rubricScores)
    ? body.rubricScores.flatMap((item: unknown) => {
        if (typeof item !== "object" || item === null) return [];
        const c = item as Record<string, unknown>;

        if (!isUuid(c.criterionId) || typeof c.points !== "number") return [];

        return [
          {
            criterionId: String(c.criterionId),
            points: c.points,
            comment: typeof c.comment === "string" ? c.comment : null,
          },
        ];
      })
    : [];

  const feedbackFiles = Array.isArray(body.feedbackFiles)
    ? body.feedbackFiles.flatMap((item: unknown) => {
        if (typeof item !== "object" || item === null) return [];
        const f = item as Record<string, unknown>;

        if (typeof f.name !== "string" || typeof f.storageKey !== "string") return [];

        return [
          {
            name: f.name,
            storageKey: f.storageKey,
            sizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : 0,
          },
        ];
      })
    : [];

  const outcome = await gradeSubmissionUseCase({
    actor,
    actorName: user.fullName,
    submissionId: String(body.submissionId),
    points: body.points,
    feedback,
    reason: typeof body.reason === "string" ? body.reason : null,
    ...(rubricScores.length > 0 ? { rubricScores } : {}),
    ...(feedbackFiles.length > 0 ? { feedbackFiles } : {}),
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ ok: true });
}
