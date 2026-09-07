"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileText } from "lucide-react";

import "./grading.css";

/**
 * Fila de correção — F3-06.
 *
 * Junta as duas pendências do instrutor: dissertativas de prova e trabalhos
 * entregues. São gestos idênticos — ler, pontuar, comentar — e separá-los em
 * duas telas obrigaria a lembrar de conferir as duas.
 */

export interface PendingEssay {
  attemptId: string;
  questionId: string;
  quizTitle: string;
  prompt: string;
  learnerName: string;
  response: unknown;
  maxPoints: number;
}

export interface PendingSubmission {
  id: string;
  assignmentTitle: string;
  learnerName: string;
  submittedAt: string;
  isLate: boolean;
  textContent?: string;
  files: { id: string; name: string }[];
  pointsPossible: number;
}

export function GradingView({
  essays,
  submissions,
}: {
  essays: PendingEssay[];
  submissions: PendingSubmission[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function corrigir(chave: string, payload: Record<string, unknown>) {
    setBusy(chave);
    setNotice(null);

    try {
      const resposta = await fetch("/api/trabalhos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
        setNotice(erro.error ?? "Não foi possível salvar a nota.");
        return;
      }

      setNotice("Nota lançada.");
      router.refresh();
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(null);
    }
  }

  const vazio = essays.length === 0 && submissions.length === 0;

  return (
    <div className="grading">
      <div className="page-head">
        <h1 className="page-head__greeting">Correção</h1>
        <p className="page-head__sub">
          {vazio
            ? "Nada aguardando correção."
            : `${essays.length + submissions.length} ${essays.length + submissions.length === 1 ? "item aguardando" : "itens aguardando"}.`}
        </p>
      </div>

      {essays.length > 0 ? (
        <section className="course-section" aria-labelledby="dissertativas">
          <h2 className="course-section__title" id="dissertativas">
            <ClipboardCheck aria-hidden /> Questões dissertativas
          </h2>

          {essays.map((item) => {
            const chave = `${item.attemptId}:${item.questionId}`;

            return (
              <article className="grading-item" key={chave}>
                <p className="grading-item__meta">
                  {item.learnerName} · {item.quizTitle} · vale {item.maxPoints}{" "}
                  {item.maxPoints === 1 ? "ponto" : "pontos"}
                </p>

                <h3 className="grading-item__prompt">{item.prompt}</h3>

                <blockquote className="grading-item__answer">
                  {typeof item.response === "string" && item.response.trim() !== ""
                    ? item.response
                    : "(sem resposta)"}
                </blockquote>

                <form
                  className="grading-item__form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);

                    void corrigir(chave, {
                      attemptId: item.attemptId,
                      questionId: item.questionId,
                      points: Number(form.get("points")),
                      feedback: form.get("feedback"),
                    });
                  }}
                >
                  <div className="field grading-item__points">
                    <label className="label" htmlFor={`p-${chave}`}>
                      Nota (0 a {item.maxPoints})
                    </label>
                    <input
                      className="input"
                      id={`p-${chave}`}
                      name="points"
                      type="number"
                      min={0}
                      max={item.maxPoints}
                      step="0.5"
                      required
                    />
                  </div>

                  <div className="field grading-item__feedback">
                    <label className="label" htmlFor={`f-${chave}`}>
                      Comentário
                    </label>
                    <input className="input" id={`f-${chave}`} name="feedback" />
                  </div>

                  <button type="submit" className="btn btn--primary" disabled={busy === chave}>
                    {busy === chave ? "Lançando" : "Lançar nota"}
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      ) : null}

      {submissions.length > 0 ? (
        <section className="course-section" aria-labelledby="trabalhos">
          <h2 className="course-section__title" id="trabalhos">
            <FileText aria-hidden /> Trabalhos entregues
          </h2>

          {submissions.map((item) => (
            <article className="grading-item" key={item.id}>
              <p className="grading-item__meta">
                {item.learnerName} · {item.assignmentTitle} · vale {item.pointsPossible} pontos
                {item.isLate ? <span className="badge badge--warning"> Entregue com atraso</span> : null}
              </p>

              {item.textContent ? (
                <blockquote className="grading-item__answer">{item.textContent}</blockquote>
              ) : null}

              {item.files.length > 0 ? (
                <ul className="grading-item__files">
                  {item.files.map((arquivo) => (
                    <li key={arquivo.id}>
                      <FileText aria-hidden /> {arquivo.name}
                    </li>
                  ))}
                </ul>
              ) : null}

              <form
                className="grading-item__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);

                  void corrigir(item.id, {
                    submissionId: item.id,
                    points: Number(form.get("points")),
                    feedback: form.get("feedback"),
                  });
                }}
              >
                <div className="field grading-item__points">
                  <label className="label" htmlFor={`p-${item.id}`}>
                    Nota (0 a {item.pointsPossible})
                  </label>
                  <input
                    className="input"
                    id={`p-${item.id}`}
                    name="points"
                    type="number"
                    min={0}
                    max={item.pointsPossible}
                    step="0.5"
                    required
                  />
                </div>

                <div className="field grading-item__feedback">
                  <label className="label" htmlFor={`f-${item.id}`}>
                    Comentário
                  </label>
                  <input className="input" id={`f-${item.id}`} name="feedback" />
                </div>

                <button type="submit" className="btn btn--primary" disabled={busy === item.id}>
                  {busy === item.id ? "Lançando" : "Lançar nota"}
                </button>
              </form>
            </article>
          ))}
        </section>
      ) : null}

      <p className="status-text" role="status">
        {notice}
      </p>
    </div>
  );
}
