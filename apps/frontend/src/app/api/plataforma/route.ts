import {
  setBrandingUseCase,
  setFeatureUseCase,
} from "@nerdlms/backend/tenancy/tenant-admin-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { readJsonObject } from "@/lib/request-body.ts";

/**
 * PATCH /api/plataforma — configuração do próprio cliente.
 *
 * Duas ações no mesmo lugar porque operam sobre o mesmo recurso: o tenant da
 * sessão. O corpo decide qual — `feature` para ligar/desligar funcionalidade,
 * qualquer campo de marca para a identidade visual.
 *
 * O tenant NUNCA vem do corpo: sai do ator. Aceitá-lo de fora deixaria um
 * admin reconfigurar a plataforma de outra empresa.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const actor = actorOf(user);

  if (typeof body.feature === "string") {
    const outcome = await setFeatureUseCase({
      actor,
      actorName: user.fullName,
      feature: body.feature,
      /* `null` explícito volta ao padrão do catálogo; booleano fixa a escolha. */
      enabled: typeof body.enabled === "boolean" ? body.enabled : null,
    });

    if (outcome.status !== 200) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  /* Campo ausente é diferente de campo vazio: ausente não muda nada, vazio
     limpa e volta ao padrão. Sem essa distinção, salvar só a cor apagaria a
     logo — `exactOptionalPropertyTypes` obriga a ser explícito sobre isso. */
  const marca: Record<string, string | null> = {};
  for (const chave of [
    "logoLightUrl",
    "logoDarkUrl",
    "faviconUrl",
    "brandColor",
    "mailFromName",
    "mailFromEmail",
  ]) {
    const valor = body[chave];
    if (valor === undefined) continue;
    marca[chave] = typeof valor === "string" && valor.trim() ? valor.trim() : null;
  }

  const outcome = await setBrandingUseCase({ actor, actorName: user.fullName, ...marca });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json({ ok: true });
}
