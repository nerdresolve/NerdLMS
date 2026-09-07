import { actorParaCmi5, buildLaunchUrl } from "@nerdlms/core/cmi5/launch.ts";
import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { findLessonCourse } from "@nerdlms/backend/courses/material-repository.ts";
import { findUnitByLesson, openSession } from "@nerdlms/backend/cmi5/cmi5-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";
import { publicOrigin } from "@/lib/sso-redirect.ts";
import { headers } from "next/headers";

/**
 * GET /api/cmi5/launch/{lessonId} — abre uma unidade cmi5.
 *
 * A plataforma emite o `launched` ao abrir a sessão, e é a existência dele que
 * autoriza o `initialized` que o conteúdo mandará depois. Sem essa ordem, um
 * conteúdo poderia relatar conclusão de uma sessão que nunca abrimos.
 *
 * Redireciona para o conteúdo em vez de embutir num iframe aqui: quem monta a
 * tela é a página da aula, e esta rota existe para PRODUZIR a URL com os
 * parâmetros — que dependem de uma sessão recém-criada e não podem ser
 * calculados na renderização em cache.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const { lessonId } = await params;
  if (!isUuid(lessonId)) return Response.json({ error: "Aula inválida." }, { status: 400 });

  const unidade = await findUnitByLesson(user.tenant.id, lessonId);
  if (!unidade) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  /* A matrícula é a autorização, como no LTI: sem ela, qualquer pessoa com
     sessão abriria o conteúdo de qualquer curso — e o conteúdo acreditaria,
     porque o token viria de nós. */
  const courseId = await findLessonCourse(lessonId);
  const enrollmentId = courseId ? await findEnrollmentId(courseId, user.id) : null;
  const podePorPapel = user.role === "admin" || user.role === "instructor";

  if (!enrollmentId && !podePorPapel) {
    return Response.json({ error: "Você não está matriculado neste curso." }, { status: 403 });
  }

  const sessao = await openSession({
    tenantId: user.tenant.id,
    unitId: unidade.id,
    userId: user.id,
    enrollmentId,
  });

  const origem = publicOrigin(await headers());

  const url = buildLaunchUrl(unidade.launchUrl, {
    endpoint: `${origem}/api/xapi/`,
    /* O identificador da sessão, não o token: o conteúdo troca um pelo outro
       em `/api/cmi5/fetch`, e é o que mantém a credencial fora da URL. */
    fetchUrl: `${origem}/api/cmi5/fetch?t=${sessao.id}`,
    actorJson: actorParaCmi5({
      userId: user.id,
      fullName: user.fullName,
      homePage: origem,
    }),
    activityId: `${origem}/cmi5/unidade/${unidade.id}`,
    /* `registration` é a sessão. É o que liga cada statement a ESTA tentativa
       — sem ele, um `completed` solto no LRS não diz de qual delas é. */
    registration: sessao.id,
  });

  return Response.redirect(url, 303);
}
