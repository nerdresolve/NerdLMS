"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";

import { PROVIDER_PRESETS } from "@nerdlms/core/sso/providers.ts";

import "./sso.css";
import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

/**
 * Acesso por provedor de identidade — F5-04 (guia §32).
 *
 * A tela existe para que implantar SSO num cliente novo seja colar duas
 * chaves. Os endereços do Google e da Microsoft já vêm no produto; o que a
 * pessoa preenche é o que só ela tem.
 *
 * Três decisões visíveis aqui:
 *
 *   A URL DE RETORNO APARECE PRIMEIRO, pronta para copiar. É o passo que mais
 *   trava implantação — o provedor recusa se o endereço não bater exatamente,
 *   e a mensagem de erro dele não diz qual era o esperado.
 *
 *   A CHAVE SECRETA NUNCA É EXIBIDA. O campo mostra se existe uma guardada;
 *   deixar em branco mantém a que está lá.
 *
 *   DESLIGAR A SENHA LOCAL PEDE CONFIRMAÇÃO. Errar a configuração com a senha
 *   desligada tranca todo mundo do lado de fora, inclusive quem consertaria.
 */

export interface SsoProviderRow {
  id: string;
  provider: string;
  displayName: string;
  clientId: string;
  hasSecret: boolean;
  providerTenantId: string | null;
  authorizationUrl: string | null;
  tokenUrl: string | null;
  jwksUrl: string | null;
  issuer: string | null;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
  allowPasswordLogin: boolean;
}

const PAPEIS = [
  { key: "learner", label: "Aluno" },
  { key: "instructor", label: "Instrutor" },
  { key: "manager", label: "Gestor" },
];

/** Copia com aviso — o mesmo padrão da tela de integrações. */
function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      className="btn btn--secondary sso-adm__copiar"
      onClick={() => {
        void navigator.clipboard.writeText(valor).then(() => {
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 2000);
        });
      }}
    >
      {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copiado ? "Copiado" : rotulo}
    </button>
  );
}

