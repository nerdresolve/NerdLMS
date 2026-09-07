import { recordAudit } from "@nerdlms/backend/audit/audit-repository.ts";
import { fechar } from "@nerdlms/backend/crypto/secret-box.ts";
import { replaceGroupRoles, upsertDirectory } from "@nerdlms/backend/ldap/ldap-repository.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { directoryPreset } from "@nerdlms/core/ldap/directory.ts";
import type { GroupRole, Role } from "@nerdlms/core/ldap/mapping.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { readJsonObject } from "@/lib/request-body.ts";
import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * POST /api/ldap/diretorios
 *
 * Salva a configuração do diretório da empresa. Só administrador — quem
 * configura isto decide quem entra na plataforma e com que papel.
 *
 * É AQUI QUE A SENHA DA CONTA DE SERVIÇO É CIFRADA, e não no repositório: a
 * senha em claro não deve existir em mais lugares do que o necessário, e este é
 * o último ponto do caminho em que ela ainda precisa existir. Dali para baixo,
 * só o texto cifrado — e a restrição `ldap_senha_servico_cifrada` recusa no
 * banco qualquer coisa que não tenha passado por aqui.
 */

export const dynamic = "force-dynamic";

const PAPEIS: Role[] = ["admin", "manager", "instructor", "learner"];

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function textoOuNulo(valor: unknown): string | null {
  return texto(valor) || null;
}

/**
 * O mapa de grupos que chegou da tela.
 *
 * Recusa em silêncio o que não é aproveitável — linha sem nome de grupo, papel
 * que não existe — em vez de rejeitar a gravação inteira: a tela tem linhas em
 * branco por natureza, e devolver erro por causa de uma delas faria quem
 * configura caçar qual era.
 */
function lerMapeamentos(valor: unknown): GroupRole[] {
  if (!Array.isArray(valor)) return [];

  const mapeamentos: GroupRole[] = [];

  for (const item of valor.slice(0, 100)) {
    if (typeof item !== "object" || item === null) continue;

    const linha = item as Record<string, unknown>;
    const groupCn = texto(linha.groupCn).slice(0, 200);
    const role = texto(linha.role) as Role;

    if (!groupCn || !PAPEIS.includes(role)) continue;

    mapeamentos.push({ groupCn, role });
  }

  return mapeamentos;
}

