import { parseScopes } from "@nerdlms/core/api/keys.ts";
import { createApiKey, revokeApiKey } from "@nerdlms/backend/api/api-key-repository.ts";
import { createWebhook, deleteWebhook } from "@nerdlms/backend/api/webhook-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * POST   /api/integracoes — cria chave de API ou webhook.
 * DELETE /api/integracoes — revoga chave ou remove webhook.
 *
 * Só admin: uma chave de API dá acesso programático ao cliente inteiro, e um
 * webhook manda dado para fora. Nenhum dos dois é decisão de instrutor.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Sem permissão." }, { status: 403 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  /* Webhook: identificado pela URL. */
  if (typeof body.url === "string") {
    if (!body.url.startsWith("https://")) {
      /* Só HTTPS: o corpo carrega dado de aluno, e em HTTP ele viaja aberto.
         O CHECK do banco também recusa — aqui é a mensagem. */
      return Response.json({ error: "A URL precisa começar com https://" }, { status: 400 });
    }

    const eventos = Array.isArray(body.events)
      ? body.events.filter((e: unknown): e is string => typeof e === "string")
      : [];

    const criado = await createWebhook(user.tenant.id, body.url, eventos);
    return Response.json(criado, { status: 201 });
  }

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return Response.json({ error: "Dê um nome à chave." }, { status: 400 });
  }

  const scopes = parseScopes(Array.isArray(body.scopes) ? body.scopes : []);

  if (scopes.length === 0) {
    /* Uma chave sem escopo não faz nada. Recusar é mais honesto que criar algo
       inútil e deixar a pessoa descobrir na primeira requisição. */
    return Response.json({ error: "Escolha ao menos um escopo." }, { status: 400 });
  }

  const chave = await createApiKey({
    tenantId: user.tenant.id,
    name: body.name,
    scopes,
    createdBy: user.id,
  });

  /* A chave em texto sai AQUI e nunca mais: o banco só tem o hash. */
  return Response.json(chave, { status: 201 });
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Sem permissão." }, { status: 403 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  if (isUuid(body.webhookId)) {
    await deleteWebhook(String(body.webhookId), user.tenant.id);
    return Response.json({ ok: true });
  }

  if (!isUuid(body.keyId)) {
    return Response.json({ error: "Nada a remover." }, { status: 400 });
  }

  const ok = await revokeApiKey(String(body.keyId), user.tenant.id);
  return ok
    ? Response.json({ ok: true })
    : Response.json({ error: "Chave não encontrada." }, { status: 404 });
}
