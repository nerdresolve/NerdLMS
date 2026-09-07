"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Check, Palette, ToggleLeft } from "lucide-react";

import type { FeatureDefinition } from "@nerdlms/core/tenancy/features.ts";

import "./platform.css";

/**
 * Configuração da plataforma para este cliente.
 *
 * Duas coisas moram aqui porque respondem à mesma pergunta — "como esta
 * empresa quer o produto": o que está ligado, e com que cara.
 *
 * O tenant nunca aparece na tela nem no corpo das requisições: é sempre o da
 * sessão. Uma tela que deixasse escolher o tenant seria uma tela de
 * super-administrador, e essa não é (ainda) a que existe.
 */

export interface PlatformFeature extends FeatureDefinition {
  /** Estado final, com herança aplicada. */
  enabled: boolean;
  /** `true` quando o cliente mexeu; `false` quando vale o padrão. */
  overridden: boolean;
  /** Desligada por causa do pai — o controle fica travado. */
  blockedByParent: boolean;
}

export interface PlatformBranding {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  brandColor: string | null;
  mailFromName: string | null;
  mailFromEmail: string | null;
}

export function PlatformView({
  tenantName,
  features,
  branding,
}: {
  tenantName: string;
  features: PlatformFeature[];
  branding: PlatformBranding;
}) {
  const router = useRouter();
  const formId = useId();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /* Estado otimista do interruptor.
     
     Sem isto o controle não reage: ele é `checked={feature.enabled}`, e
     `feature` só muda depois que o `router.refresh()` volta do servidor. No
     intervalo o React reverte a marcação, e quem clicou vê o interruptor
     voltar sozinho — parece que o clique não pegou. */
  const [pendente, setPendente] = useState<Record<string, boolean>>({});

  async function salvar(corpo: Record<string, unknown>, mensagem: string) {
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/plataforma", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (!response.ok) {
        const erro = (await response.json().catch(() => ({}))) as { error?: string };
        setPendente({});
        setNotice(erro.error ?? "Não foi possível salvar.");
        return;
      }

      setNotice(mensagem);
      /* Recarrega para a mudança valer na tela inteira: desligar uma
         funcionalidade tira item do menu, e o menu é renderizado no servidor.
         O estado otimista é descartado aqui — o servidor passa a ser a fonte,
         inclusive para os filhos que a herança acabou de derrubar. */
      setPendente({});
      router.refresh();
    } catch {
      setPendente({});
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBranding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await salvar(
      {
        logoLightUrl: form.get("logoLightUrl"),
        logoDarkUrl: form.get("logoDarkUrl"),
        faviconUrl: form.get("faviconUrl"),
        brandColor: form.get("brandColor"),
        mailFromName: form.get("mailFromName"),
        mailFromEmail: form.get("mailFromEmail"),
      },
      "Identidade visual salva.",
    );
  }

  return (
    <div className="platform">
      <div className="page-head">
        <h1 className="page-head__greeting">Plataforma</h1>
        <p className="page-head__sub">
          O que está disponível e com que aparência, para {tenantName}.
        </p>
      </div>

      <section className="course-section" aria-labelledby="funcionalidades">
        <h2 className="course-section__title" id="funcionalidades">
          <ToggleLeft aria-hidden /> Funcionalidades
        </h2>
        <p className="platform__hint">
          Desligar uma funcionalidade some com ela do menu e fecha o endereço dela. O que já foi
          criado continua no banco — nada é apagado.
        </p>

        <ul className="platform__features">
          {features.map((feature) => {
            const nivel = feature.key.split(".").length - 1;

            return (
              <li
                className="platform__feature"
                key={feature.key}
                data-nivel={nivel}
                data-bloqueada={feature.blockedByParent || undefined}
              >
                <label className="platform__switch">
                  <input
                    type="checkbox"
                    checked={pendente[feature.key] ?? feature.enabled}
                    disabled={busy || feature.blockedByParent}
                    onChange={(event) => {
                      const alvo = event.target.checked;
                      setPendente((atual) => ({ ...atual, [feature.key]: alvo }));
                      void salvar(
                        { feature: feature.key, enabled: alvo },
                        alvo ? `${feature.label} ligada.` : `${feature.label} desligada.`,
                      );
                    }}
                  />
                  <span className="platform__feature-text">
                    <span className="platform__feature-label">
                      {feature.label}
                      {feature.overridden ? (
                        <span className="platform__badge">personalizado</span>
                      ) : null}
                    </span>
                    <span className="platform__feature-desc">
                      {feature.blockedByParent
                        ? "Indisponível porque a funcionalidade acima está desligada."
                        : feature.description}
                    </span>
                  </span>
                </label>

                {feature.overridden && !feature.blockedByParent ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={busy}
                    onClick={() =>
                      salvar(
                        { feature: feature.key, enabled: null },
                        `${feature.label} voltou ao padrão.`,
                      )
                    }
                  >
                    Voltar ao padrão
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="course-section" aria-labelledby="identidade">
        <h2 className="course-section__title" id="identidade">
          <Palette aria-hidden /> Identidade visual
        </h2>
        <p className="platform__hint">
          Campo em branco usa o padrão da plataforma. A cor de marca gera as demais — hover, faixa,
          gradiente — e o contraste do texto é ajustado para continuar legível.
        </p>

        <form className="platform__form" id={formId} onSubmit={handleBranding}>
          <div className="field">
            <label className="label" htmlFor={`${formId}-cor`}>
              Cor da marca
            </label>
            <input
              className="input"
              id={`${formId}-cor`}
              name="brandColor"
              type="text"
              placeholder="#7C3AED"
              defaultValue={branding.brandColor ?? ""}
              pattern="#[0-9a-fA-F]{6}"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor={`${formId}-logo-clara`}>
              Logo para fundo claro
            </label>
            <input
              className="input"
              id={`${formId}-logo-clara`}
              name="logoLightUrl"
              type="text"
              placeholder="/brand/logo-do-cliente.png"
              defaultValue={branding.logoLightUrl ?? ""}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor={`${formId}-logo-escura`}>
              Logo para fundo escuro
            </label>
            <input
              className="input"
              id={`${formId}-logo-escura`}
              name="logoDarkUrl"
              type="text"
              placeholder="/brand/logo-do-cliente-branca.png"
              defaultValue={branding.logoDarkUrl ?? ""}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor={`${formId}-favicon`}>
              Favicon
            </label>
            <input
              className="input"
              id={`${formId}-favicon`}
              name="faviconUrl"
              type="text"
              placeholder="/favicon.ico"
              defaultValue={branding.faviconUrl ?? ""}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor={`${formId}-remetente`}>
              Nome do remetente dos e-mails
            </label>
            <input
              className="input"
              id={`${formId}-remetente`}
              name="mailFromName"
              type="text"
              placeholder={tenantName}
              defaultValue={branding.mailFromName ?? ""}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor={`${formId}-email`}>
              E-mail do remetente
            </label>
            <input
              className="input"
              id={`${formId}-email`}
              name="mailFromEmail"
              type="email"
              placeholder="treinamento@empresa.com.br"
              defaultValue={branding.mailFromEmail ?? ""}
            />
          </div>

          <div className="platform__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              <Check aria-hidden /> {busy ? "Salvando" : "Salvar identidade"}
            </button>
          </div>
        </form>
      </section>

      <p className="status-text" role="status">
        {notice}
      </p>
    </div>
  );
}
