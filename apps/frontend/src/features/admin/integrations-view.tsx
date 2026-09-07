"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Plug, Trash2, Webhook } from "lucide-react";

import { API_SCOPES } from "@nerdlms/core/api/keys.ts";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL } from "@nerdlms/core/api/webhook-events.ts";

import "./integrations.css";
import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

/**
 * Integrações — F5-01 e F5-02.
 *
 * Duas coisas na mesma tela porque respondem à mesma pergunta: **como outro
 * sistema conversa com este?** A chave é o de fora perguntando; o webhook é
 * este avisando.
 *
 * O ponto delicado da tela é o SEGREDO. Chave e segredo aparecem uma única vez,
 * no instante da criação — depois só existe o hash (chave) ou o uso interno
 * (segredo). A tela precisa deixar isso explícito ANTES de a pessoa sair dela,
 * porque não há segunda chance.
 */

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export interface HookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastStatus?: number;
  lastError?: string;
  deliveries: number;
}

/** Um segredo recém-criado, enquanto a pessoa ainda não o copiou. */
interface Revelado {
  tipo: "chave" | "segredo";
  valor: string;
}

/* `timeZone` obrigatório: sem ele o servidor formata em UTC e o navegador no
   fuso local, o texto difere, e a hidratação quebra — a página inteira para de
   responder a clique. Ver o comentário em `profile/profile-badges.tsx`. */
