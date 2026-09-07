"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { NOTIFICATION_CATALOG } from "@nerdlms/core/notifications/events.ts";

/**
 * Templates de e-mail por cliente — F4-05.
 *
 * O guia §2 pede isto junto do branding, e a razão é a mesma: o e-mail é a
 * parte do produto que chega FORA dele, e mandar uma mensagem com a voz errada
 * é pior que não mandar.
 *
 * Sem template salvo, vale o texto padrão do produto. É a mesma regra das
 * features e do branding: a tabela guarda só o que o cliente mudou.
 */

export interface SavedTemplate {
  kind: string;
  subject: string;
  body: string;
}

/** As variáveis que o produto oferece, com o que cada uma vira. */
const VARIAVEIS = [
  { chave: "primeiroNome", exemplo: "Maria" },
  { chave: "nome", exemplo: "Maria Souza" },
  { chave: "curso", exemplo: "NR-10 Básico" },
  { chave: "titulo", exemplo: "Sua nota saiu" },
];

export function EmailTemplates({ saved }: { saved: SavedTemplate[] }) {
  const porTipo = new Map(saved.map((t) => [t.kind, t]));

  const [editando, setEditando] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function salvar(event: React.FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setNotice(null);

    try {
      const resposta = await fetch("/api/preferencias", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          subject: form.get("subject"),
          template: form.get("template"),
        }),
      });

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
        setNotice(erro.error ?? "Não foi possível salvar o texto.");
        return;
      }

      setNotice("Texto salvo. Os próximos e-mails deste tipo usam ele.");
      setEditando(null);
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  /* Só os eventos que mandam e-mail por padrão: oferecer template para um
     aviso que nunca vira e-mail seria trabalho sem efeito. */
  const comEmail = NOTIFICATION_CATALOG.filter((e) => e.defaultEmail);

  return (
    <section className="course-section" aria-labelledby="templates">
      <h2 className="course-section__title" id="templates">
        <Mail aria-hidden /> Textos dos e-mails
      </h2>

      <p className="platform__hint">
        Sem texto próprio, vale o padrão da plataforma. Use{" "}
        {VARIAVEIS.map((v) => `{{${v.chave}}}`).join(", ")} para inserir os dados de cada envio.
      </p>

      <ul className="templates">
        {comEmail.map((evento) => {
          const atual = porTipo.get(evento.kind);
          const aberto = editando === evento.kind;

          return (
            <li className="templates__item" key={evento.kind}>
              <div className="templates__head">
                <div>
                  <strong>{evento.label}</strong>
                  <span className="prefs__desc">
                    {atual ? "Texto personalizado" : "Usando o texto padrão"}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setEditando(aberto ? null : evento.kind)}
                >
                  {aberto ? "Cancelar" : atual ? "Editar" : "Personalizar"}
                </button>
              </div>

              {aberto ? (
                <form className="templates__form" onSubmit={(event) => salvar(event, evento.kind)}>
                  <div className="field">
                    <label className="label" htmlFor={`s-${evento.kind}`}>
                      Assunto
                    </label>
                    <input
                      className="input"
                      id={`s-${evento.kind}`}
                      name="subject"
                      required
                      defaultValue={atual?.subject ?? ""}
                      placeholder="{{primeiroNome}}, sua nota em {{curso}} saiu"
                    />
                  </div>

                  <div className="field">
                    <label className="label" htmlFor={`b-${evento.kind}`}>
                      Mensagem
                    </label>
                    <textarea
                      className="input forum__textarea"
                      id={`b-${evento.kind}`}
                      name="template"
                      rows={5}
                      required
                      defaultValue={atual?.body ?? ""}
                    />
                    <p className="field__hint">
                      Texto simples. O visual do e-mail — logo, cores — vem da identidade da
                      plataforma.
                    </p>
                  </div>

                  <button type="submit" className="btn btn--primary" disabled={busy}>
                    {busy ? "Salvando" : "Salvar texto"}
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="status-text" role="status">
        {notice}
      </p>
    </section>
  );
}
