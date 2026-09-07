import { headers } from "next/headers";

import { providerPreset } from "@nerdlms/core/sso/providers.ts";
import { upsertProvider } from "@nerdlms/backend/sso/sso-repository.ts";
import { clearJwksCache } from "@nerdlms/backend/sso/oidc-client.ts";
import { recordAudit } from "@nerdlms/backend/audit/audit-repository.ts";

import { can } from "@nerdlms/core/auth/permissions.ts";

import { readJsonObject } from "@/lib/request-body.ts";
import { actorOf, currentUser } from "@/lib/auth/session.ts";

/**
 * POST /api/sso/provedores
 *
 * Salva a configuração de um provedor. Só administrador — quem controla isto
 * controla quem entra na plataforma.
 */

export const dynamic = "force-dynamic";

const PAPEIS = ["admin", "manager", "instructor", "learner"];

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Vazio vira `null`: a coluna aceita nulo, e string vazia não é endereço. */
function urlOuNulo(valor: unknown): string | null {
  return texto(valor) || null;
}

export async function POST(request: Request): Promise<Response> {
  const admin = await currentUser();
  if (!admin) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  /* A mesma permissão que abre a administração da plataforma: quem configura
     o provedor decide quem entra, e isso não é menos sensível que ver os
     números. */
  if (!can(actorOf(admin), "read", { kind: "analytics", scope: "platform" })) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const provider = texto(body.provider);
  const preset = providerPreset(provider);
  if (!preset) {
    return Response.json({ error: "Provedor desconhecido." }, { status: 400 });
  }

  const clientId = texto(body.clientId);
  if (!clientId) {
    return Response.json({ error: "Informe o ID do cliente." }, { status: 400 });
  }

  const providerTenantId = texto(body.providerTenantId) || null;
  if (preset.requiresTenantId && !providerTenantId) {
    /* Sem o diretório, a URL da Microsoft sai com `{tenant}` literal e o login
       falha no provedor, com uma mensagem que não aponta para cá. */
    return Response.json({ error: "Informe o ID do diretório." }, { status: 400 });
  }

  const jitRole = texto(body.jitRole) || "learner";
  if (!PAPEIS.includes(jitRole)) {
    return Response.json({ error: "Papel inválido." }, { status: 400 });
  }

  const enabled = body.enabled === true;
  const clientSecret = texto(body.clientSecret);

  const salvo = await upsertProvider({
    tenantId: admin.tenant.id,
    provider,
    displayName: texto(body.displayName) || preset.label,
    clientId,
    clientSecret,
    providerTenantId,
    /* Para Google e Microsoft os endereços vêm do catálogo; guardar uma cópia
       criaria uma segunda verdade que um dia discordaria dele. */
    authorizationUrl: preset.authorizationUrl ? null : urlOuNulo(body.authorizationUrl),
    tokenUrl: preset.tokenUrl ? null : urlOuNulo(body.tokenUrl),
    jwksUrl: preset.jwksUrl ? null : urlOuNulo(body.jwksUrl),
    issuer: preset.issuer ? null : urlOuNulo(body.issuer),
    allowedDomains: texto(body.allowedDomains),
    allowJit: body.allowJit === true,
    jitRole,
    enabled,
    allowPasswordLogin: body.allowPasswordLogin !== false,
  });

  if (!salvo.clientSecret) {
    /* Ligar sem chave secreta deixaria um botão que sempre falha na troca do
       código. Melhor recusar aqui do que na cara de quem for entrar. */
    if (enabled) {
      return Response.json(
        { error: "Informe a chave secreta antes de ligar o provedor." },
        { status: 400 },
      );
    }
  }

  /* A configuração mudou: o JWKS em cache pode ser de outro provedor. */
  clearJwksCache();

  const requestHeaders = await headers();
  await recordAudit({
    actorId: admin.id,
    actorName: admin.fullName,
    action: "config_changed",
    target: `SSO ${provider}${enabled ? " (ligado)" : " (desligado)"}`,
    outcome: "allowed",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1",
  });

  return Response.json({
    provider: {
      id: salvo.id,
      provider: salvo.provider,
      displayName: salvo.displayName,
      clientId: salvo.clientId,
      hasSecret: salvo.clientSecret.length > 0,
      providerTenantId: salvo.providerTenantId,
      authorizationUrl: salvo.authorizationUrl,
      tokenUrl: salvo.tokenUrl,
      jwksUrl: salvo.jwksUrl,
      issuer: salvo.issuer,
      allowedDomains: salvo.allowedDomains.join(", "),
      allowJit: salvo.allowJit,
      jitRole: salvo.jitRole,
      enabled: salvo.enabled,
      allowPasswordLogin: salvo.allowPasswordLogin,
    },
  });
}
