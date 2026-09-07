import { isCompleted, isPassed, type LessonStatus } from "@nerdlms/core/scorm/runtime.ts";
import {
  isCompleted2004,
  isPassed2004,
  type CompletionStatus,
  type ExitMode,
  type Scorm2004State,
  type SuccessStatus,
} from "@nerdlms/core/scorm/runtime-2004.ts";
import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { findLessonCourse } from "@nerdlms/backend/courses/material-repository.ts";
import { setManualCompletion } from "@nerdlms/backend/courses/progress-repository.ts";
import {
  findPackageByLesson,
  save2004Tracking,
  saveTracking,
} from "@nerdlms/backend/scorm/scorm-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/scorm — grava o tracking que o conteúdo reportou.
 *
 * O corpo vem do pacote SCORM, que é de terceiro: cada campo é validado, e o
 * que não serve é descartado em vez de recusar a requisição inteira. Recusar
 * faria a pessoa perder a sessão de estudo por causa de um campo torto.
 */

export const dynamic = "force-dynamic";

const STATUS: LessonStatus[] = [
  "passed", "completed", "failed", "incomplete", "browsed", "not attempted",
];

const COMPLETION: CompletionStatus[] = ["completed", "incomplete", "not attempted", "unknown"];
const SUCCESS: SuccessStatus[] = ["passed", "failed", "unknown"];
const EXIT: ExitMode[] = ["", "time-out", "suspend", "logout", "normal"];

/** Número, ou nulo. O conteúdo manda string, e às vezes manda lixo. */
function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.lessonId)) {
    return Response.json({ error: "Aula não informada." }, { status: 400 });
  }

  const lessonId = String(body.lessonId);

  const pacote = await findPackageByLesson(lessonId);
  if (!pacote) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  /* A matrícula é a autorização: sem ela, um id de aula alheia gravaria
     tracking no curso de outra pessoa. */
  const courseId = await findLessonCourse(lessonId);
  const enrollmentId = courseId ? await findEnrollmentId(courseId, user.id) : null;

  if (!enrollmentId) {
    /* PRÉ-VISUALIZAÇÃO: quem edita o curso vê o conteúdo rodar, e nada é
       gravado — não há matrícula onde gravar.

       A resposta é 200, não erro. O pacote SCORM chama `LMSCommit` a cada
       poucos segundos, e um 404 faria muitos deles mostrarem "erro ao salvar"
       ao instrutor que só queria conferir o conteúdo. `salvo: false` diz a
       verdade sem alarmar. */
    return Response.json({ ok: true, salvo: false, preview: true });
  }

  /* O tempo de sessão vem do cliente e tem TETO: sem ele, um pacote defeituoso
     (ou alguém curioso) somaria mil horas ao tempo total do curso. Quatro horas
     é mais que qualquer sessão real de treinamento. */
  const sessaoSegundos = Math.min(4 * 3600, Math.max(0, numero(body.sessionSeconds) ?? 0));

  /* A versão vem do PACOTE, não do corpo da requisição. Confiar no que o
     cliente declara deixaria um corpo forjado gravar no vocabulário errado —
     e o conteúdo passaria a ler campos vazios na volta. */
  if (pacote.version === "2004") {
    const state: Scorm2004State = {
      completionStatus:
        typeof body.completionStatus === "string" &&
        COMPLETION.includes(body.completionStatus as CompletionStatus)
          ? (body.completionStatus as CompletionStatus)
          : "incomplete",
      successStatus:
        typeof body.successStatus === "string" &&
        SUCCESS.includes(body.successStatus as SuccessStatus)
          ? (body.successStatus as SuccessStatus)
          : "unknown",
      totalTimeSeconds: 0,
      exit:
        typeof body.exitMode === "string" && EXIT.includes(body.exitMode as ExitMode)
          ? (body.exitMode as ExitMode)
          : "",
      ...(numero(body.scoreScaled) !== null ? { scoreScaled: numero(body.scoreScaled)! } : {}),
      ...(numero(body.scoreRaw) !== null ? { scoreRaw: numero(body.scoreRaw)! } : {}),
      ...(numero(body.scoreMin) !== null ? { scoreMin: numero(body.scoreMin)! } : {}),
      ...(numero(body.scoreMax) !== null ? { scoreMax: numero(body.scoreMax)! } : {}),
      ...(typeof body.suspendData === "string" ? { suspendData: body.suspendData } : {}),
      ...(typeof body.location === "string" ? { location: body.location } : {}),
      ...(pacote.scaledPassingScore !== undefined
        ? { scaledPassingScore: pacote.scaledPassingScore }
        : {}),
    };

    await save2004Tracking(pacote.id, enrollmentId, state, sessaoSegundos);

    /* A CONCLUSÃO SEGUE `completion_status`, NÃO `success_status`. Quem
       reprovou na prova viu a aula inteira, e o progresso do curso tem de
       reconhecer isso — é a distinção que o 2004 existe para expressar. */
    if (isCompleted2004(state)) {
      await setManualCompletion(enrollmentId, lessonId, true, user.id);
    }

    return Response.json({
      ok: true,
      completed: isCompleted2004(state),
      passed: isPassed2004(state),
    });
  }

  const status =
    typeof body.lessonStatus === "string" && STATUS.includes(body.lessonStatus as LessonStatus)
      ? (body.lessonStatus as LessonStatus)
      : "incomplete";

  const state = {
    lessonStatus: status,
    totalTimeSeconds: 0,
    ...(numero(body.scoreRaw) !== null ? { scoreRaw: numero(body.scoreRaw)! } : {}),
    ...(numero(body.scoreMin) !== null ? { scoreMin: numero(body.scoreMin)! } : {}),
    ...(numero(body.scoreMax) !== null ? { scoreMax: numero(body.scoreMax)! } : {}),
    ...(typeof body.suspendData === "string" ? { suspendData: body.suspendData } : {}),
    ...(typeof body.lessonLocation === "string" ? { lessonLocation: body.lessonLocation } : {}),
  };

  await saveTracking(pacote.id, enrollmentId, state, sessaoSegundos);

  /* O SCORM conclui a AULA quando o próprio conteúdo diz que concluiu. É a
     razão de a aula existir: quem manda no progresso é o pacote. */
  if (isCompleted(state)) {
    await setManualCompletion(enrollmentId, lessonId, true, user.id);
  }

  return Response.json({
    ok: true,
    completed: isCompleted(state),
    passed: isPassed(state, pacote.masteryScore),
  });
}
