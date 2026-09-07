"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";

import { NOTIFICATION_CATALOG, type Channels } from "@nerdlms/core/notifications/events.ts";

/**
 * Preferências de notificação — F4-04.
 *
 * O guia §15 pede "preferências individuais". A tabela guarda só o que a pessoa
 * MUDOU: o padrão vive no catálogo, e uma linha por pessoa por evento seria a
 * maior tabela do banco guardando, quase toda, o valor padrão.
 *
 * Os dois canais são independentes de propósito — receber in-app e não por
 * e-mail é a escolha mais comum de quem já vive dentro do sistema.
 */
export function NotificationPrefs({ saved }: { saved: Record<string, Channels> }) {
  /* Estado otimista: o interruptor precisa reagir na hora. Sem isto o React
     reverte a marcação até o servidor responder, e parece que o clique não
     pegou — o mesmo defeito que a tela de plataforma teve no F0-12. */
  const [pendente, setPendente] = useState<Record<string, Channels>>({});
  const [notice, setNotice] = useState<string | null>(null);

  function canaisDe(kind: string, padrao: Channels): Channels {
    return pendente[kind] ?? saved[kind] ?? padrao;
  }

  async function salvar(kind: string, canais: Channels) {
    setPendente((atual) => ({ ...atual, [kind]: canais }));
    setNotice(null);

    try {
      const resposta = await fetch("/api/preferencias", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, inApp: canais.inApp, email: canais.email }),
      });

      if (!resposta.ok) {
        setPendente((atual) => {
          const copia = { ...atual };
          delete copia[kind];
          return copia;
        });
        setNotice("Não foi possível salvar a preferência.");
        return;
      }

      setNotice("Preferência salva.");
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    }
  }

  return (
    <section className="course-section" aria-labelledby="notificacoes">
      <h2 className="course-section__title" id="notificacoes">
        <Bell aria-hidden /> Notificações
      </h2>

      <p className="platform__hint">
        Escolha como quer ser avisado de cada coisa. Desligar os dois canais silencia o aviso.
      </p>

      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Preferências de notificação por evento</caption>
          <thead>
            <tr>
              <th scope="col">Aviso</th>
              <th scope="col" className="prefs__col">
                Na plataforma
              </th>
              <th scope="col" className="prefs__col">
                Por e-mail
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_CATALOG.map((evento) => {
              const canais = canaisDe(evento.kind, {
                inApp: evento.defaultInApp,
                email: evento.defaultEmail,
              });

              return (
                <tr key={evento.kind}>
                  <td data-label="Aviso" className="prefs__nome">
                    <strong>{evento.label}</strong>
                    <span className="prefs__desc">{evento.description}</span>
                  </td>

                  {/* O checkbox do produto, e não o do navegador. A caixa é um
                      `<span>` desenhado; o `<input>` real fica invisível por
                      cima, o que preserva teclado, foco e leitor de tela. Sem
                      isso a tela misturava o azul do sistema operacional com a
                      marca, e cada navegador desenhava um formato. */}
                  <td className="prefs__col" data-label="Na plataforma">
                    <label className="checkbox">
                      <input
                        id={`in-${evento.kind}`}
                        type="checkbox"
                        checked={canais.inApp}
                        onChange={(event) =>
                          void salvar(evento.kind, { ...canais, inApp: event.target.checked })
                        }
                      />
                      <span className="checkbox__box" aria-hidden="true">
                        <Check />
                      </span>
                      <span className="sr-only">{evento.label} na plataforma</span>
                    </label>
                  </td>

                  <td className="prefs__col" data-label="Por e-mail">
                    <label className="checkbox">
                      <input
                        id={`em-${evento.kind}`}
                        type="checkbox"
                        checked={canais.email}
                        onChange={(event) =>
                          void salvar(evento.kind, { ...canais, email: event.target.checked })
                        }
                      />
                      <span className="checkbox__box" aria-hidden="true">
                        <Check />
                      </span>
                      <span className="sr-only">{evento.label} por e-mail</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="status-text" role="status">
        {notice}
      </p>
    </section>
  );
}
