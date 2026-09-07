import { headers } from "next/headers";
import { X509Certificate } from "node:crypto";

import { can } from "@nerdlms/core/auth/permissions.ts";
import { upsertSamlProvider } from "@nerdlms/backend/saml/saml-repository.ts";
import { recordAudit } from "@nerdlms/backend/audit/audit-repository.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/sso/saml — salva a configuração do provedor SAML.
 *
 * O certificado é CONFERIDO antes de gravar. Um PEM colado errado só
 * apareceria na hora do login de alguém, com "a assinatura não confere" — que
 * culpa o provedor por um erro de copiar e colar.
 */

export const dynamic = "force-dynamic";

const PAPEIS = ["admin", "manager", "instructor", "learner"];

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Aceita o PEM completo ou só o base64 do meio, como o SAML transporta. */
function normalizarPem(valor: string): string {
  const limpo = valor.trim();
  if (limpo.includes("BEGIN CERTIFICATE")) return limpo;

  const base64 = limpo.replace(/\s+/g, "");
  const linhas = base64.match(/.{1,64}/g) ?? [];

  return `-----BEGIN CERTIFICATE-----\n${linhas.join("\n")}\n-----END CERTIFICATE-----`;
}

export async function POST(request: Request): Promise<Response> {
  const admin = await currentUser();
  if (!admin) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  if (!can(actorOf(admin), "read", { kind: "analytics", scope: "platform" })) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const idpEntityId = texto(body.idpEntityId);
  const ssoUrl = texto(body.ssoUrl);
  const spEntityId = texto(body.spEntityId);

  if (!idpEntityId) return Response.json({ error: "Informe o Entity ID do provedor." }, { status: 400 });
  if (!ssoUrl) return Response.json({ error: "Informe a URL de SSO." }, { status: 400 });
  if (!spEntityId) return Response.json({ error: "Informe o Entity ID desta plataforma." }, { status: 400 });

  /* Um por linha em branco: é como os metadados apresentam, e como quem cola
     dois certificados durante a rotação naturalmente os separa. */
  const brutos = texto(body.certificates)
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  const certificados: string[] = [];

  for (const [i, bruto] of brutos.entries()) {
    const pem = normalizarPem(bruto);

    try {
      const cert = new X509Certificate(pem);

      /* Vencido é AVISO, não recusa: pode ser o antigo, cadastrado ao lado do
         novo durante a rotação. Recusar impediria justamente a operação que a
         lista de certificados existe para permitir. */
      if (new Date(cert.validTo) < new Date()) {
        console.warn("[saml] certificado vencido cadastrado", cert.validTo);
      }

      certificados.push(pem);
    } catch {
      return Response.json(
        { error: `O certificado ${i + 1} não pôde ser lido. Cole o bloco inteiro, incluindo as linhas BEGIN e END.` },
        { status: 400 },
      );
    }
  }

  const enabled = body.enabled === true;

  if (enabled && certificados.length === 0) {
    return Response.json(
      { error: "Informe ao menos um certificado antes de ligar o provedor." },
      { status: 400 },
    );
  }

  const jitRole = texto(body.jitRole) || "learner";
  if (!PAPEIS.includes(jitRole)) {
    return Response.json({ error: "Papel inválido." }, { status: 400 });
  }

  const salvo = await upsertSamlProvider({
    tenantId: admin.tenant.id,
    displayName: texto(body.displayName) || "Acesso corporativo",
    idpEntityId,
    ssoUrl,
    certificates: certificados,
    spEntityId,
    allowedDomains: texto(body.allowedDomains),
    allowJit: body.allowJit === true,
    jitRole,
    enabled,
  });

  const requestHeaders = await headers();
  await recordAudit({
    actorId: admin.id,
    actorName: admin.fullName,
    action: "config_changed",
    target: `SAML${enabled ? " (ligado)" : " (desligado)"}`,
    outcome: "allowed",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1",
  });

  return Response.json({
    saml: {
      id: salvo.id,
      displayName: salvo.displayName,
      idpEntityId: salvo.idpEntityId,
      ssoUrl: salvo.ssoUrl,
      certificates: salvo.certificates,
      spEntityId: salvo.spEntityId,
      allowedDomains: salvo.allowedDomains.join(", "),
      allowJit: salvo.allowJit,
      jitRole: salvo.jitRole,
      enabled: salvo.enabled,
    },
  });
}
