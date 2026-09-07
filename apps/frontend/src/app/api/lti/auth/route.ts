import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import { consumeNonce, findLink } from "@nerdlms/backend/lti/lti-repository.ts";
import { signJwt } from "@nerdlms/backend/lti/lti-keys.ts";
import { AGS_SCOPES, resourceLinkClaims } from "@nerdlms/core/lti/claims.ts";
import { isRegisteredRedirect, validateAuthRequest } from "@nerdlms/core/lti/oidc-launch.ts";

import { baseUrlOf } from "@/lib/base-url.ts";
import { currentUser } from "@/lib/auth/session.ts";
import { escapeHtmlAttribute, autoPostForm } from "@/lib/html-form.ts";

/**
 * GET|POST /api/lti/auth — etapas 2 e 3 do launch LTI 1.3.
 *
 * A ferramenta chega aqui depois que a mandamos ao `oidc_login_uri` dela. Ela
 * traz o `state` e o `nonce` DELA, e nós devolvemos o `id_token` assinado
 * carregando os dois. É assim que ela confirma que o launch é legítimo — e é
 * exatamente o passo que faltava para uma ferramenta certificada aceitar.
 *
 * GET e POST porque o padrão permite os dois. Quem manda por GET não põe nada
 * sensível na URL: o `nonce` da ferramenta não é segredo, é um identificador
 * de correlação.
 *
 * EXIGE SESSÃO. É a mesma pessoa que clicou no launch, ainda no navegador
 * dela: o `login_hint` diz quem deveria ser, e a sessão diz quem é. Se os dois
 * discordam, alguém está tentando abrir a ferramenta como outra pessoa.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return responder(new URL(request.url).searchParams);
}

export async function POST(request: Request): Promise<Response> {
  const corpo = await request.text();
  return responder(new URLSearchParams(corpo));
}

async function responder(params: URLSearchParams): Promise<Response> {
  const user = await currentUser();
  if (!user) return erro("Sessão exigida.", 401);

  const validado = validateAuthRequest(params);
  if (!validado.ok) return erro(validado.error, 400);

  const pedido = validado.request;

  /* O `lti_message_hint` é o nosso `state` da etapa 1: é por ele que
     reencontramos o launch que iniciamos. Sem ele, qualquer um chamaria esta
     rota e receberia um token assinado. */
  if (!pedido.ltiMessageHint) return erro("Pedido sem lti_message_hint.", 400);

  const guardado = await consumeNonce(user.tenant.id, pedido.ltiMessageHint);
  if (!guardado || !guardado.linkId) {
    return erro("Este launch expirou ou já foi usado.", 400);
  }

  /* O `login_hint` que ela devolve tem de ser a pessoa da sessão. Divergir
     significa que o launch foi iniciado por uma pessoa e está sendo concluído
     por outra — num navegador compartilhado, ou de propósito. */
  if (guardado.userId !== user.id || pedido.loginHint !== user.id) {
    return erro("Este launch pertence a outra pessoa.", 403);
  }

  const link = await findLink(user.tenant.id, guardado.linkId);
  if (!link || !link.toolActive) return erro("Ferramenta não encontrada.", 404);

  if (link.clientId !== pedido.clientId) {
    return erro("O pedido não corresponde a esta ferramenta.", 400);
  }

  /* A checagem mais importante da rota: o token só vai para um endereço que a
     ferramenta cadastrou. Sem ela, quem forjasse um pedido receberia um token
     assinado por nós no endereço que escolhesse. */
  if (!isRegisteredRedirect(pedido.redirectUri, link.redirectUris)) {
    return erro("Este endereço de retorno não está cadastrado para a ferramenta.", 400);
  }

  /* A matrícula é conferida DE NOVO. Foi conferida na etapa 1, mas entre uma
     etapa e outra a pessoa pode ter sido desmatriculada — e o launch é a
     credencial que a ferramenta vai acreditar. */
  const matricula = await findEnrollmentId(link.courseId, user.id);
  const podePorPapel = user.role === "admin" || user.role === "instructor";
  if (!matricula && !podePorPapel) {
    return erro("Você não está matriculado neste curso.", 403);
  }

  const baseUrl = await baseUrlOf();

  const claims = resourceLinkClaims({
    issuer: baseUrl,
    clientId: link.clientId,
    userId: user.id,
    userName: user.fullName,
    userEmail: user.email ?? null,
    role: user.role,
    contextId: link.courseId,
    contextTitle: link.courseTitle,
    linkId: link.id,
    linkTitle: link.title,
    targetLinkUri: link.targetLinkUri,
    deploymentId: link.toolId,
    /* O `nonce` da FERRAMENTA, não o nosso. Trocar os dois é o erro clássico
       aqui: o token passaria pela nossa validação e seria recusado pela dela,
       com uma mensagem que aponta para o lado errado. */
    nonce: pedido.nonce,
    ...(link.graded && link.allowGrades
      ? { ags: { lineitemUrl: `${baseUrl}/api/lti/ags/${link.id}`, scopes: [...AGS_SCOPES] } }
      : {}),
    ...(link.allowRoster
      ? { nrps: { contextMembershipsUrl: `${baseUrl}/api/lti/nrps/${link.courseId}` } }
      : {}),
  });

  const idToken = await signJwt(user.tenant.id, claims);

  return autoPostForm({
    action: pedido.redirectUri,
    titulo: `Abrindo ${link.toolName}…`,
    campos: {
      id_token: idToken,
      /* O `state` dela volta como veio. Vazio quando ela não mandou — o padrão
         permite, e inventar um faria a ferramenta recusar por não reconhecer. */
      ...(pedido.state ? { state: pedido.state } : {}),
    },
  });
}

function erro(mensagem: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
      `<title>Não foi possível abrir</title></head><body>` +
      `<h1>Não foi possível abrir a ferramenta</h1>` +
      `<p>${escapeHtmlAttribute(mensagem)}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