export function SsoView({
  providers,
  redirectUri,
}: {
  providers: SsoProviderRow[];
  redirectUri: string;
}) {
  const [linhas, setLinhas] = useState(providers);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /* Um provedor por tipo. O que já existe é editado; o que falta aparece como
     opção de configurar — sem uma tela separada de "adicionar", que para três
     opções fixas só somaria um clique. */
  const porTipo = new Map(linhas.map((l) => [l.provider, l]));

  async function salvar(provider: string, form: HTMLFormElement) {
    setSalvando(provider);
    setErro(null);

    const dados = new FormData(form);
    const corpo = {
      provider,
      displayName: String(dados.get("displayName") ?? ""),
      clientId: String(dados.get("clientId") ?? ""),
      /* Vazio significa "mantenha a que está lá", e não "apague". */
      clientSecret: String(dados.get("clientSecret") ?? ""),
      providerTenantId: String(dados.get("providerTenantId") ?? ""),
      authorizationUrl: String(dados.get("authorizationUrl") ?? ""),
      tokenUrl: String(dados.get("tokenUrl") ?? ""),
      jwksUrl: String(dados.get("jwksUrl") ?? ""),
      issuer: String(dados.get("issuer") ?? ""),
      allowedDomains: String(dados.get("allowedDomains") ?? ""),
      allowJit: dados.get("allowJit") === "on",
      jitRole: String(dados.get("jitRole") ?? "learner"),
      enabled: dados.get("enabled") === "on",
      allowPasswordLogin: dados.get("allowPasswordLogin") === "on",
    };

    const resposta = await fetch("/api/sso/provedores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });

    const json = (await resposta.json().catch(() => null)) as
      | { provider?: SsoProviderRow; error?: string }
      | null;

    setSalvando(null);

    if (!resposta.ok || !json?.provider) {
      setErro(json?.error ?? "Não foi possível salvar.");
      return;
    }

    const salvo = json.provider;
    setLinhas((atuais) => {
      const semEste = atuais.filter((l) => l.provider !== provider);
      return [...semEste, salvo];
    });
  }

  return (
    <>
      <section className="course-section" aria-labelledby="retorno">
        <h2 className="course-section__title" id="retorno">
          <ShieldCheck aria-hidden /> Acesso pelo provedor da empresa
        </h2>

        <p className="platform__hint">
          Quem entra pelo provedor não tem senha aqui: a autenticação acontece no diretório da
          empresa, e desligar alguém lá fecha o acesso aqui.
        </p>

        {/* Primeiro item da tela, e de propósito: é o passo que mais trava
            implantação. O provedor compara a string inteira e recusa por uma
            barra a mais, sem dizer qual era o endereço esperado. */}
        <div className="sso-adm__retorno">
          <div>
            <strong>URL de retorno</strong>
            <p>Cadastre este endereço no provedor, exatamente como está aqui.</p>
            <code>{redirectUri}</code>
          </div>
          <BotaoCopiar valor={redirectUri} rotulo="Copiar" />
        </div>
      </section>

      {erro ? (
        <div className="sso-adm__erro" role="alert">
          {erro}
        </div>
      ) : null}

      {PROVIDER_PRESETS.map((preset) => {
        const atual = porTipo.get(preset.id);
        const aberto = Boolean(atual);

        return (
          <section className="course-section" key={preset.id} aria-labelledby={`p-${preset.id}`}>
            <h2 className="course-section__title" id={`p-${preset.id}`}>
              {preset.label}
              {atual?.enabled ? <span className="sso-adm__ligado">ligado</span> : null}
            </h2>

            <p className="platform__hint">{preset.hint}</p>

            <form
              method="post"
              className="sso-adm__form"
              onSubmit={(evento) => {
                evento.preventDefault();
                void salvar(preset.id, evento.currentTarget);
              }}
            >
              <label className="field">
                <span>Texto do botão</span>
                <input
                  name="displayName"
                  defaultValue={atual?.displayName ?? preset.label}
                  {...campoObrigatorio("Dê um nome a este provedor.")}
                  maxLength={60}
                />
              </label>

              <label className="field">
                <span>ID do cliente</span>
                <input name="clientId" defaultValue={atual?.clientId ?? ""} {...campoObrigatorio("Informe o ID do cliente no provedor.")} />
              </label>

              <label className="field">
                <span>Chave secreta</span>
                <input
                  name="clientSecret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={atual?.hasSecret ? "Guardada, deixe em branco para manter" : ""}
                  /* Obrigatória só na primeira vez. Com a chave já guardada, o
                     campo em branco significa "mantenha a que está lá", e
                     exigi-la de novo obrigaria a redigitar um segredo que o
                     administrador provavelmente não tem à mão. */
                  {...(atual?.hasSecret
                    ? {}
                    : campoObrigatorio("Informe a chave secreta do provedor."))}
                />
              </label>

              {preset.requiresTenantId ? (
                <label className="field">
                  <span>ID do diretório (locatário)</span>
                  <input
                    name="providerTenantId"
                    defaultValue={atual?.providerTenantId ?? ""}
                    {...campoObrigatorio("Informe o identificador do locatário no provedor.")}
                    placeholder="00000000-0000-0000-0000-000000000000"
                  />
                </label>
              ) : null}

              {/* Só o genérico pede endereços: para Google e Microsoft eles
                  vêm prontos, e um campo editável convidaria a errar o que já
                  está certo. */}
              {preset.id === "generico" ? (
                <>
                  <label className="field sso-adm__larga">
                    <span>URL de autorização</span>
                    <input name="authorizationUrl" defaultValue={atual?.authorizationUrl ?? ""} {...campoObrigatorio("Informe a URL de autorização.")} />
                  </label>
                  <label className="field sso-adm__larga">
                    <span>URL de token</span>
                    <input name="tokenUrl" defaultValue={atual?.tokenUrl ?? ""} {...campoObrigatorio("Informe a URL de token.")} />
                  </label>
                  <label className="field sso-adm__larga">
                    <span>URL do JWKS</span>
                    <input name="jwksUrl" defaultValue={atual?.jwksUrl ?? ""} {...campoObrigatorio("Informe a URL do JWKS.")} />
                  </label>
                  <label className="field sso-adm__larga">
                    <span>Emissor (issuer)</span>
                    <input name="issuer" defaultValue={atual?.issuer ?? ""} {...campoObrigatorio("Informe o emissor declarado pelo provedor.")} />
                  </label>
                </>
              ) : null}

              <label className="field sso-adm__larga">
                <span>Domínios aceitos</span>
                <input
                  name="allowedDomains"
                  defaultValue={atual?.allowedDomains ?? ""}
                  placeholder="acme.com.br, acme.com"
                />
                <small>
                  Separados por vírgula. Em branco aceita qualquer domínio, inclusive contas
                  pessoais, se o provedor permitir.
                </small>
              </label>

              <fieldset className="sso-adm__opcoes">
                <legend className="sr-only">Opções</legend>

                <label className="sso-adm__check">
                  <input type="checkbox" name="allowJit" defaultChecked={atual?.allowJit ?? false} />
                  <span>
                    <strong>Criar conta no primeiro acesso</strong>
                    <small>
                      Sem isto, só entra quem já foi cadastrado. Com isto, qualquer pessoa do
                      diretório vira usuária ao entrar pela primeira vez.
                    </small>
                  </span>
                </label>

                <label className="field sso-adm__papel">
                  <span>Papel de quem for criado</span>
                  <select name="jitRole" defaultValue={atual?.jitRole ?? "learner"}>
                    {PAPEIS.map((papel) => (
                      <option key={papel.key} value={papel.key}>
                        {papel.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sso-adm__check">
                  <input type="checkbox" name="enabled" defaultChecked={atual?.enabled ?? false} />
                  <span>
                    <strong>Mostrar o botão na tela de login</strong>
                    <small>Desligar esconde o botão e mantém quem já vinculou a conta.</small>
                  </span>
                </label>

                <label className="sso-adm__check">
                  <input
                    type="checkbox"
                    name="allowPasswordLogin"
                    defaultChecked={atual?.allowPasswordLogin ?? true}
                    onChange={(evento) => {
                      /* Desmarcar tranca quem não tem conta no provedor —
                         inclusive quem consertaria uma configuração errada.
                         A confirmação é o único aviso antes disso. */
                      if (evento.currentTarget.checked) return;
                      const segue = window.confirm(
                        "Desligar a senha faz TODO MUNDO depender do provedor. " +
                          "Se a configuração estiver errada, ninguém entra, nem você. " +
                          "Teste o acesso pelo provedor antes. Continuar?",
                      );
                      if (!segue) evento.currentTarget.checked = true;
                    }}
                  />
                  <span>
                    <strong>Manter o login por senha</strong>
                    <small>
                      Desligar exige que todos entrem pelo provedor. Só faça depois de testar.
                    </small>
                  </span>
                </label>
              </fieldset>

              <div className="sso-adm__acoes">
                <button type="submit" className="btn btn--primary" disabled={salvando === preset.id}>
                  {salvando === preset.id ? "Salvando…" : aberto ? "Salvar" : "Configurar"}
                </button>

                {atual?.enabled ? (
                  <a className="link" href="/login" target="_blank" rel="noreferrer">
                    Ver na tela de login <ExternalLink aria-hidden />
                  </a>
                ) : null}
              </div>
            </form>
          </section>
        );
      })}
    </>
  );
}
