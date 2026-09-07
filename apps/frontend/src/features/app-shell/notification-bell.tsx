"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Award, Bell, Megaphone } from "lucide-react";

import type { Notification } from "@nerdlms/core/courses/calendar.ts";

const ICON = {
  announcement: Megaphone,
  reminder: Bell,
  achievement: Award,
} as const;

/**
 * Sino de avisos.
 *
 * Antes era um link para a agenda: não dizia quantos avisos havia nem do que
 * tratavam, então não havia motivo para olhar. Agora mostra a contagem de não
 * lidos e abre os recentes ali mesmo.
 *
 * Os dados são buscados na primeira abertura, não na montagem: o sino aparece
 * em toda página, e carregar avisos que ninguém pediu seria uma requisição por
 * navegação. A contagem, essa sim, vem sempre — é o que justifica o sino.
 */
export function NotificationBell() {
  const router = useRouter();
  const painelId = useId();

  const [aberto, setAberto] = useState(false);
  const [hits, setHits] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [carregado, setCarregado] = useState(false);

  async function carregar() {
    try {
      const response = await fetch("/api/avisos/lista");
      if (!response.ok) return;

      const corpo = (await response.json()) as { hits: Notification[]; unread: number };
      setHits(corpo.hits);
      setUnread(corpo.unread);
      setCarregado(true);
    } catch {
      /* Sem avisos na tela é melhor que um erro por algo secundário. */
    }
  }

  /* A contagem sozinha, ao montar. É barata e é o que dá sentido ao ícone. */
  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    if (!aberto) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto]);

  async function marcarLido(id: string) {
    /* Otimista: o selo cai na hora e volta se o servidor recusar. Esperar a
       resposta para riscar o aviso faz o clique parecer ignorado. */
    setHits((atual) => atual.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setUnread((atual) => Math.max(0, atual - 1));

    try {
      const response = await fetch("/api/avisos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (!response.ok) {
        void carregar();
        return;
      }
      /* A agenda mostra a mesma lista; se estiver aberta, precisa acompanhar. */
      router.refresh();
    } catch {
      void carregar();
    }
  }

  return (
    <div className="bell">
      <button
        type="button"
        className="icon-button topbar__notifications"
        aria-label={unread > 0 ? `Avisos, ${unread} não ${unread === 1 ? "lido" : "lidos"}` : "Avisos"}
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => {
          setAberto((atual) => !atual);
          if (!carregado) void carregar();
        }}
      >
        <Bell aria-hidden />
        {unread > 0 ? (
          <span className="bell__count" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <>
          {/* Captura o clique fora sem escurecer a tela: o painel é pequeno e
              um véu cheio seria pesado demais para uma lista de avisos. */}
          <div className="bell__catcher" role="presentation" onClick={() => setAberto(false)} />

          <div className="bell__panel" id={painelId} role="dialog" aria-label="Avisos">
            <div className="bell__head">
              <strong>Avisos</strong>
              <Link className="bell__all" href="/agenda" onClick={() => setAberto(false)}>
                Ver na agenda
              </Link>
            </div>

            {hits.length === 0 ? (
              <p className="bell__empty">{carregado ? "Nenhum aviso." : "Carregando"}</p>
            ) : (
              <ul className="bell__list">
                {hits.map((item) => {
                  const Icon = ICON[item.kind];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="bell__item"
                        data-read={item.read}
                        onClick={() => marcarLido(item.id)}
                        /* Já lido não tem o que fazer ao clicar; desabilitar
                           evita uma requisição que o servidor ignoraria. */
                        disabled={item.read}
                      >
                        <span className="bell__icon" aria-hidden="true">
                          <Icon />
                        </span>
                        <span className="bell__body">
                          <span className="bell__title">{item.title}</span>
                          <span className="bell__text">{item.body}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
