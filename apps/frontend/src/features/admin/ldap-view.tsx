"use client";

import { useState } from "react";
import { Network, Plus, Trash2 } from "lucide-react";

import { DIRECTORY_PRESETS } from "@nerdlms/core/ldap/directory.ts";
import type { Role } from "@nerdlms/core/ldap/mapping.ts";
import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

/**
 * Configuração do diretório da empresa.
 *
 * A tela existe porque, até aqui, `ldap_directories` só se preenchia por SQL à
 * mão — e depois que a senha da conta de serviço passou a ser cifrada pela
 * aplicação, nem isso funciona mais. Um recurso que não tem como ser ligado é
 * um recurso que não existe.
 *
 * O QUE ESTA TELA PRECISA DEIXAR CLARO, e por que cada aviso está aqui:
 *
 *   Que mapear grupos TIRA papéis, não só concede. É a parte que surpreende:
 *   quem edita o papel de alguém na tela de usuários vê a edição se desfazer no
 *   acesso seguinte, e sem aviso isso parece defeito.
 *
 *   Que desligar a senha local é irreversível pela própria tela se o diretório
 *   cair. Quem marca essa opção precisa saber disso ANTES.
 */

export interface GroupRoleRow {
  groupCn: string;
  role: Role;
}

export interface LdapDirectoryRow {
  id: string;
  kind: string;
  displayName: string;
  host: string;
  port: number;
  domain: string | null;
  baseDn: string | null;
  dnTemplate: string | null;
  allowSelfSigned: boolean;
  allowedDomains: string;
  allowJit: boolean;
  jitRole: string;
  enabled: boolean;
  allowPasswordLogin: boolean;
  serviceDn: string | null;
  /** Se existe uma senha guardada. Nunca o valor dela. */
  temSenhaDeServico: boolean;
  searchBase: string | null;
  syncProfile: boolean;
  requireGroup: boolean;
  groupRoles: GroupRoleRow[];
}

const PAPEIS: { valor: Role; rotulo: string }[] = [
  { valor: "learner", rotulo: "Aluno" },
  { valor: "instructor", rotulo: "Instrutor" },
  { valor: "manager", rotulo: "Gestor" },
  { valor: "admin", rotulo: "Administrador" },
];

export function LdapView({ diretorios }: { diretorios: LdapDirectoryRow[] }) {
  const [linhas, setLinhas] = useState(diretorios);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const porTipo = new Map(linhas.map((l) => [l.kind, l]));

  return (
    <>
      <section className="course-section" aria-labelledby="ldap">
        <h2 className="course-section__title" id="ldap">
          <Network aria-hidden /> Diretório da empresa
        </h2>

        <p className="platform__hint">
          Quem entra pelo diretório usa o mesmo usuário e senha do computador da empresa. A senha
          não fica guardada aqui: ela é conferida no servidor do diretório a cada acesso, e
          desligar alguém lá fecha o acesso aqui no mesmo dia.
        </p>
      </section>

      {erro ? (
        <div className="sso-adm__erro" role="alert">
          {erro}
        </div>
      ) : null}

      {DIRECTORY_PRESETS.map((preset) => (
        <FormularioDiretorio
          key={preset.id}
          preset={preset}
          atual={porTipo.get(preset.id) ?? null}
          salvando={salvando === preset.id}
          onSalvar={async (corpo) => {
            setSalvando(preset.id);
            setErro(null);

            const resposta = await fetch("/api/ldap/diretorios", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...corpo, kind: preset.id }),
            });

            const json = (await resposta.json().catch(() => null)) as
              | { diretorio?: LdapDirectoryRow; error?: string }
              | null;

            setSalvando(null);

            if (!resposta.ok || !json?.diretorio) {
              setErro(json?.error ?? "Não foi possível salvar.");
              return;
            }

            const salvo = json.diretorio;
            setLinhas((atuais) => [...atuais.filter((l) => l.kind !== preset.id), salvo]);
          }}
        />
      ))}
    </>
  );
}

