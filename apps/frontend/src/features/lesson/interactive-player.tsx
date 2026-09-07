"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheckBig, CircleX, RotateCcw, Sparkles } from "lucide-react";

import { INTERACTIVE_LABEL, type InteractiveKind } from "@nerdlms/core/interactive/interactive.ts";

import "./interactive-player.css";

/**
 * Player de conteúdo interativo — F6-05.
 *
 * Três tipos num componente só, porque o esqueleto é o mesmo: carregar,
 * apresentar interações, mandar a resposta ao servidor, mostrar o retorno. O
 * que muda é a APRESENTAÇÃO, e é onde o componente se divide.
 *
 * O gabarito nunca chega aqui. A conferência é do servidor, e este componente
 * só sabe o resultado depois de perguntar.
 */

interface PublicItem {
  id: string;
  position: number;
  atSeconds: number | null;
  xPercent: number | null;
  yPercent: number | null;
  prompt: string;
  body: string | null;
  options: Array<{ text: string }>;
  blocking: boolean;
}

interface Resposta {
  itemId: string;
  answer: string | null;
  correct: boolean | null;
  attempts: number;
}

interface Conteudo {
  id: string;
  kind: InteractiveKind;
  title: string;
  mediaUrl: string | null;
  items: PublicItem[];
  responses: Resposta[];
  summary: { total: number; answered: number; correct: number; percent: number };
  canComplete: { allow: boolean; remaining?: number; total?: number };
}

interface Resultado {
  result: "correct" | "incorrect" | "acknowledged";
  feedback: string | null;
  explanation: string | null;
}

