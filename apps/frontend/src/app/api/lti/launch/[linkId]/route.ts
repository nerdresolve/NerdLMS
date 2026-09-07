import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { createNonce, findLink, pruneNonces } from "@nerdlms/backend/lti/lti-repository.ts";
import { initiationPayload } from "@nerdlms/core/lti/oidc-launch.ts";

import { baseUrlOf } from "@/lib/base-url.ts";
import { currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";
import { autoPostForm } from "@/lib/html-form.ts";

/**
 * GET /api/lti/launch/{linkId} — etapa 1 do launch LTI 1.3 (F6-04).
 *
 * O padrão define o launch em três etapas, e esta é a primeira:
 *
 *   1. AQUI — mandamos a pessoa ao `oidc_login_uri` da ferramenta, com `iss`,
 *      `login_hint` e `lti_message_hint`. Nada sensível: é só "alguém quer
 *      abrir isto, venha buscar".
 *   2. A ferramenta chama `/api/lti/auth` com o `state` e o `nonce` DELA.
 *   3. Devolvemos o `id_token` assinado carregando os dois.
 *
 * A indireção existe para a ferramenta CONFIRMAR que o launch partiu de quem
 * diz ter partido. Entregar o token direto no primeiro POST funciona com
 * muitas ferramentas, mas uma certificada pela 1EdTech recusa — e era essa a
 * lacuna registrada do F6-04.
 *
 * Exige SESSÃO: quem faz launch é uma pessoa no navegador, dentro de um curso.
 * É o oposto do xAPI, onde quem chama é um sistema.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ linkId: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const { linkId } = await params;
  if (!isUuid(linkId)) return Response.json({ error: "Link inválido." }, { status: 400 });

  const link = await findLink(user.tenant.id, linkId);
  if (!link) return Response.json({ error: "Ferramenta não encontrada." }, { status: 404 });

  if (!link.toolActive) {
    return Response.json({ error: "Esta ferramenta está desativada." }, { status: 400 });
  }

  /* Precisa estar matriculado no curso onde a ferramenta está.

     Sem esta checagem, qualquer pessoa com sessão abriria a ferramenta de
     qualquer curso — e a ferramenta acreditaria, porque o token viria assinado
     por nós. O launch É a credencial. */
  const matricula = await findEnrollmentId(link.courseId, user.id);
  const podePorPapel = user.role === "admin" || user.role === "instructor";

  if (!matricula && !podePorPapel) {
    return Response.json({ error: "Você não está matriculado neste curso." }, { status: 403 });
  }

  const { state } = await createNonce({
    tenantId: user.tenant.id,
    linkId,
    userId: user.id,
  });

  /* Oportunista: limpa nonces vencidos sem precisar de cron. O custo é uma
     instrução por launch, e o launch já é uma operação de várias. */
  void pruneNonces().catch(() => {});

  const baseUrl = await baseUrlOf();

  /* O `state` que criamos vai como `lti_message_hint` e volta na etapa 2: é
     por ele que reencontramos ESTE launch. As claims não são montadas aqui —
     na etapa 3 o contexto é buscado de novo, porque entre uma etapa e outra a
     matrícula pode ter mudado, e o token é a credencial que a ferramenta vai
     acreditar. */
  return autoPostForm({
    action: link.oidcLoginUri,
    titulo: `Abrindo ${link.toolName}…`,
    campos: initiationPayload({
      iss: baseUrl,
      loginHint: user.id,
      targetLinkUri: link.targetLinkUri,
      ltiMessageHint: state,
      clientId: link.clientId,
      deploymentId: link.toolId,
    }),
  });
}
