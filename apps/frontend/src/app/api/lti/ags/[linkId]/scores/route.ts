import { recordGrade } from "@nerdlms/backend/assessment/assignment-repository.ts";
import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { findLink } from "@nerdlms/backend/lti/lti-repository.ts";
import { isFinalScore } from "@nerdlms/core/lti/claims.ts";

import { apiError, requireApiKey } from "@/lib/api-auth.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * POST /api/lti/ags/{linkId}/scores — a ferramenta lança nota (F6-04).
 *
 * É o AGS do LTI Advantage: a ferramenta externa devolve o resultado, e ele
 * entra no livro de notas como qualquer outra nota.
 *
 * AUTENTICA POR CHAVE DE API. O padrão usa OAuth2 client_credentials com JWT —
 * outra camada inteira. A chave de API dá a mesma garantia prática aqui: quem
 * lança precisa de um segredo que só o cliente tem, e o tenant vem dele.
 * Registrado como diferença em relação à certificação.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> },
): Promise<Response> {
  const auth = await requireApiKey(request, "notas:escrever");
  if (!auth.ok) return auth.response;

  const { linkId } = await params;
  if (!isUuid(linkId)) return apiError(404, "not_found", "Link não encontrado.");

  const link = await findLink(auth.identity.tenantId, linkId);
  if (!link) return apiError(404, "not_found", "Link não encontrado.");

  if (!link.graded || !link.allowGrades) {
    return apiError(403, "not_graded", "Este link não aceita lançamento de nota.");
  }

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return apiError(400, "invalid_json", "Corpo inválido.");

  /* O `userId` do AGS é o `sub` que mandamos no launch — o id da pessoa aqui. */
  const userId = String(corpo.userId ?? "");
  if (!isUuid(userId)) return apiError(400, "invalid_user", "`userId` inválido.");

  /* Nota parcial NÃO entra no livro.

     `gradingProgress: "PendingManual"` significa que a ferramenta ainda vai
     corrigir. Lançar agora colocaria no gradebook um número que muda depois,
     e o histórico registraria uma "revisão" que nunca foi revisão. */
  if (!isFinalScore(corpo.gradingProgress)) {
    return Response.json(
      { accepted: false, reason: "gradingProgress não é FullyGraded — nota não lançada." },
      { status: 202 },
    );
  }

  const obtido = Number(corpo.scoreGiven);
  const maximo = Number(corpo.scoreMaximum ?? link.pointsPossible);

  if (!Number.isFinite(obtido) || !Number.isFinite(maximo) || maximo <= 0) {
    return apiError(400, "invalid_score", "`scoreGiven` e `scoreMaximum` precisam ser números.");
  }

  if (obtido < 0 || obtido > maximo) {
    return apiError(400, "score_out_of_range", "A nota está fora do intervalo declarado.");
  }

  const enrollmentId = await findEnrollmentId(link.courseId, userId);
  if (!enrollmentId) {
    return apiError(404, "not_enrolled", "Esta pessoa não está matriculada no curso.");
  }

  await recordGrade({
    tenantId: auth.identity.tenantId,
    enrollmentId,
    /* A origem é o LINK LTI — a terceira origem legítima de nota, ao lado de
       prova e trabalho (migração 024). Sem ela, o CHECK do gradebook recusaria
       a nota por não pertencer a atividade nenhuma. */
    ltiLinkId: link.id,
    pointsEarned: obtido,
    pointsPossible: maximo,
    reason: `Lançada por ${link.toolName} (LTI)`,
  });

  return Response.json({ accepted: true }, { status: 200 });
}