export function InteractivePlayer({ lessonId }: { lessonId: string }) {
  const [conteudo, setConteudo] = useState<Conteudo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<PublicItem | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  /* As respostas já dadas, para não repetir a mesma pergunta. `useRef` porque
     o `timeupdate` do vídeo lê isto de forma síncrona, e o estado do React
     ainda não teria sido aplicado. */
  const respondidas = useRef<Set<string>>(new Set());
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const resposta = await fetch(`/api/interativo?aula=${lessonId}`);
        if (!resposta.ok) return;

        const dados = (await resposta.json()) as Conteudo;
        if (cancelado) return;

        respondidas.current = new Set(dados.responses.map((r) => r.itemId));
        setConteudo(dados);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [lessonId]);

  async function responder(item: PublicItem, answer: string | null) {
    setEnviando(true);

    try {
      const resposta = await fetch("/api/interativo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, answer }),
      });

      const dados = (await resposta.json().catch(() => ({}))) as Resultado & {
        summary?: Conteudo["summary"];
        canComplete?: Conteudo["canComplete"];
      };

      if (!resposta.ok) return;

      respondidas.current.add(item.id);
      setResultado(dados);

      setConteudo((atual) =>
        atual
          ? {
              ...atual,
              summary: dados.summary ?? atual.summary,
              canComplete: dados.canComplete ?? atual.canComplete,
              responses: [
                ...atual.responses.filter((r) => r.itemId !== item.id),
                {
                  itemId: item.id,
                  answer,
                  correct: dados.result === "acknowledged" ? null : dados.result === "correct",
                  attempts: 1,
                },
              ],
            }
          : atual,
      );
    } finally {
      setEnviando(false);
    }
  }

  /* O vídeo pausa quando uma pergunta bloqueante aparece. */
  function aoAvancar() {
    if (!conteudo || conteudo.kind !== "interactive_video" || aberto) return;

    const segundo = Math.floor(video.current?.currentTime ?? 0);

    const proximo = conteudo.items
      .filter((item) => item.atSeconds !== null && item.atSeconds <= segundo)
      .filter((item) => !respondidas.current.has(item.id))
      .sort((a, b) => (a.atSeconds ?? 0) - (b.atSeconds ?? 0))[0];

    if (!proximo) return;

    if (proximo.blocking) video.current?.pause();

    setAberto(proximo);
    setResultado(null);
  }

  function fechar() {
    setAberto(null);
    setResultado(null);

    /* Retoma o vídeo depois de responder — quem parou foi a pergunta. */
    if (conteudo?.kind === "interactive_video") void video.current?.play().catch(() => {});
  }

  if (carregando) {
    return <p className="iplayer__carregando">Carregando conteúdo interativo…</p>;
  }

  if (!conteudo) return null;

  return (
    <section className="iplayer" aria-labelledby="interativo">
      <div className="iplayer__cabeca">
        <h2 className="iplayer__titulo" id="interativo">
          <Sparkles aria-hidden /> {conteudo.title}
        </h2>
        <span className="iplayer__tipo">{INTERACTIVE_LABEL[conteudo.kind]}</span>
      </div>

      {/* O progresso diz o que falta EM PALAVRAS, não só na barra. */}
      <p className="iplayer__progresso" role="status">
        {conteudo.canComplete.allow ? (
          <>
            <CircleCheckBig aria-hidden /> Você respondeu o suficiente para concluir esta aula.
          </>
        ) : (
          <>
            {conteudo.summary.answered} de {conteudo.summary.total} respondidas, faltam{" "}
            {conteudo.canComplete.remaining}
          </>
        )}
      </p>

      {conteudo.kind === "interactive_video" && conteudo.mediaUrl ? (
        <div className="iplayer__video">
          <video
            ref={video}
            src={conteudo.mediaUrl}
            controls
            onTimeUpdate={aoAvancar}
            className="iplayer__media"
          />

          {/* As marcas na linha do tempo: quem vê o vídeo sabe onde há
              pergunta antes de chegar nela. */}
          <ul className="iplayer__marcas">
            {conteudo.items.map((item) => (
              <li
                key={item.id}
                data-respondida={respondidas.current.has(item.id) || undefined}
                title={`Pergunta aos ${Math.floor((item.atSeconds ?? 0) / 60)}min`}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {conteudo.kind === "image_hotspots" && conteudo.mediaUrl ? (
        <div className="iplayer__imagem">
          {/* Mesmo motivo do visualizador de documentos: a imagem é conteúdo
              de aula enviado pelo cliente, de host desconhecido em tempo de
              build. E aqui os pontos clicáveis são posicionados em percentual
              sobre ela — o redimensionamento do otimizador moveria os alvos. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={conteudo.mediaUrl} alt={conteudo.title} className="iplayer__media" />

          {conteudo.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="iplayer__ponto"
              data-visto={respondidas.current.has(item.id) || undefined}
              style={{ left: `${item.xPercent ?? 50}%`, top: `${item.yPercent ?? 50}%` }}
              aria-label={item.prompt}
              onClick={() => {
                setAberto(item);
                setResultado(null);
              }}
            >
              <span aria-hidden>{item.position + 1}</span>
            </button>
          ))}
        </div>
      ) : null}

      {conteudo.kind === "flashcards" ? (
        <ul className="iplayer__cartoes">
          {conteudo.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="iplayer__cartao"
                data-visto={respondidas.current.has(item.id) || undefined}
                onClick={() => {
                  setAberto(item);
                  setResultado(null);
                  /* Abrir o cartão JÁ conta como visto: não há o que
                     responder, e exigir um clique a mais seria burocracia. */
                  if (!respondidas.current.has(item.id)) void responder(item, null);
                }}
              >
                {item.prompt}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* A interação aberta. Modal porque ela INTERROMPE — é o ponto de uma
          pergunta no meio do vídeo. */}
      {aberto ? (
        <div className="iplayer__modal" role="dialog" aria-modal="true" aria-label={aberto.prompt}>
          <div className="iplayer__caixa">
            <p className="iplayer__pergunta">{aberto.prompt}</p>

            {/* Flashcard e hotspot mostram o verso direto: é o conteúdo. */}
            {aberto.options.length === 0 ? (
              <>
                {aberto.body ? <p className="iplayer__verso">{aberto.body}</p> : null}
                <button type="button" className="btn btn--primary" onClick={fechar}>
                  Entendi
                </button>
              </>
            ) : resultado ? (
              <div className="iplayer__retorno" data-certo={resultado.result === "correct" || undefined}>
                <p className="iplayer__veredito">
                  {resultado.result === "correct" ? (
                    <>
                      <CircleCheckBig aria-hidden /> Correto
                    </>
                  ) : (
                    <>
                      <CircleX aria-hidden /> Não é essa
                    </>
                  )}
                </p>

                {resultado.feedback ? <p>{resultado.feedback}</p> : null}
                {resultado.explanation ? (
                  <p className="iplayer__explicacao">{resultado.explanation}</p>
                ) : null}

                <div className="iplayer__acoes">
                  {resultado.result === "incorrect" ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setResultado(null)}
                    >
                      <RotateCcw aria-hidden /> Tentar de novo
                    </button>
                  ) : null}

                  <button type="button" className="btn btn--primary" onClick={fechar}>
                    Continuar
                  </button>
                </div>
              </div>
            ) : (
              <ul className="iplayer__alternativas">
                {aberto.options.map((opcao, indice) => (
                  <li key={indice}>
                    <button
                      type="button"
                      className="iplayer__alternativa"
                      disabled={enviando}
                      onClick={() => responder(aberto, String(indice))}
                    >
                      {opcao.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