export async function POST(request: Request): Promise<Response> {
  const admin = await currentUser();
  if (!admin) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  /* A mesma permissão que abre a administração da plataforma. */
  if (!can(actorOf(admin), "read", { kind: "analytics", scope: "platform" })) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  const tenant = await tenantOfRequest();
  if (!tenant) return Response.json({ error: "Cliente não identificado." }, { status: 404 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const kind = texto(body.kind);
  const preset = directoryPreset(kind);
  if (!preset) return Response.json({ error: "Tipo de diretório desconhecido." }, { status: 400 });

  const host = texto(body.host);
  if (!host) return Response.json({ error: "Informe o endereço do servidor." }, { status: 400 });

  const domain = textoOuNulo(body.domain);
  const baseDn = textoOuNulo(body.baseDn);
  const dnTemplate = textoOuNulo(body.dnTemplate);

  /* A mesma conferência que a restrição do banco faz, feita aqui para dar
     mensagem em vez de erro de SQL. Cada tipo exige o seu campo, e a
     configuração pela metade tem de ser recusada na ESCRITA — não no login de
     alguém, meses depois, com uma mensagem sobre o diretório. */
  if (preset.id === "ad" && !domain) {
    return Response.json({ error: "Informe o domínio do Active Directory." }, { status: 400 });
  }
  if (preset.id === "openldap" && !baseDn) {
    return Response.json({ error: "Informe a base do diretório." }, { status: 400 });
  }
  if (preset.id === "generico" && !dnTemplate?.includes("{user}")) {
    return Response.json(
      { error: "O molde do DN precisa conter {user}." },
      { status: 400 },
    );
  }

  const port = Number(body.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return Response.json({ error: "Porta inválida." }, { status: 400 });
  }

  const jitRole = texto(body.jitRole) || "learner";
  if (!PAPEIS.includes(jitRole as Role)) {
    return Response.json({ error: "Papel inválido." }, { status: 400 });
  }

  const serviceDn = textoOuNulo(body.serviceDn);
  const senhaEmClaro = typeof body.servicePassword === "string" ? body.servicePassword : "";

  let servicePassword: string | null = null;

  if (senhaEmClaro) {
    try {
      servicePassword = fechar(senhaEmClaro, "ldap-service");
    } catch (erro) {
      /* Sem `SESSION_SECRET` não há como guardar segredo cifrado. A falha
         acontece AQUI, na tela de quem configura, e não no login de alguém
         seis meses depois. */
      return Response.json(
        { error: erro instanceof Error ? erro.message : "Não foi possível guardar a senha." },
        { status: 500 },
      );
    }
  }

  if (serviceDn && !servicePassword && body.serviceDnMudou === true) {
    /* Trocar a conta e deixar a senha em branco guardaria a senha ANTIGA
       apontando para a conta NOVA — e o diretório recusaria o vínculo num
       ponto do código que só escreve no log do servidor. */
    return Response.json(
      { error: "Ao trocar a conta de serviço, informe também a senha dela." },
      { status: 400 },
    );
  }

  const mapeamentos = lerMapeamentos(body.groupRoles);
  const requireGroup = body.requireGroup === true;

  if (requireGroup && mapeamentos.length === 0) {
    /* Exigir grupo sem nenhum grupo mapeado tranca TODO MUNDO para fora, a
       começar por quem está configurando. */
    return Response.json(
      { error: "Para exigir grupo, mapeie ao menos um grupo do diretório a um papel." },
      { status: 400 },
    );
  }

  const salvo = await upsertDirectory({
    tenantId: tenant.id,
    kind: preset.id,
    displayName: texto(body.displayName) || preset.label,
    host,
    port,
    domain,
    baseDn,
    dnTemplate: preset.id === "generico" ? dnTemplate : null,
    allowSelfSigned: body.allowSelfSigned === true,
    allowedDomains: texto(body.allowedDomains),
    allowJit: body.allowJit === true,
    jitRole,
    enabled: body.enabled === true,
    allowPasswordLogin: body.allowPasswordLogin === true,
    serviceDn,
    servicePassword,
    searchBase: textoOuNulo(body.searchBase),
    syncProfile: body.syncProfile !== false,
    requireGroup,
  });

  await replaceGroupRoles(salvo.id, mapeamentos);

  await recordAudit({
    actorId: admin.id,
    actorName: admin.fullName,
    action: "config_changed",
    target:
      `ldap:${salvo.kind}, ${salvo.enabled ? "ligado" : "desligado"}, ` +
      `${mapeamentos.length} grupo(s) mapeado(s)` +
      (salvo.allowPasswordLogin ? "" : ", senha local desligada"),
    outcome: "allowed",
  });

  /* A senha cifrada NÃO volta para a tela. Ela não é necessária lá, e um campo
     que a devolvesse a poria no HTML de uma página de administração. */
  return Response.json({
    diretorio: {
      id: salvo.id,
      kind: salvo.kind,
      displayName: salvo.displayName,
      host: salvo.host,
      port: salvo.port,
      domain: salvo.domain,
      baseDn: salvo.baseDn,
      dnTemplate: salvo.dnTemplate,
      allowSelfSigned: salvo.allowSelfSigned,
      allowedDomains: salvo.allowedDomains.join(","),
      allowJit: salvo.allowJit,
      jitRole: salvo.jitRole,
      enabled: salvo.enabled,
      allowPasswordLogin: salvo.allowPasswordLogin,
      serviceDn: salvo.serviceDn,
      temSenhaDeServico: salvo.servicePasswordEncrypted !== null,
      searchBase: salvo.searchBase,
      syncProfile: salvo.syncProfile,
      requireGroup: salvo.requireGroup,
      groupRoles: mapeamentos,
    },
  });
}