function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function IntegrationsView({
  keys: chavesIniciais,
  hooks: hooksIniciais,
}: {
  keys: KeyRow[];
  hooks: HookRow[];
}) {
  const [chaves, setChaves] = useState(chavesIniciais);
  const [hooks, setHooks] = useState(hooksIniciais);
  const [revelado, setRevelado] = useState<Revelado | null>(null);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const caixaSegredo = useRef<HTMLElement | null>(null);

  /* Leva o segredo para a vista.

     Os formulários ficam LONGE do topo — depois de criar, a página continua
     rolada onde estava e a caixa nasce fora da tela. Como o valor não aparece
     de novo, não vê-lo é perdê-lo: rolar até ele é parte de revelá-lo.

     `useEffect` e não uma chamada dentro do `criar*`: o elemento só existe
     depois que o React o desenha. */
  useEffect(() => {
    if (!revelado) return;

    caixaSegredo.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    /* O foco vai junto: quem navega por teclado ou leitor de tela precisa
       chegar ao valor e ao botão de copiar sem procurar. */
    caixaSegredo.current?.focus();
  }, [revelado]);

  async function criarChave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);

    const scopes = API_SCOPES.map((s) => s.key).filter((k) => dados.get(`escopo-${k}`) === "on");

    if (scopes.length === 0) {
      setAviso("Escolha ao menos um escopo: uma chave sem escopo não faz nada.");
      return;
    }

    setBusy(true);
    setAviso(null);

    try {
      const resposta = await fetch("/api/integracoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: dados.get("name"), scopes }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as {
        id?: string;
        key?: string;
        prefix?: string;
        error?: string;
      };

      if (!resposta.ok || !corpo.key) {
        setAviso(corpo.error ?? "Não foi possível criar a chave.");
        return;
      }

      setRevelado({ tipo: "chave", valor: corpo.key });
      setCopiado(false);
      setChaves((atual) => [
        {
          id: corpo.id!,
          name: String(dados.get("name") ?? ""),
          prefix: corpo.prefix!,
          scopes,
          createdAt: new Date().toISOString(),
          revoked: false,
        },
        ...atual,
      ]);
      form.reset();
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function criarHook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);

    const events = WEBHOOK_EVENTS.filter((e) => dados.get(`evento-${e}`) === "on");

    setBusy(true);
    setAviso(null);

    try {
      const resposta = await fetch("/api/integracoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: dados.get("url"), events }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as {
        id?: string;
        secret?: string;
        error?: string;
      };

      if (!resposta.ok || !corpo.secret) {
        setAviso(corpo.error ?? "Não foi possível criar o webhook.");
        return;
      }

      setRevelado({ tipo: "segredo", valor: corpo.secret });
      setCopiado(false);
      setHooks((atual) => [
        {
          id: corpo.id!,
          url: String(dados.get("url") ?? ""),
          events: [...events],
          active: true,
          createdAt: new Date().toISOString(),
          deliveries: 0,
        },
        ...atual,
      ]);
      form.reset();
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function revogarChave(id: string, nome: string) {
    if (!confirm(`Revogar a chave "${nome}"? Quem estiver usando ela para de funcionar agora.`)) {
      return;
    }

    const resposta = await fetch("/api/integracoes", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyId: id }),
    });

    if (resposta.ok) {
      /* Revogada continua na lista, marcada: o histórico de uso dela ainda
         responde "o que essa chave fez enquanto valia". */
      setChaves((atual) => atual.map((c) => (c.id === id ? { ...c, revoked: true } : c)));
      setAviso(`Chave "${nome}" revogada.`);
    } else {
      setAviso("Não foi possível revogar a chave.");
    }
  }

  async function removerHook(id: string, url: string) {
    if (!confirm(`Remover o webhook para ${url}?`)) return;

    const resposta = await fetch("/api/integracoes", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ webhookId: id }),
    });

    if (resposta.ok) {
      setHooks((atual) => atual.filter((h) => h.id !== id));
      setAviso("Webhook removido.");
    } else {
      setAviso("Não foi possível remover o webhook.");
    }
  }

  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
    } catch {
      /* Sem permissão de área de transferência: o valor está visível na tela e
         pode ser copiado à mão. Não é erro que mereça alarme. */
      setCopiado(false);
    }
  }

  return (
    <>
      <section className="course-section" aria-labelledby="integracoes">
        <h2 className="course-section__title" id="integracoes">
          <Plug aria-hidden /> Integrações
        </h2>

        <p className="platform__hint">
          Chaves deixam outro sistema <strong>consultar</strong> esta plataforma. Webhooks fazem
          esta plataforma <strong>avisar</strong> outro sistema quando algo acontece.
        </p>
      </section>

      {/* O segredo revelado fica FORA das listas e no topo: é a única coisa da
          tela que se perde se a pessoa não agir agora. */}
      {revelado ? (
        <section
          className="revelado"
          aria-labelledby="revelado-titulo"
          role="alert"
          ref={caixaSegredo}
          /* -1: focável por código, mas fora da ordem do Tab — quem navega por
             teclado não deve tropeçar num aviso já lido. */
          tabIndex={-1}
        >
          <h3 className="revelado__titulo" id="revelado-titulo">
            {revelado.tipo === "chave" ? "Sua chave de API" : "O segredo deste webhook"}
          </h3>

          <p className="revelado__aviso">
            Copie agora. Este valor <strong>não aparece de novo</strong>, a plataforma guarda
            {revelado.tipo === "chave"
              ? " apenas um resumo criptográfico dele."
              : " ele apenas para assinar os envios."}
          </p>

          <div className="revelado__linha">
            <code className="revelado__valor">{revelado.valor}</code>

            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => copiar(revelado.valor)}
            >
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>

          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setRevelado(null)}
          >
            Já copiei, pode esconder
          </button>
        </section>
      ) : null}

      <section className="course-section" aria-labelledby="chaves">
        <h2 className="course-section__title" id="chaves">
          <KeyRound aria-hidden /> Chaves de API
        </h2>

        <form className="platform__form" onSubmit={criarChave}>
          <div className="field">
            <label className="label" htmlFor="nome-chave">
              Nome da chave
            </label>
            <input
              className="input"
              id="nome-chave"
              name="name"
              {...campoObrigatorio("Dê um nome para identificar esta chave.")}
              maxLength={80}
              placeholder="Integração com o RH"
            />
            <p className="field__hint">
              Um nome que diga quem usa. É por ele que se sabe o que revogar depois.
            </p>
          </div>

          <fieldset className="escopos">
            <legend className="label">O que esta chave pode fazer</legend>

            {API_SCOPES.map((escopo) => (
              <label className="escopos__item" key={escopo.key}>
                <input type="checkbox" name={`escopo-${escopo.key}`} />
                <span className="escopos__texto">
                  <strong>{escopo.label}</strong>
                  <span className="prefs__desc">{escopo.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Criando" : "Criar chave"}
          </button>
        </form>

        {chaves.length === 0 ? (
          <p className="platform__hint">Nenhuma chave criada.</p>
        ) : (
          <ul className="templates">
            {chaves.map((chave) => (
              <li className="templates__item" key={chave.id}>
                <div className="templates__head">
                  <div className="integracao__dados">
                    <strong>{chave.name}</strong>
                    <span className="prefs__desc">
                      <code>{chave.prefix}…</code> · criada em {dataCurta(chave.createdAt)} ·{" "}
                      {chave.lastUsedAt
                        ? `último uso em ${dataCurta(chave.lastUsedAt)}`
                        : "nunca usada"}
                    </span>
                    <span className="prefs__desc">{chave.scopes.join(", ")}</span>
                  </div>

                  {chave.revoked ? (
                    <span className="platform__badge">Revogada</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => revogarChave(chave.id, chave.name)}
                    >
                      <Trash2 aria-hidden /> Revogar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="course-section" aria-labelledby="webhooks">
        <h2 className="course-section__title" id="webhooks">
          <Webhook aria-hidden /> Webhooks
        </h2>

        <form className="platform__form" onSubmit={criarHook}>
          <div className="field">
            <label className="label" htmlFor="url-hook">
              Endereço que vai receber
            </label>
            <input
              className="input"
              id="url-hook"
              name="url"
              type="url"
              {...campoObrigatorio("Informe o endereço que vai receber os eventos.")}
              pattern="https://.*"
              placeholder="https://sistema.exemplo.com.br/nerdlms"
            />
            <p className="field__hint">
              Só <code>https://</code>: o envio carrega dado de aluno, e em HTTP ele viajaria
              aberto.
            </p>
          </div>

          <fieldset className="escopos">
            <legend className="label">Quando avisar</legend>
            <p className="field__hint">Sem nenhum marcado, avisa em todos os eventos.</p>

            {WEBHOOK_EVENTS.map((evento) => (
              <label className="escopos__item" key={evento}>
                <input type="checkbox" name={`evento-${evento}`} />
                <span className="escopos__texto">
                  <strong>{WEBHOOK_EVENT_LABEL[evento]}</strong>
                  <span className="prefs__desc">
                    <code>{evento}</code>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Criando" : "Criar webhook"}
          </button>
        </form>

        {hooks.length === 0 ? (
          <p className="platform__hint">Nenhum webhook cadastrado.</p>
        ) : (
          <ul className="templates">
            {hooks.map((hook) => (
              <li className="templates__item" key={hook.id}>
                <div className="templates__head">
                  <div className="integracao__dados">
                    <strong className="hook__url">{hook.url}</strong>
                    <span className="prefs__desc">
                      {hook.events.length === 0 ? "todos os eventos" : hook.events.join(", ")}
                    </span>
                    <span className="prefs__desc">
                      {hook.deliveries === 0
                        ? "nenhum envio ainda"
                        : `${hook.deliveries} ${hook.deliveries === 1 ? "envio" : "envios"}`}
                      {hook.lastStatus ? ` · última resposta ${hook.lastStatus}` : ""}
                      {hook.lastError ? ` · última falha: ${hook.lastError}` : ""}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => removerHook(hook.id, hook.url)}
                  >
                    <Trash2 aria-hidden /> Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="status-text" role="status">
        {aviso}
      </p>
    </>
  );
}
