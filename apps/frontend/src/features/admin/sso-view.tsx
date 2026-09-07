"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";

import { PROVIDER_PRESETS } from "@nerdlms/core/sso/providers.ts";
import { DIRECTORY_PRESETS } from "@nerdlms/core/ldap/directory.ts";

import "./sso.css";

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

export interface LdapRow {
  id: string;
  kind: string;
  displayName: string;
  host: string;
  port: number;
  domain: string | null;
  baseDn: string | null;
  dnTemplate: string;
  allowSelfSigned: boolean;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
}

export interface SamlRow {
  id: string;
  displayName: string;
  idpEntityId: string;
  ssoUrl: string;
  /**
   * Os certificados cadastrados, em PEM.
   *
   * Vão para a tela, ao contrário da chave secreta do OIDC: certificado é
   * público por definição, e quem configura precisa ver quais estão lá para
   * saber se a rotação já foi feita.
   */
  certificates: string[];
  spEntityId: string;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
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

import { useSsoForm } from "./use-sso-form.ts";

export function SsoView({
  providers,
  directories,
  saml,
  redirectUri,
  samlAcsUrl,
  samlEntityId,
}: {
  providers: SsoProviderRow[];
  directories: LdapRow[];
  saml: SamlRow | null;
  redirectUri: string;
  samlAcsUrl: string;
  samlEntityId: string;
}) {
  const [linhas, setLinhas] = useState(providers);
  const [diretorios, setDiretorios] = useState(directories);
  const [samlAtual, setSamlAtual] = useState(saml);
  const { salvando, erro, salvar: gravar } = useSsoForm();

  /* Um provedor por tipo. O que já existe é editado; o que falta aparece como
     opção de configurar — sem uma tela separada de "adicionar", que para três
     opções fixas só somaria um clique. */
  const porTipo = new Map(linhas.map((l) => [l.provider, l]));

  /** Salva um diretório LDAP. */
  async function salvarDiretorio(kind: string, form: HTMLFormElement) {
    const dados = new FormData(form);

    const salvo = await gravar<LdapRow>({
      cartao: `ldap:${kind}`,
      rota: "/api/sso/diretorios",
      chave: "directory",
      corpo: {
        kind,
        displayName: String(dados.get("displayName") ?? ""),
        host: String(dados.get("host") ?? ""),
        port: Number(dados.get("port") ?? 636),
        domain: String(dados.get("domain") ?? ""),
        baseDn: String(dados.get("baseDn") ?? ""),
        dnTemplate: String(dados.get("dnTemplate") ?? ""),
        allowSelfSigned: dados.get("allowSelfSigned") === "on",
        allowedDomains: String(dados.get("allowedDomains") ?? ""),
        allowJit: dados.get("allowJit") === "on",
        jitRole: String(dados.get("jitRole") ?? "learner"),
        enabled: dados.get("enabled") === "on",
      },
    });

    if (!salvo) return;
    setDiretorios((atuais) => [...atuais.filter((d) => d.kind !== kind), salvo]);
  }

  /** Salva o provedor SAML. */
  async function salvarSaml(form: HTMLFormElement) {
    const dados = new FormData(form);

    const salvo = await gravar<SamlRow>({
      cartao: "saml",
      rota: "/api/sso/saml",
      chave: "saml",
      corpo: {
        displayName: String(dados.get("displayName") ?? ""),
        idpEntityId: String(dados.get("idpEntityId") ?? ""),
        ssoUrl: String(dados.get("ssoUrl") ?? ""),
        certificates: String(dados.get("certificates") ?? ""),
        spEntityId: String(dados.get("spEntityId") ?? ""),
        allowedDomains: String(dados.get("allowedDomains") ?? ""),
        allowJit: dados.get("allowJit") === "on",
        jitRole: String(dados.get("jitRole") ?? "learner"),
        enabled: dados.get("enabled") === "on",
      },
    });

    if (!salvo) return;
    setSamlAtual(salvo);
  }

  /** Salva um provedor OIDC. */
  async function salvar(provider: string, form: HTMLFormElement) {
    const dados = new FormData(form);

    const salvo = await gravar<SsoProviderRow>({
      cartao: provider,
      rota: "/api/sso/provedores",
      chave: "provider",
      corpo: {
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
      },
    });

    if (!salvo) return;
    setLinhas((atuais) => [...atuais.filter((l) => l.provider !== provider), salvo]);
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
                  required
                  maxLength={60}
                />
              </label>

              <label className="field">
                <span>ID do cliente</span>
                <input name="clientId" defaultValue={atual?.clientId ?? ""} required />
              </label>

              <label className="field">
                <span>Chave secreta</span>
                <input
                  name="clientSecret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={atual?.hasSecret ? "Guardada — deixe em branco para manter" : ""}
                  required={!atual?.hasSecret}
                />
              </label>

              {preset.requiresTenantId ? (
                <label className="field">
                  <span>ID do diretório (locatário)</span>
                  <input
                    name="providerTenantId"
                    defaultValue={atual?.providerTenantId ?? ""}
                    required
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
                    <input name="authorizationUrl" defaultValue={atual?.authorizationUrl ?? ""} required />
                  </label>
                  <label className="field sso-adm__larga">
                    <span>URL de token</span>
                    <input name="tokenUrl" defaultValue={atual?.tokenUrl ?? ""} required />
                  </label>
                  <label className="field sso-adm__larga">
                    <span>URL do JWKS</span>
                    <input name="jwksUrl" defaultValue={atual?.jwksUrl ?? ""} required />
                  </label>
                  <label className="field sso-adm__larga">
                    <span>Emissor (issuer)</span>
                    <input name="issuer" defaultValue={atual?.issuer ?? ""} required />
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
                  Separados por vírgula. Em branco aceita qualquer domínio — inclusive contas
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
                          "Se a configuração estiver errada, ninguém entra — nem você. " +
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

      {/* Diretórios LDAP.

          Depois do OIDC porque é a escolha de quem tem infraestrutura própria
          — e quem tem Google ou Microsoft para nesta tela antes de chegar
          aqui. */}
      {DIRECTORY_PRESETS.map((preset) => {
        const atual = diretorios.find((d) => d.kind === preset.id);

        return (
          <section className="course-section" key={preset.id} aria-labelledby={`d-${preset.id}`}>
            <h2 className="course-section__title" id={`d-${preset.id}`}>
              {preset.label}
              {atual?.enabled ? <span className="sso-adm__ligado">ligado</span> : null}
            </h2>

            <p className="platform__hint">{preset.hint}</p>

            <form
              className="sso-adm__form"
              onSubmit={(evento) => {
                evento.preventDefault();
                void salvarDiretorio(preset.id, evento.currentTarget);
              }}
            >
              <label className="field">
                <span>Texto do botão</span>
                <input
                  name="displayName"
                  defaultValue={atual?.displayName ?? "Conta da rede"}
                  required
                  maxLength={60}
                />
              </label>

              <label className="field">
                <span>Servidor</span>
                <input
                  name="host"
                  defaultValue={atual?.host ?? ""}
                  required
                  placeholder="dc.empresa.com.br"
                />
              </label>

              <label className="field">
                <span>Porta</span>
                <input
                  name="port"
                  type="number"
                  min={1}
                  max={65535}
                  defaultValue={atual?.port ?? preset.defaultPort}
                  required
                />
                <small>
                  636 é LDAP sobre TLS. A porta 389 não é oferecida: sem TLS, a senha atravessa a
                  rede legível.
                </small>
              </label>

              {preset.requires === "domain" ? (
                <label className="field">
                  <span>Domínio</span>
                  <input
                    name="domain"
                    defaultValue={atual?.domain ?? ""}
                    required
                    placeholder="empresa.com.br"
                  />
                  <small>O mesmo domínio que as pessoas usam para entrar na rede.</small>
                </label>
              ) : null}

              {preset.id === "openldap" ? (
                <label className="field sso-adm__larga">
                  <span>Base do diretório</span>
                  <input
                    name="baseDn"
                    defaultValue={atual?.baseDn ?? ""}
                    required
                    placeholder="dc=empresa,dc=com,dc=br"
                  />
                </label>
              ) : null}

              {preset.id === "generico" ? (
                <label className="field sso-adm__larga">
                  <span>Molde do DN</span>
                  <input
                    name="dnTemplate"
                    defaultValue={atual?.dnTemplate ?? ""}
                    required
                    placeholder="cn={user},ou=usuarios,dc=empresa,dc=com"
                  />
                  <small>
                    Use <code>{"{user}"}</code> onde entra o nome de quem faz login.
                  </small>
                </label>
              ) : null}

              <label className="field sso-adm__larga">
                <span>Domínios aceitos</span>
                <input
                  name="allowedDomains"
                  defaultValue={atual?.allowedDomains ?? ""}
                  placeholder="empresa.com.br"
                />
                <small>Separados por vírgula. Em branco aceita qualquer um.</small>
              </label>

              <fieldset className="sso-adm__opcoes">
                <legend className="sr-only">Opções</legend>

                <label className="sso-adm__check">
                  <input
                    type="checkbox"
                    name="allowSelfSigned"
                    defaultChecked={atual?.allowSelfSigned ?? false}
                  />
                  <span>
                    <strong>Aceitar certificado emitido pela empresa</strong>
                    <small>
                      Diretório corporativo raramente usa certificado de autoridade pública. Marque
                      se a conexão falhar por certificado.
                    </small>
                  </span>
                </label>

                <label className="sso-adm__check">
                  <input type="checkbox" name="allowJit" defaultChecked={atual?.allowJit ?? false} />
                  <span>
                    <strong>Criar conta no primeiro acesso</strong>
                    <small>
                      Sem isto, só entra quem já foi cadastrado aqui.
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
              </fieldset>

              <div className="sso-adm__acoes">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={salvando === `ldap:${preset.id}`}
                >
                  {salvando === `ldap:${preset.id}` ? "Salvando…" : atual ? "Salvar" : "Configurar"}
                </button>
              </div>
            </form>
          </section>
        );
      })}

      {/* SAML 2.0.

          A troca aqui é MÚTUA, e é isso que a seção precisa deixar claro: três
          valores vêm do provedor, dois vão para ele. Uma tela que só pedisse
          dados deixaria quem configura sem saber o que entregar do outro
          lado. */}
      <section className="course-section" aria-labelledby="saml">
        <h2 className="course-section__title" id="saml">
          SAML 2.0
          {samlAtual?.enabled ? <span className="sso-adm__ligado">ligado</span> : null}
        </h2>

        <p className="platform__hint">
          Para ADFS, Okta, OneLogin, Shibboleth e outros. A configuração é dos dois lados: você
          traz três valores do provedor e entrega dois a ele.
        </p>

        <div className="sso-adm__retorno">
          <div>
            <strong>Entregue ao provedor</strong>
            <p>Estes dois valores são cadastrados lá, no registro desta plataforma.</p>
            <code>Entity ID: {samlEntityId}</code>
            <code>URL de retorno (ACS): {samlAcsUrl}</code>
          </div>
          <BotaoCopiar valor={samlAcsUrl} rotulo="Copiar ACS" />
        </div>

        <form
          className="sso-adm__form"
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvarSaml(evento.currentTarget);
          }}
        >
          <label className="field">
            <span>Texto do botão</span>
            <input
              name="displayName"
              defaultValue={samlAtual?.displayName ?? "Acesso corporativo"}
              required
              maxLength={60}
            />
          </label>

          <label className="field">
            <span>Entity ID desta plataforma</span>
            <input
              name="spEntityId"
              defaultValue={samlAtual?.spEntityId ?? samlEntityId}
              required
            />
            <small>O mesmo valor que você cadastrou no provedor.</small>
          </label>

          <label className="field sso-adm__larga">
            <span>Entity ID do provedor</span>
            <input
              name="idpEntityId"
              defaultValue={samlAtual?.idpEntityId ?? ""}
              required
              placeholder="https://sts.empresa.com.br/adfs/services/trust"
            />
            <small>Nos metadados do provedor, o atributo entityID.</small>
          </label>

          <label className="field sso-adm__larga">
            <span>URL de SSO</span>
            <input
              name="ssoUrl"
              defaultValue={samlAtual?.ssoUrl ?? ""}
              required
              placeholder="https://sts.empresa.com.br/adfs/ls/"
            />
            <small>O endereço HTTP-Redirect de SingleSignOnService.</small>
          </label>

          <label className="field sso-adm__larga">
            <span>Certificados de assinatura</span>
            <textarea
              className="input sso-adm__certs"
              name="certificates"
              rows={8}
              defaultValue={samlAtual?.certificates.join("\n\n") ?? ""}
              placeholder={"-----BEGIN CERTIFICATE-----\n...(o conteudo)...\n-----END CERTIFICATE-----"}
            />
            <small>
              Um por bloco, separados por linha em branco. Durante a rotação de chave, cadastre o
              novo ao lado do antigo — os dois valem, e ninguém percebe a troca.
            </small>
          </label>

          <label className="field sso-adm__larga">
            <span>Domínios aceitos</span>
            <input
              name="allowedDomains"
              defaultValue={samlAtual?.allowedDomains ?? ""}
              placeholder="empresa.com.br"
            />
          </label>

          <fieldset className="sso-adm__opcoes">
            <legend className="sr-only">Opções</legend>

            <label className="sso-adm__check">
              <input type="checkbox" name="allowJit" defaultChecked={samlAtual?.allowJit ?? false} />
              <span>
                <strong>Criar conta no primeiro acesso</strong>
                <small>Sem isto, só entra quem já foi cadastrado aqui.</small>
              </span>
            </label>

            <label className="field sso-adm__papel">
              <span>Papel de quem for criado</span>
              <select name="jitRole" defaultValue={samlAtual?.jitRole ?? "learner"}>
                {PAPEIS.map((papel) => (
                  <option key={papel.key} value={papel.key}>
                    {papel.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sso-adm__check">
              <input type="checkbox" name="enabled" defaultChecked={samlAtual?.enabled ?? false} />
              <span>
                <strong>Mostrar o botão na tela de login</strong>
                <small>
                  Exige ao menos um certificado cadastrado: ligado sem ele, o botão sempre falharia.
                </small>
              </span>
            </label>
          </fieldset>

          <div className="sso-adm__acoes">
            <button type="submit" className="btn btn--primary" disabled={salvando === "saml"}>
              {salvando === "saml" ? "Salvando…" : samlAtual ? "Salvar" : "Configurar"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
