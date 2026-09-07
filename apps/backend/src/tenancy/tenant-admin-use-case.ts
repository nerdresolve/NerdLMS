import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import { featureDefinition } from "@nerdlms/core/tenancy/features.ts";

import { setTenantFeature } from "./features-repository.ts";
import { updateTenantBranding } from "./tenants-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Configuração do próprio cliente.
 *
 * Quem administra um tenant configura o SEU tenant e nenhum outro: o alvo vem
 * sempre do ator, nunca do corpo da requisição. Aceitar um `tenantId` de fora
 * deixaria um admin reconfigurar a plataforma de outra empresa — o oposto do
 * que o isolamento existe para garantir.
 */

export type TenantAdminOutcome = { status: 200 } | { status: 400 | 403; error: string };

function autorizado(actor: Actor): boolean {
  /* Só admin configura o tenant. `can()` com `kind: "user"` é o recurso mais
     próximo de "administração da plataforma" no modelo atual; quando papéis
     personalizados chegarem (guia §1), isto vira uma permissão própria. */
  return actor.role === "admin" && can(actor, "update", { kind: "user" });
}

export interface FeatureCommand {
  actor: Actor;
  actorName: string;
  feature: string;
  /** `null` volta ao padrão do catálogo em vez de fixar o valor atual. */
  enabled: boolean | null;
}

export async function setFeatureUseCase(command: FeatureCommand): Promise<TenantAdminOutcome> {
  if (!autorizado(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para configurar a plataforma." };
  }

  /* Chave fora do catálogo é recusada, não gravada: uma linha órfã em
     `tenant_features` nunca seria lida e viraria lixo silencioso. */
  if (!featureDefinition(command.feature)) {
    return { status: 400, error: "Funcionalidade desconhecida." };
  }

  await setTenantFeature(command.actor.tenantId, command.feature, command.enabled);

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "config_changed",
    target: `funcionalidade ${command.feature} → ${command.enabled ?? "padrão"}`,
    outcome: "allowed",
  });

  return { status: 200 };
}

export interface BrandingCommand {
  actor: Actor;
  actorName: string;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  faviconUrl?: string | null;
  brandColor?: string | null;
  mailFromName?: string | null;
  mailFromEmail?: string | null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function setBrandingUseCase(command: BrandingCommand): Promise<TenantAdminOutcome> {
  if (!autorizado(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para configurar a plataforma." };
  }

  /* A cor é validada aqui além do CHECK do banco: a mensagem de erro precisa
     dizer o que está errado, e uma violação de constraint chega como exceção
     ilegível. */
  if (command.brandColor && !HEX.test(command.brandColor)) {
    return { status: 400, error: "A cor precisa estar no formato #RRGGBB." };
  }

  await updateTenantBranding(command.actor.tenantId, {
    ...(command.logoLightUrl !== undefined ? { logoLightUrl: command.logoLightUrl } : {}),
    ...(command.logoDarkUrl !== undefined ? { logoDarkUrl: command.logoDarkUrl } : {}),
    ...(command.faviconUrl !== undefined ? { faviconUrl: command.faviconUrl } : {}),
    ...(command.brandColor !== undefined ? { brandColor: command.brandColor } : {}),
    ...(command.mailFromName !== undefined ? { mailFromName: command.mailFromName } : {}),
    ...(command.mailFromEmail !== undefined ? { mailFromEmail: command.mailFromEmail } : {}),
  });

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "config_changed",
    target: "identidade visual",
    outcome: "allowed",
  });

  return { status: 200 };
}
