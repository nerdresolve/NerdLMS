"use client";

import { useState } from "react";
import { Info, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { GoogleMark, MicrosoftMark } from "@/components/brand/provider-marks.tsx";

/**
 * Entrada pelo sistema da empresa.
 *
 * Os três caminhos convivem aqui, e um deles se comporta de forma diferente:
 *
 *   OIDC e SAML são LINKS. A pessoa vai ao provedor, autentica lá e volta — a
 *   senha nunca passa por esta tela.
 *
 *   LDAP é um FORMULÁRIO. Não há ida a lugar nenhum: a senha do diretório é
 *   digitada aqui e repassada ao servidor. É a razão de este componente ser de
 *   cliente, e a razão de o botão do LDAP abrir campos em vez de navegar.
 *
 * Sem provedor configurado, o bloco inteiro some — inclusive o "ou continue
 * com", que sem botão nenhum embaixo ficaria pendurado no vazio.
 */

export interface SsoOption {
  id: string;
  provider: string;
  displayName: string;
  /** Decide se o botão navega ou abre um formulário. */
  kind: "oidc" | "ldap" | "saml";
}

function marca(provider: string) {
  if (provider === "google") return <GoogleMark />;
  if (provider === "microsoft") return <MicrosoftMark />;
  if (provider === "saml") return <ShieldCheck aria-hidden />;
  return <KeyRound aria-hidden />;
}

export function SsoButtons({ options, error }: { options: SsoOption[]; error?: string | null }) {
  /* Qual diretório está com o formulário aberto. Um de cada vez: dois
     conjuntos de campos de senha na mesma tela confundiriam qual é qual. */
  const [aberto, setAberto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  if (options.length === 0 && !error) return null;

  async function entrarPorDiretorio(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();

    const dados = new FormData(event.currentTarget);

    setEnviando(true);
    setFalha(null);

    try {
      const resposta = await fetch("/api/ldap/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          diretorio: id,
          usuario: String(dados.get("usuario") ?? ""),
          senha: String(dados.get("senha") ?? ""),
        }),
      });

      if (resposta.ok) {
        /* Recarga inteira, não `router.push`: a sessão nasceu num cookie que o
           servidor acabou de escrever, e a navegação do cliente traria a
           página do cache, ainda deslogada. */
        window.location.assign("/dashboard");
        return;
      }

      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
      setFalha(corpo.error ?? "Não foi possível entrar.");
    } catch {
      setFalha("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setEnviando(false);
    }
  }

  function href(opcao: SsoOption): string {
    return opcao.kind === "saml"
      ? "/api/saml/iniciar"
      : `/api/sso/iniciar?provedor=${encodeURIComponent(opcao.id)}`;
  }

  return (
    <>
      <div className="divider" role="separator">
        ou continue com
      </div>

      <div className="sso" data-unico={options.length === 1 || undefined}>
        {options.map((opcao) =>
          opcao.kind === "ldap" ? (
            <button
              key={opcao.id}
              type="button"
              className="btn btn--secondary"
              aria-expanded={aberto === opcao.id}
              onClick={() => {
                setAberto((atual) => (atual === opcao.id ? null : opcao.id));
                setFalha(null);
              }}
            >
              {marca(opcao.provider)}
              <span>{opcao.displayName}</span>
            </button>
          ) : (
            <a key={opcao.id} className="btn btn--secondary" href={href(opcao)}>
              {marca(opcao.provider)}
              <span>{opcao.displayName}</span>
            </a>
          ),
        )}
      </div>

      {/* O formulário do diretório.

          Abaixo dos botões e não num modal: é a mesma tela de login, com os
          mesmos campos que a pessoa acabou de ver acima. Um modal daria a
          impressão de estar entrando em outro sistema. */}
      {options
        .filter((o) => o.kind === "ldap" && o.id === aberto)
        .map((opcao) => (
          <form
            key={opcao.id}
            className="sso-ldap"
            onSubmit={(evento) => void entrarPorDiretorio(evento, opcao.id)}
          >
            <div className="field">
              <label className="field__label" htmlFor="ldap-usuario">
                Usuário da rede
              </label>
              <input
                className="input"
                id="ldap-usuario"
                name="usuario"
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="ldap-senha">
                Senha da rede
              </label>
              <input
                className="input"
                id="ldap-senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? <Loader2 aria-hidden /> : null}
              {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        ))}

      <div className="notice" data-visible={error || falha ? "true" : "false"} role="status">
        {error || falha ? (
          <>
            <Info aria-hidden="true" />
            <span>{falha ?? error}</span>
          </>
        ) : null}
      </div>
    </>
  );
}
