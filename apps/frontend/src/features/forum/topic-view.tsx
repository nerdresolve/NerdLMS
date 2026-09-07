"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Flag, Lock, Send } from "lucide-react";

import type { ForumPost, ForumTopic } from "@nerdlms/backend/forum/forum-repository.ts";

import { SubscribeButton } from "./forum-view.tsx";

import "./forum.css";

/**
 * Um tópico e suas respostas — F4-01 e F4-02.
 *
 * As respostas são achatadas em DOIS níveis: resposta ao tópico e resposta a
 * uma resposta. Mais que isso vira uma escada que não se lê em tela estreita, e
 * a conversa de fórum raramente precisa de mais.
 */
export function TopicView({
  topic,
  posts,
  canModerate,
  viewerId,
}: {
  topic: ForumTopic;
  posts: ForumPost[];
  canModerate: boolean;
  viewerId: string;
}) {
  const router = useRouter();

  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const raizes = posts.filter((p) => !p.parentId);
  const filhas = (id: string) => posts.filter((p) => p.parentId === id);

  async function responder(event: React.FormEvent<HTMLFormElement>, parentId?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const corpo = (form.elements.namedItem("body") as HTMLTextAreaElement | null)?.value ?? "";

    if (corpo.trim() === "") return;

    setBusy(true);
    setNotice(null);

    try {
      const resposta = await fetch("/api/forum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topicId: topic.id,
          body: corpo,
          ...(parentId ? { parentId } : {}),
        }),
      });

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
        setNotice(erro.error ?? "Não foi possível responder.");
        return;
      }

      form.reset();
      setRespondendo(null);
      router.refresh();
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function acao(payload: Record<string, unknown>, aviso: string) {
    await fetch("/api/forum", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => setNotice("Não foi possível salvar."));

    setNotice(aviso);
    router.refresh();
  }

  function Mensagem({ post, aninhada }: { post: ForumPost; aninhada: boolean }) {
    return (
      <article className="forum-post" data-oculta={post.hidden || undefined} data-aninhada={aninhada || undefined}>
        <p className="forum-post__meta">
          <strong>{post.authorName}</strong>
          {post.editedAt ? <span className="forum-post__edited"> · editada</span> : null}
          {post.hidden ? (
            <span className="badge badge--neutral">
              <EyeOff aria-hidden /> Oculta
              {post.hiddenReason ? `: ${post.hiddenReason}` : ""}
            </span>
          ) : null}
          {canModerate && post.reportCount > 0 ? (
            <span className="badge badge--warning">
              <Flag aria-hidden /> {post.reportCount}
            </span>
          ) : null}
        </p>

        <p className="forum-post__body">{post.body}</p>

        <p className="forum-post__actions">
          {!topic.closed && !aninhada ? (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setRespondendo(respondendo === post.id ? null : post.id)}
            >
              Responder
            </button>
          ) : null}

          {/* Denunciar é de qualquer participante, menos do próprio autor:
              denunciar a si mesmo não faz sentido e sujaria a fila. */}
          {post.authorId !== viewerId ? (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                const motivo = window.prompt("Por que esta mensagem deve ser revista?");
                if (motivo?.trim()) {
                  void acao({ postId: post.id, report: motivo }, "Denúncia registrada.");
                }
              }}
            >
              <Flag aria-hidden /> Denunciar
            </button>
          ) : null}

          {canModerate ? (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() =>
                void acao(
                  { postId: post.id, hide: !post.hidden, reason: post.hidden ? null : "Conteúdo impróprio" },
                  post.hidden ? "Mensagem revelada." : "Mensagem ocultada.",
                )
              }
            >
              <EyeOff aria-hidden /> {post.hidden ? "Revelar" : "Ocultar"}
            </button>
          ) : null}
        </p>

        {respondendo === post.id ? (
          <form className="forum__reply" onSubmit={(event) => responder(event, post.id)}>
            <label className="sr-only" htmlFor={`r-${post.id}`}>
              Sua resposta
            </label>
            <textarea className="input forum__textarea" id={`r-${post.id}`} name="body" rows={3} />
            <button type="submit" className="btn btn--primary btn--small" disabled={busy}>
              <Send aria-hidden /> Responder
            </button>
          </form>
        ) : null}
      </article>
    );
  }

  return (
    <div className="forum">
      <div className="forum__head">
        <div>
          <h1 className="page-head__title">{topic.title}</h1>
          <p className="page-head__sub">
            {topic.authorName}
            {topic.closed ? " · tópico fechado" : ""}
          </p>
        </div>

        <SubscribeButton topicId={topic.id} subscribed={topic.subscribed} />
      </div>

      <article className="forum-post forum-post--opening">
        <p className="forum-post__body">{topic.body}</p>
      </article>

      {raizes.map((post) => (
        <div key={post.id}>
          <Mensagem post={post} aninhada={false} />
          {filhas(post.id).map((filha) => (
            <Mensagem key={filha.id} post={filha} aninhada />
          ))}
        </div>
      ))}

      {topic.closed ? (
        <p className="forum__closed">
          <Lock aria-hidden /> Este tópico foi fechado. A conversa continua visível.
        </p>
      ) : (
        <form className="forum__reply course-section" onSubmit={(event) => responder(event)}>
          <label className="label" htmlFor="nova-resposta">
            Responder ao tópico
          </label>
          <textarea className="input forum__textarea" id="nova-resposta" name="body" rows={4} />
          <p className="field__hint">Use @nome para mencionar alguém.</p>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            <Send aria-hidden /> {busy ? "Enviando" : "Responder"}
          </button>
        </form>
      )}

      <p className="status-text" role="status">
        {notice}
      </p>
    </div>
  );
}
