import {
  assignClassUseCase,
  classStatusUseCase,
  createClassUseCase,
} from "@nerdlms/backend/courses/class-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST  /api/turmas — cria turma, ou move matrículas para uma turma.
 * PATCH /api/turmas — abre ou fecha a turma.
 */

export const dynamic = "force-dynamic";

/** Hoje em ISO local (AAAA-MM-DD), para a regra de turma encerrada. */
function hoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.courseId)) {
    return Response.json({ error: "Curso não informado." }, { status: 400 });
  }

  const actor = actorOf(user);
  const courseId = String(body.courseId);

  /* Distribuir em turma é um POST próprio: as pessoas já estão matriculadas, e
     isto move quem já entrou. */
  if (Array.isArray(body.learnerIds)) {
    if (!isUuid(body.classId)) {
      return Response.json({ error: "Turma não informada." }, { status: 400 });
    }

    if (body.learnerIds.length === 0 || !body.learnerIds.every((v: unknown) => isUuid(v))) {
      return Response.json({ error: "Seleção inválida." }, { status: 400 });
    }

    const outcome = await assignClassUseCase({
      actor,
      courseId,
      classId: String(body.classId),
      learnerIds: body.learnerIds as string[],
      today: hoje(),
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ moved: outcome.moved });
  }

  const texto = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

  const outcome = await createClassUseCase({
    actor,
    courseId,
    name: typeof body.name === "string" ? body.name : "",
    instructorId: isUuid(body.instructorId) ? body.instructorId : null,
    startsOn: texto(body.startsOn),
    endsOn: texto(body.endsOn),
    capacity:
      typeof body.capacity === "number" && Number.isFinite(body.capacity) ? body.capacity : null,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ classId: outcome.classId });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (!isUuid(body.courseId) || !isUuid(body.classId)) {
    return Response.json({ error: "Turma não informada." }, { status: 400 });
  }

  if (body.status !== "open" && body.status !== "closed") {
    return Response.json({ error: "Situação inválida." }, { status: 400 });
  }

  const outcome = await classStatusUseCase({
    actor: actorOf(user),
    courseId: String(body.courseId),
    classId: String(body.classId),
    status: body.status,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ ok: true });
}
