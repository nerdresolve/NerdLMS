import { courseMembers, findLinksOfCourse } from "@nerdlms/backend/lti/lti-repository.ts";
import { ltiRolesOf } from "@nerdlms/core/lti/claims.ts";

import { apiError, requireApiKey } from "@/lib/api-auth.ts";
import { baseUrlOf } from "@/lib/base-url.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * GET /api/lti/nrps/{courseId} — a lista da turma (F6-04).
 *
 * É o NRPS do LTI Advantage. A ferramenta pergunta "quem está neste curso" —
 * um laboratório que forma duplas, um simulador que precisa da lista para
 * ranquear.
 *
 * SÓ RESPONDE SE ALGUMA FERRAMENTA DESTE CURSO TIVER PERMISSÃO.
 *
 * Sem essa conferência, qualquer chave com escopo de usuário leria a turma de
 * qualquer curso — e a lista traz nome e e-mail de todo mundo. O NRPS é um
 * serviço do LTI, não uma API de diretório.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  const auth = await requireApiKey(request, "usuarios:ler");
  if (!auth.ok) return auth.response;

  const { courseId } = await params;
  if (!isUuid(courseId)) return apiError(404, "not_found", "Curso não encontrado.");

  const links = await findLinksOfCourse(auth.identity.tenantId, courseId);

  if (!links.some((link) => link.allowRoster && link.toolActive)) {
    return apiError(
      403,
      "nrps_not_allowed",
      "Nenhuma ferramenta ativa deste curso tem permissão para ler a turma.",
    );
  }

  const membros = await courseMembers(auth.identity.tenantId, courseId);
  const baseUrl = await baseUrlOf();

  /* O formato é o que o padrão define: `id` do contexto, `members` com
     `user_id`, `roles` e os dados de perfil. */
  return Response.json(
    {
      id: `${baseUrl}/api/lti/nrps/${courseId}`,
      context: { id: courseId },
      members: membros.map((membro) => ({
        status: "Active",
        user_id: membro.id,
        name: membro.name,
        ...(membro.email ? { email: membro.email } : {}),
        roles: ltiRolesOf(membro.role as "learner" | "instructor" | "manager" | "admin"),
      })),
    },
    {
      headers: {
        "content-type": "application/vnd.ims.lti-nrps.v2.membershipcontainer+json",
        "cache-control": "no-store",
      },
    },
  );
}
