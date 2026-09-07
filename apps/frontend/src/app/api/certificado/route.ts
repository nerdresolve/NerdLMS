import { certificateUseCase } from "@nerdlms/backend/reports/certificate-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { featureGate } from "@/lib/feature-guard.ts";

/**
 * GET /api/certificado?curso=<id>
 *
 * Devolve o PDF do certificado. `GET` porque é um documento que se baixa — o
 * navegador precisa poder abrir a URL direto, e um `POST` exigiria JavaScript
 * para algo que é um link.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const bloqueio = await featureGate("certificados");
  if (bloqueio) return bloqueio;

  const courseId = new URL(request.url).searchParams.get("curso");
  if (!courseId) return Response.json({ error: "Curso não informado." }, { status: 400 });

  const outcome = await certificateUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    courseId,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return new Response(outcome.pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      /* `attachment` para baixar em vez de abrir na aba: o nome do arquivo
         importa quando alguém guarda o certificado. */
      "content-disposition": `attachment; filename="${outcome.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