function FormularioDiretorio({
  preset,
  atual,
  salvando,
  onSalvar,
}: {
  preset: (typeof DIRECTORY_PRESETS)[number];
  atual: LdapDirectoryRow | null;
  salvando: boolean;
  onSalvar(corpo: Record<string, unknown>): Promise<void>;
}) {
  const [grupos, setGrupos] = useState<GroupRoleRow[]>(atual?.groupRoles ?? []);
  const [exigirGrupo, setExigirGrupo] = useState(atual?.requireGroup ?? false);
  const [semSenhaLocal, setSemSenhaLocal] = useState(atual ? !atual.allowPasswordLogin : false);
  const [contaDeServico, setContaDeServico] = useState(atual?.serviceDn ?? "");

  /* Trocar a conta de serviço sem informar a senha nova guardaria a senha
     ANTIGA apontando para a conta NOVA. A rota recusa; a tela avisa antes. */
  const contaMudou = (atual?.serviceDn ?? "") !== contaDeServico.trim();

  return (
    <section className="course-section" aria-labelledby={`d-${preset.id}`}>
      <h2 className="course-section__title" id={`d-${preset.id}`}>
        {preset.label}
        {atual?.enabled ? <span className="sso-adm__ligado">ligado</span> : null}
      </h2>

      <p className="platform__hint">{preset.hint}</p>

      <form
        method="post"
        className="sso-adm__form"
        onSubmit={(evento) => {
          evento.preventDefault();
          const dados = new FormData(evento.currentTarget);

          void onSalvar({
            displayName: String(dados.get("displayName") ?? ""),
            host: String(dados.get("host") ?? ""),
            port: Number(dados.get("port") ?? 636),
            domain: String(dados.get("domain") ?? ""),
            baseDn: String(dados.get("baseDn") ?? ""),
            dnTemplate: String(dados.get("dnTemplate") ?? ""),
            searchBase: String(dados.get("searchBase") ?? ""),
            serviceDn: contaDeServico,
            /* Vazio significa "mantenha a que está lá", e não "apague". */
            servicePassword: String(dados.get("servicePassword") ?? ""),
            serviceDnMudou: contaMudou,
            allowedDomains: String(dados.get("allowedDomains") ?? ""),
            allowSelfSigned: dados.get("allowSelfSigned") === "on",
            allowJit: dados.get("allowJit") === "on",
            jitRole: String(dados.get("jitRole") ?? "learner"),
            syncProfile: dados.get("syncProfile") === "on",
            requireGroup: exigirGrupo,
            enabled: dados.get("enabled") === "on",
            allowPasswordLogin: !semSenhaLocal,
            groupRoles: grupos.filter((g) => g.groupCn.trim()),
          });
        }}
      >
        <label className="field">
          <span>Nome na tela</span>
          <input
            name="displayName"
            defaultValue={atual?.displayName ?? preset.label}
            {...campoObrigatorio("Dê um nome a este diretório.")}
            maxLength={60}
          />
        </label>

        <label className="field">
          <span>Servidor</span>
          <input
            name="host"
            defaultValue={atual?.host ?? ""}
            placeholder="dc01.empresa.local"
            {...campoObrigatorio("Informe o servidor do diretório.")}
          />
        </label>

        <label className="field">
          <span>Porta</span>
          {/* 636 é a porta com TLS. A 389 é em claro, e o bind simples mandaria
              a senha do diretório corporativo legível pela rede. */}
          <input name="port" type="number" defaultValue={atual?.port ?? preset.defaultPort} />
        </label>

        {preset.requires === "domain" ? (
          <label className="field">
            <span>Domínio</span>
            <input
              name="domain"
              defaultValue={atual?.domain ?? ""}
              placeholder="empresa.local"
              {...campoObrigatorio("Informe o domínio da rede.")}
            />
          </label>
        ) : (
          <label className="field">
            <span>Base do diretório</span>
            <input
              name="baseDn"
              defaultValue={atual?.baseDn ?? ""}
              placeholder="dc=empresa,dc=local"
              {...campoObrigatorio("Informe a base de busca do diretório.")}
            />
          </label>
        )}

        {preset.id === "generico" ? (
          <label className="field sso-adm__larga">
            <span>Molde do DN</span>
            <input
              name="dnTemplate"
              defaultValue={atual?.dnTemplate ?? ""}
              placeholder="cn={user},ou=usuarios,dc=empresa,dc=local"
              {...campoObrigatorio("Informe o modelo de DN dos usuários.")}
            />
          </label>
        ) : null}

        <label className="field sso-adm__larga">
          <span>Onde buscar (opcional)</span>
          <input
            name="searchBase"
            defaultValue={atual?.searchBase ?? ""}
            placeholder="deduzido do domínio"
          />
          <small className="platform__hint">
            Em branco, a busca começa na raiz do domínio. Aponte uma unidade organizacional para
            limitá-la.
          </small>
        </label>

        <label className="field sso-adm__larga">
          <span>Conta de serviço (opcional)</span>
          <input
            name="serviceDn"
            value={contaDeServico}
            onChange={(e) => setContaDeServico(e.target.value)}
            placeholder="svc-lms@empresa.local"
          />
          <small className="platform__hint">
            Só é necessária onde o usuário comum não pode ler o diretório. Em branco, a busca usa a
            credencial da própria pessoa, que já se autenticou. Use uma conta de LEITURA, ela não
            precisa poder escrever nada.
          </small>
        </label>

        <label className="field">
          <span>Senha da conta de serviço</span>
          <input
            name="servicePassword"
            type="password"
            autoComplete="new-password"
            placeholder={atual?.temSenhaDeServico ? "guardada, deixe em branco para manter" : ""}
          />
          {contaMudou && contaDeServico.trim() ? (
            <small className="platform__hint" role="alert">
              A conta mudou: informe a senha dela também.
            </small>
          ) : null}
        </label>

        <label className="field sso-adm__larga">
          <span>Domínios de e-mail aceitos (opcional)</span>
          <input
            name="allowedDomains"
            defaultValue={atual?.allowedDomains ?? ""}
            placeholder="empresa.com.br, empresa.com"
          />
        </label>

        <label className="sso-adm__check">
          <input
            type="checkbox"
            name="allowSelfSigned"
            defaultChecked={atual?.allowSelfSigned ?? false}
          />
          <span>Aceitar certificado emitido pela própria empresa</span>
        </label>

        <label className="sso-adm__check">
          <input type="checkbox" name="syncProfile" defaultChecked={atual?.syncProfile ?? true} />
          <span>Trazer nome e área do diretório a cada acesso</span>
        </label>

        <label className="sso-adm__check">
          <input type="checkbox" name="allowJit" defaultChecked={atual?.allowJit ?? false} />
          <span>Criar conta no primeiro acesso de quem ainda não tem</span>
        </label>

        <label className="field sso-adm__papel">
          <span>Papel de quem não está em nenhum grupo mapeado</span>
          <select name="jitRole" defaultValue={atual?.jitRole ?? "learner"}>
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>

        {/* ---------------------------------------------------- grupos → papel */}
        <fieldset className="sso-adm__grupos">
          <legend>Grupos do diretório</legend>

          <p className="platform__hint">
            A cada acesso, o papel da pessoa é recalculado a partir dos grupos dela no diretório.
            Estando em mais de um, vale o maior. <strong>Sair do grupo tira o papel</strong>, e é
            por isso que, com esta lista preenchida, mudar o papel de alguém na tela de usuários
            não dura até o acesso seguinte.
          </p>

          {grupos.map((grupo, indice) => (
            <div className="sso-adm__grupo" key={indice}>
              <input
                aria-label="Nome do grupo no diretório"
                value={grupo.groupCn}
                placeholder="LMS_Admin"
                onChange={(e) =>
                  setGrupos((atuais) =>
                    atuais.map((g, i) => (i === indice ? { ...g, groupCn: e.target.value } : g)),
                  )
                }
              />
              <select
                aria-label="Papel"
                value={grupo.role}
                onChange={(e) =>
                  setGrupos((atuais) =>
                    atuais.map((g, i) =>
                      i === indice ? { ...g, role: e.target.value as Role } : g,
                    ),
                  )
                }
              >
                {PAPEIS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remover ${grupo.groupCn || "grupo"}`}
                onClick={() => setGrupos((atuais) => atuais.filter((_, i) => i !== indice))}
              >
                <Trash2 aria-hidden />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setGrupos((atuais) => [...atuais, { groupCn: "", role: "learner" }])}
          >
            <Plus aria-hidden /> Adicionar grupo
          </button>
        </fieldset>

        <label className="sso-adm__check">
          <input
            type="checkbox"
            checked={exigirGrupo}
            onChange={(e) => setExigirGrupo(e.target.checked)}
          />
          <span>Só entra quem está em um dos grupos acima</span>
        </label>

        <label className="sso-adm__check">
          <input
            type="checkbox"
            checked={semSenhaLocal}
            onChange={(e) => setSemSenhaLocal(e.target.checked)}
          />
          <span>Desligar a senha guardada nesta plataforma</span>
        </label>

        {semSenhaLocal ? (
          <p className="platform__hint" role="alert">
            Com isto marcado, o diretório passa a ser a única forma de entrar, inclusive para
            você. Se ele ficar fora do ar, ninguém entra nesta tela para desmarcar. A opção só
            vale enquanto o diretório abaixo estiver ligado.
          </p>
        ) : null}

        <label className="sso-adm__check">
          <input type="checkbox" name="enabled" defaultChecked={atual?.enabled ?? false} />
          <span>Ligado</span>
        </label>

        <button className="btn btn--primary" type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </section>
  );
}
