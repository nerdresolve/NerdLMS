"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, BellOff, Lock, MessageSquare, Pin, Plus } from "lucide-react";

import type { ForumTopic } from "@nerdlms/backend/forum/forum-repository.ts";

import "./forum.css";

/**
 * Fórum do curso — F4-01.
 *
 * Lista ordenada por fixado e depois por atividade: um tópico de março com
 * resposta hoje importa mais que um de ontem sem nenhuma.
 */
export function ForumView({
  courseId,
  courseTitle,
  topics,
  canModerate,
}: {
  courseId: string;
  courseTitle: string;
  topics: ForumTopic[];
  canModerate: boolean;
}) {
  const router = useRouter();

  const [abrindo, setAbrindo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function criar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setNotice(null);

    try {
      const resposta = await fetch("/api/forum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: form.get("title"),
          body: form.get("body"),
        }),
      });

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
        setNotice(erro.error ?? "Não foi possível criar o tópico.");
        return;
      }

      setAbrindo(false);
      router.refresh();
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function moderar(topicId: string, campo: "pinned" | "closed", valor: boolean) {
    await fetch("/api/forum", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId, [campo]: valor }),
    }).catch(() => setNotice("Não foi possível salvar."));

    router.refresh();
  }

  return (
    <div className="forum">
      <div className="page-head">
        <h1 className="page-head__greeting">Fórum</h1>
        <p className="page-head__sub">
          Dúvidas e discussões de {courseTitle}. {topics.length}{" "}
          {topics.length === 1 ? "tópico" : "tópicos"}.
        </p>
      </div>

      {abrindo ? (
        <form className="forum__form course-section" onSubmit={criar}>
          <div className="field">
            <label className="label" htmlFor="topico-titulo">
              Assunto
            </label>
            <input
              className="input"
              id="topico-titulo"
              name="title"
              required
              placeholder="Dúvida sobre a questão 3 da prova"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="topico-corpo">
              Mensagem
            </label>
            <textarea
              className="input forum__textarea"
              id="topico-corpo"
              name="body"
              rows={5}
              required
            />
            <p className="field__hint">
              Use @nome para mencionar alguém — a pessoa recebe um aviso.
            </p>
          </div>

          <div className="forum__form-actions">
            <button type="button" className="btn btn--secondary" onClick={() => setAbrindo(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Publicando" : "Publicar tópico"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn--primary forum__new" onClick={() => setAbrindo(true)}>
          <Plus aria-hidden /> Novo tópico
        </button>
      )}

      {topics.length > 0 ? (
        <ul className="forum__list">
          {topics.map((topico) => (
            <li className="forum-topic" key={topico.id} data-fixado={topico.pinned || undefined}>
              <div className="forum-topic__main">
                <p className="forum-topic__meta">
                  {topico.pinned ? (
                    <span className="badge">
                      <Pin aria-hidden /> Fixado
                    </span>
                  ) : null}
                  {topico.closed ? (
                    <span className="badge badge--neutral">
                      <Lock aria-hidden /> Fechado
                    </span>
                  ) : null}
                  {topico.subscribed ? (
                    <span className="badge badge--neutral">
                      <Bell aria-hidden /> Acompanhando
                    </span>
                  ) : null}
                </p>

                <h2 className="forum-topic__title">
                  <Link href={`/forum/${topico.id}`}>{topico.title}</Link>
                </h2>

                <p className="forum-topic__author">
                  {topico.authorName} · {topico.replyCount}{" "}
                  {topico.replyCount === 1 ? "resposta" : "respostas"}
                </p>
              </div>

              {canModerate ? (
                <div className="forum-topic__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void moderar(topico.id, "pinned", !topico.pinned)}
                  >
                    {topico.pinned ? "Desafixar" : "Fixar"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void moderar(topico.id, "closed", !topico.closed)}
                  >
                    {topico.closed ? "Reabrir" : "Fechar"}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <div className="empty__inner">
            <span className="empty__icon">
              <MessageSquare aria-hidden />
            </span>
            <h3 className="empty__title">Nenhum tópico ainda</h3>
            <p className="empty__text">
              Abra o primeiro: perguntas respondidas aqui ajudam quem chegar depois.
            </p>
          </div>
        </div>
      )}

      <p className="status-text" role="status">
        {notice}
      </p>
    </div>
  );
}

/** O botão de acompanhar, usado na página do tópico. */
export function SubscribeButton({
  topicId,
  subscribed,
}: {
  topicId: string;
  subscribed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function alternar() {
    setBusy(true);

    await fetch("/api/forum", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId, subscribe: !subscribed }),
    }).catch(() => {
      /* Melhor-esforço: o estado real vem do refresh. */
    });

    setBusy(false);
    router.refresh();
  }

  return (
    <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={alternar}>
      {subscribed ? <BellOff aria-hidden /> : <Bell aria-hidden />}
      {subscribed ? "Parar de acompanhar" : "Acompanhar"}
    </button>
  );
}
