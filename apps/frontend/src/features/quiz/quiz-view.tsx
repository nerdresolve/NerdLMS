"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Clock, Send } from "lucide-react";

import { QuestionInput, type QuestionView } from "./question-input.tsx";

import "./quiz.css";

/**
 * Fazer a prova — F3-03.
 *
 * O cronômetro daqui é INFORMATIVO. Quem decide o prazo é o servidor: mudar a
 * hora da máquina não rende mais tempo de prova, e a resposta enviada depois do
 * prazo é recusada lá. Aqui ele existe para a pessoa saber quanto falta.
 */

export interface QuizStart {
  attemptId: string;
  attemptNumber: number;
  startedAt: string;
  questions: QuestionView[];
  quiz: {
    title: string;
    timeLimitMinutes: number | null;
    questionsPerPage: number | null;
    sequentialNavigation: boolean;
    totalPoints: number;
  };
}

export interface QuizResult {
  percent: number;
  passed: boolean;
  needsReview: boolean;
}

function formatClock(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function QuizView({ start }: { start: QuizStart }) {
  const router = useRouter();

  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [pagina, setPagina] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<QuizResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const porPagina = start.quiz.questionsPerPage ?? start.questions.length;
  const paginas = Math.max(1, Math.ceil(start.questions.length / porPagina));
  const visiveis = start.questions.slice(pagina * porPagina, (pagina + 1) * porPagina);

  /* Segundos restantes, ou null quando a prova não tem limite. */
  const [restante, setRestante] = useState<number | null>(() => {
    if (!start.quiz.timeLimitMinutes) return null;
    const fim = new Date(start.startedAt).getTime() + start.quiz.timeLimitMinutes * 60_000;
    return Math.max(0, Math.round((fim - Date.now()) / 1000));
  });

  const enviarRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (restante === null || resultado) return;

    const t = setInterval(() => {
      setRestante((atual) => {
        if (atual === null) return null;
        if (atual <= 1) {
          /* Tempo esgotado: envia o que houver. Deixar a tela parada faria a
             pessoa perder as respostas que já deu — o servidor recusaria uma
             gravação posterior, mas o que já foi gravado conta. */
          enviarRef.current();
          return 0;
        }
        return atual - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [restante, resultado]);

  /** Grava a resposta assim que muda: sair da página não perde o que respondeu. */
  async function responder(questionId: string, response: unknown) {
    setRespostas((atual) => ({ ...atual, [questionId]: response }));

    await fetch("/api/provas", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId: start.attemptId, questionId, response }),
      keepalive: true,
    }).catch(() => {
      /* Melhor-esforço: a próxima mudança tenta de novo, e o envio final
         reenvia o que estiver na tela. */
    });
  }

  async function enviar() {
    if (enviando || resultado) return;
    setEnviando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/provas", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId: start.attemptId, submit: true }),
      });

      const dados = (await resposta.json().catch(() => ({}))) as QuizResult & { error?: string };

      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível enviar a prova.");
        return;
      }

      setResultado(dados);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  enviarRef.current = () => void enviar();

  if (resultado) {
    return (
      <section className="quiz-result">
        <span className="quiz-result__icon" data-passou={resultado.passed || undefined}>
          <CircleCheckBig aria-hidden />
        </span>

        <h2 className="quiz-result__title">
          {resultado.needsReview
            ? "Prova enviada"
            : resultado.passed
              ? "Aprovado"
              : "Não atingiu a nota"}
        </h2>

        <p className="quiz-result__score">{resultado.percent}%</p>

        <p className="quiz-result__text">
          {resultado.needsReview
            ? "Há questões dissertativas aguardando correção do instrutor. A nota final pode mudar."
            : resultado.passed
              ? "Você atingiu a nota necessária."
              : "Confira o material e tente de novo, se ainda tiver tentativas."}
        </p>
      </section>
    );
  }

  return (
    <div className="quiz">
      <div className="quiz__head">
        <div>
          <h1 className="page-head__greeting">{start.quiz.title}</h1>
          <p className="page-head__sub">
            Tentativa {start.attemptNumber} · {start.questions.length}{" "}
            {start.questions.length === 1 ? "questão" : "questões"} · {start.quiz.totalPoints} pontos
          </p>
        </div>

        {restante !== null ? (
          /* `role="timer"` com `aria-live="off"`: anunciar cada segundo
             interromperia a leitura da questão sem parar. Quem quiser saber
             navega até ele. */
          <p className="quiz__timer" role="timer" aria-live="off" data-baixo={restante < 60 || undefined}>
            <Clock aria-hidden /> {formatClock(restante)}
          </p>
        ) : null}
      </div>

      {visiveis.map((questao, indice) => {
        const numero = pagina * porPagina + indice + 1;

        return (
          <section className="quiz-question" key={questao.id} aria-labelledby={`enun-${questao.id}`}>
            <p className="quiz-question__meta">
              Questão {numero} de {start.questions.length} · {questao.points}{" "}
              {questao.points === 1 ? "ponto" : "pontos"}
            </p>

            <h2 className="quiz-question__prompt" id={`enun-${questao.id}`}>
              {questao.prompt}
            </h2>

            <QuestionInput
              question={questao}
              value={respostas[questao.id]}
              disabled={enviando}
              onChange={(valor) => void responder(questao.id, valor)}
            />
          </section>
        );
      })}

      <div className="quiz__nav">
        {/* A navegação sequencial esconde o "voltar": o guia a lista como
            configuração da prova, e permitir voltar quando ela está ligada
            esvaziaria a configuração. */}
        {pagina > 0 && !start.quiz.sequentialNavigation ? (
          <button type="button" className="btn btn--secondary" onClick={() => setPagina(pagina - 1)}>
            Anterior
          </button>
        ) : (
          <span />
        )}

        {pagina < paginas - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => setPagina(pagina + 1)}>
            Próxima
          </button>
        ) : (
          <button type="button" className="btn btn--primary" disabled={enviando} onClick={enviar}>
            <Send aria-hidden /> {enviando ? "Enviando" : "Enviar prova"}
          </button>
        )}
      </div>

      <p className="status-text" role="status">
        {erro}
      </p>
    </div>
  );
}
