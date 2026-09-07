import { headers } from "next/headers";

import { can } from "@nerdlms/core/auth/permissions.ts";
import { directoryPreset } from "@nerdlms/core/ldap/directory.ts";
import { upsertDirectory } from "@nerdlms/backend/ldap/ldap-repository.ts";
import { recordAudit } from "@nerdlms/backend/audit/audit-repository.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/sso/diretorios — salva a configuração de um diretório LDAP.
 *
 * Só administrador: quem configura o diretório decide quem entra na
 * plataforma.
 */

export const dynamic = "force-dynamic";

const PAPEIS = ["admin", "manager", "instructor", "learner"];

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function POST(request: Request): Promise<Response> {
  const admin = await currentUser();
  if (!admin) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  if (!can(actorOf(admin), "read", { kind: "analytics", scope: "platform" })) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const kind = texto(body.kind);
  const preset = directoryPreset(kind);
  if (!preset) return Response.json({ error: "Tipo de diretório desconhecido." }, { status: 400 });

  const host = texto(body.host);
  if (!host) return Response.json({ error: "Informe o servidor." }, { status: 400 });

  const domain = texto(body.domain) || null;
  const baseDn = texto(body.baseDn) || null;
  const dnTemplate = texto(body.dnTemplate) || null;

  /* Cada tipo exige o seu campo. O banco também recusa — este CHECK existe em
     dois lugares de propósito: aqui a mensagem explica o que falta, e lá a
     regra vale mesmo para quem escrever direto no banco. */
  if (preset.requires === "domain" && !domain) {
    return Response.json({ error: "Informe o domínio do diretório." }, { status: 400 });
  }

  if (preset.requires === "base" && kind !== "generico" && !baseDn) {
    return Response.json({ error: "Informe a base do diretório." }, { status: 400 });
  }

  if (kind === "generico" && (!dnTemplate || !dnTemplate.includes("{user}"))) {
    return Response.json(
      { error: "O molde do DN precisa conter o marcador {user}." },
      { status: 400 },
    );
  }

  const jitRole = texto(body.jitRole) || "learner";
  if (!PAPEIS.includes(jitRole)) {
    return Response.json({ error: "Papel inválido." }, { status: 400 });
  }

  const porta = Number(body.port);
  const enabled = body.enabled === true;

  const salvo = await upsertDirectory({
    tenantId: admin.tenant.id,
    kind,
    displayName: texto(body.displayName) || preset.label,
    host,
    /* 636 quando não vier número válido: a porta em claro não é oferecida, e
       um valor torto não pode virar 389 por acidente. */
    port: Number.isInteger(porta) && porta > 0 && porta <= 65535 ? porta : preset.defaultPort,
    domain,
    baseDn,
    /* O molde só é guardado para o genérico: nos demais ele vem do catálogo, e
       uma cópia no banco criaria duas verdades. */
    dnTemplate: kind === "generico" ? dnTemplate : null,
    allowSelfSigned: body.allowSelfSigned === true,
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
    target: `LDAP ${kind}${enabled ? " (ligado)" : " (desligado)"}`,
    outcome: "allowed",
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1",
  });

  return Response.json({
    directory: {
      id: salvo.id,
      kind: salvo.kind,
      displayName: salvo.displayName,
      host: salvo.host,
      port: salvo.port,
      domain: salvo.domain,
      baseDn: salvo.baseDn,
      dnTemplate: salvo.dnTemplate,
      allowSelfSigned: salvo.allowSelfSigned,
      allowedDomains: salvo.allowedDomains.join(", "),
      allowJit: salvo.allowJit,
      jitRole: salvo.jitRole,
      enabled: salvo.enabled,
    },
  });
}
