"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Pencil, Send, Trash2 } from "lucide-react";

import type { Comment } from "@nerdlms/core/courses/types.ts";

import { useFeature } from "@/features/tenant/feature-context.tsx";

import { VoteButton } from "./vote-button.tsx";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("");
}

/** "há 2 dias", "ontem" — data absoluta não ajuda numa discussão de aula. */
function relativeTime(iso: string, now: number): string {
  const diff = (now - new Date(iso).getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return format.format(-Math.round(diff / seconds), unit);
  }
  return "agora";
}

function CommentItem({
  comment,
  replies,
  now,
  respondendoA,
  onResponder,
  podeExcluir,
  onExcluir,
  podeEditar,
  editandoId,
  onEditar,
  formEdicao,
  formResposta,
}: {
  comment: Comment;
  replies: Map<string, Comment[]>;
  now: number;
  /** Id do comentário cuja caixa de resposta está aberta, se alguma. */
  respondendoA: string | null;
  onResponder: (id: string | null) => void;
  /** Decide, por comentário, se quem lê pode removê-lo. Passada como função
      porque as respostas aninhadas precisam da mesma regra. */
  podeExcluir: (comment: Comment) => boolean;
  onExcluir: (id: string) => void;
  /** Só o autor edita. Igual à regra do servidor. */
  podeEditar: (comment: Comment) => boolean;
  /** Id em edição, se algum. */
  editandoId: string | null;
  onEditar: (comment: Comment) => void;
  /** A caixa de edição, montada por quem envia. */
  formEdicao: React.ReactNode;
  /** A caixa em si, montada pelo componente de cima, que é quem envia. */
  formResposta: React.ReactNode;
}) {
  const children = replies.get(comment.id) ?? [];
  const aberta = respondendoA === comment.id;
  const emEdicao = editandoId === comment.id;

  /* Cada ação tem chave própria: há cliente que quer conversa sem marcador de
     útil, e cliente que quer comentário sem resposta encadeada. */
  const podeVotar = useFeature("comentarios.upvotes");
  const podeResponder = useFeature("comentarios.respostas");

  return (
    <article className={`comment${comment.highlighted ? " comment--highlighted" : ""}`}>
      <span className="avatar avatar--sm" aria-hidden="true">
        {initialsOf(comment.authorName)}
      </span>

      <div className="comment__body">
        <div className="comment__head">
          <span className="comment__author">{comment.authorName}</span>
          {/* A tag é derivada no servidor (PRD §8); aqui só é exibida. */}
          {comment.highlighted ? (
            <span className="badge">
              <GraduationCap aria-hidden /> Professor
            </span>
          ) : null}
          <time className="comment__time" dateTime={comment.createdAt}>
            {relativeTime(comment.createdAt, now)}
          </time>
        </div>

        {emEdicao ? (
          formEdicao
        ) : (
          <p className="comment__text">
            {comment.body}
            {/* Quem responde a um comentário merece saber que o texto mudou
                depois. Sem esta marca, alguém poderia reescrever o que disse
                e deixar a resposta alheia sem sentido. */}
            {comment.editedAt ? <span className="comment__edited"> (editado)</span> : null}
          </p>
        )}

        <div className="comment__actions">
          {podeVotar ? (
            <VoteButton
              commentId={comment.id}
              upvotes={comment.upvotes}
              voted={comment.votedByViewer}
            />
          ) : null}
          {podeResponder ? (
            <button
              type="button"
              className="comment__action"
              aria-expanded={aberta}
              onClick={() => onResponder(aberta ? null : comment.id)}
            >
              {aberta ? "Cancelar" : "Responder"}
            </button>
          ) : null}
          {podeEditar(comment) ? (
            <button
              type="button"
              className="comment__action"
              aria-expanded={emEdicao}
              onClick={() => onEditar(comment)}
            >
              <Pencil aria-hidden /> Editar
            </button>
          ) : null}
          {podeExcluir(comment) ? (
            <button
              type="button"
              className="comment__action comment__action--danger"
              onClick={() => onExcluir(comment.id)}
            >
              <Trash2 aria-hidden /> Excluir
            </button>
          ) : null}
        </div>

        {aberta ? formResposta : null}

        {children.length > 0 ? (
          <div className="comment__replies">
            {children.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={replies}
                now={now}
                respondendoA={respondendoA}
                onResponder={onResponder}
                podeEditar={podeEditar}
                editandoId={editandoId}
                onEditar={onEditar}
                formEdicao={formEdicao}
                podeExcluir={podeExcluir}
                onExcluir={onExcluir}
                formResposta={formResposta}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

interface Props {
  comments: Comment[];
  /** Quem está lendo. */
  viewerId: string;
  /** Autor do curso: modera o que está no curso dele. */
  courseAuthorId: string;
  /** Aula onde o comentário será publicado. */
  lessonId: string;
  /** Iniciais de quem escreve, para o avatar do compositor. */
  authorInitials: string;
}

import { useCommentActions } from "./use-comment-actions.ts";

export function CommentThread({ comments, lessonId, authorInitials, viewerId, courseAuthorId }: Props) {
  const [draft, setDraft] = useState("");
  const { enviando: sending, aviso: notice, limparAviso, executar } = useCommentActions();
  /* Uma caixa de resposta por vez: abrir outra fecha a anterior, senão a
     página vira várias caixas abertas e não se sabe qual está ativa. */
  const [respondendoA, setRespondendoA] = useState<string | null>(null);
  const [respostaDraft, setRespostaDraft] = useState("");

  /* Um comentário em edição por vez, pelo mesmo motivo da caixa de resposta:
     várias caixas abertas escondem qual está ativa. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicaoDraft, setEdicaoDraft] = useState("");

  const now = useMemo(() => Date.now(), []);

  const { roots, replies } = useMemo(() => {
    const byParent = new Map<string, Comment[]>();
    const top: Comment[] = [];

    for (const comment of comments) {
      if (!comment.parentId) {
        top.push(comment);
        continue;
      }
      const siblings = byParent.get(comment.parentId) ?? [];
      siblings.push(comment);
      byParent.set(comment.parentId, siblings);
    }

    return { roots: top, replies: byParent };
  }, [comments]);

  /** Publica comentário novo ou resposta: só muda o `parentId`. */
  async function publicar(texto: string, parentId?: string) {
    const deuCerto = await executar({
      metodo: "POST",
      corpo: { lessonId, body: texto, ...(parentId ? { parentId } : {}) },
      seFalhar: "Não foi possível publicar o comentário.",
    });

    if (!deuCerto) return;

    if (parentId) {
      setRespostaDraft("");
      setRespondendoA(null);
    } else {
      setDraft("");
    }
  }

  /* Mesma regra do servidor (`can()` em permissions.ts): o autor apaga o
     próprio, o autor do curso modera o que está nele. Aqui é só para não
     oferecer um botão que o servidor recusaria — quem decide é ele. */
  function podeExcluir(comment: Comment): boolean {
    return comment.authorId === viewerId || courseAuthorId === viewerId;
  }

  /* Editar é SÓ do autor — nem o instrutor do curso, nem o admin. Moderar é
     remover, que deixa rastro; reescrever mantendo o nome de quem escreveu
     seria pôr palavras na boca da pessoa. Igual a `can()` no servidor. */
  function podeEditar(comment: Comment): boolean {
    return comment.authorId === viewerId;
  }

  function abrirEdicao(comment: Comment) {
    limparAviso();
    setEditandoId(comment.id);
    setEdicaoDraft(comment.body);
  }

  async function handleEditar(event: React.FormEvent) {
    event.preventDefault();
    if (!editandoId || !edicaoDraft.trim()) return;

    const deuCerto = await executar({
      metodo: "PATCH",
      corpo: { commentId: editandoId, body: edicaoDraft },
      seFalhar: "Não foi possível salvar a edição.",
    });

    if (!deuCerto) return;

    setEditandoId(null);
    setEdicaoDraft("");
  }

  async function handleExcluir(commentId: string) {
    await executar({
      metodo: "DELETE",
      corpo: { commentId },
      seFalhar: "Não foi possível excluir o comentário.",
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await publicar(draft);
  }

  async function handleResposta(event: React.FormEvent) {
    event.preventDefault();
    if (respondendoA) await publicar(respostaDraft, respondendoA);
  }

  const formEdicao = (
    <form className="composer composer--edit" onSubmit={handleEditar}>
      <div className="composer__field">
        <label className="sr-only" htmlFor="edicao">
          Editar comentário
        </label>
        <textarea
          className="textarea"
          id="edicao"
          rows={3}
          value={edicaoDraft}
          onChange={(event) => setEdicaoDraft(event.target.value)}
          maxLength={4000}
        />
        <div className="composer__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setEditandoId(null)}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary btn--sm" disabled={sending}>
            {sending ? "Salvando" : "Salvar"}
          </button>
        </div>
      </div>
    </form>
  );

  const formResposta = (
    <form className="composer composer--reply" onSubmit={handleResposta}>
      <span className="avatar avatar--sm" aria-hidden="true">
        {authorInitials}
      </span>
      <div className="composer__field">
        <label className="sr-only" htmlFor="resposta">
          Sua resposta
        </label>
        <textarea
          className="textarea"
          id="resposta"
          rows={2}
          placeholder="Escreva sua resposta"
          value={respostaDraft}
          onChange={(event) => setRespostaDraft(event.target.value)}
          disabled={sending}
        />
        <button
          className="btn btn--primary"
          type="submit"
          disabled={sending || respostaDraft.trim().length === 0}
        >
          <Send aria-hidden /> {sending ? "Enviando" : "Responder"}
        </button>
      </div>
    </form>
  );

  return (
    <section className="comments" aria-labelledby="comentarios">
      <div className="comments__head">
        <h2 className="course-section__title" id="comentarios">
          Comentários
        </h2>
        <span className="comments__count">{comments.length}</span>
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <span className="avatar avatar--sm" aria-hidden="true">
          {authorInitials}
        </span>

        <div className="composer__body">
          <label className="sr-only" htmlFor="novo-comentario">
            Novo comentário
          </label>
          <textarea
            className="textarea"
            id="novo-comentario"
            rows={2}
            placeholder="Escreva um comentário sobre esta aula…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="composer__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={sending || draft.trim().length === 0}
            >
              {sending ? "Publicando…" : "Publicar"} <Send aria-hidden />
            </button>
          </div>
        </div>
      </form>

      <p className="status-text" role="status">
        {notice}
      </p>

      <div className="comment-list">
        {roots.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={replies}
            now={now}
            respondendoA={respondendoA}
            onResponder={setRespondendoA}
            podeExcluir={podeExcluir}
            onExcluir={handleExcluir}
            podeEditar={podeEditar}
            editandoId={editandoId}
            onEditar={abrirEdicao}
            formEdicao={formEdicao}
            formResposta={formResposta}
          />
        ))}
      </div>
    </section>
  );
}
