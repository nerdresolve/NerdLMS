"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, Maximize, Pause, PictureInPicture2, Play, Volume2 } from "lucide-react";

import { formatClock } from "@nerdlms/core/courses/lesson.ts";

/** Velocidades oferecidas, na ordem em que o botão cicla. */
const RATES = [1, 1.25, 1.5, 1.75, 2, 0.75] as const;

interface VideoPlayerProps {
  /** URL assinada com TTL curto, emitida pelo servidor (DEC-009). */
  src: string;
  label: string;
  /** Segundo em que o vídeo deve começar. */
  resumeAtSeconds?: number;
  /** Chamado quando a posição avança; o servidor revalida (TASK-011C). */
  onProgress?: (currentSeconds: number, durationSeconds: number) => void;
  /**
   * Parou de assistir — pausou, saiu da aula ou fechou a aba.
   *
   * Separado de `onProgress` porque `timeupdate` não dispara com o vídeo
   * parado: sem este aviso, a posição de quem volta para rever um trecho e
   * pausa nunca chega ao servidor.
   */
  onPause?: (currentSeconds: number) => void;
  /**
   * A trava do player vale nesta aula?
   *
   * Ausente é `true`, como no domínio: o padrão precisa ser o restritivo.
   *
   * Além de prender a barra, ela decide se o miniplayer aparece. Vídeo em
   * segundo plano é exatamente o que a regra de tempo compatível recusa, e
   * oferecer o botão num curso travado deixaria a pessoa assistir fora da
   * tela para depois ver o progresso ser cortado pelo servidor.
   */
  travado?: boolean;
}

export function VideoPlayer({
  src,
  label,
  resumeAtSeconds = 0,
  onProgress,
  onPause,
  travado = true,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);
  const [current, setCurrent] = useState(resumeAtSeconds);
  const [duration, setDuration] = useState(0);

  /**
   * O ponto mais distante já alcançado, em segundos.
   *
   * É o teto do que se pode adiantar. Começa onde a pessoa parou da última vez
   * — quem já assistiu vinte minutos não recomeça preso no zero.
   *
   * `useRef` e não `useState`: ele é lido dentro do manipulador de `seeking`,
   * que dispara muitas vezes por segundo enquanto se arrasta a barra. Com
   * estado, cada leitura pegaria o valor do render anterior e a trava
   * escaparia por um quadro.
   */
  const maxAlcancado = useRef(resumeAtSeconds);
  const [teto, setTeto] = useState(resumeAtSeconds);

  /**
   * Leva a posição de volta ao teto, quando ela passa dele.
   *
   * ISTO É EXPERIÊNCIA, NÃO GARANTIA. Roda na máquina de quem está sendo
   * travado, e quem abrir o console contorna em dois comandos. A garantia mora
   * no servidor (`packages/core/src/courses/watch-guard.ts`), que recusa
   * avanço mais rápido que o relógio permite. Aqui o objetivo é outro: que
   * ninguém pule SEM QUERER, e que a barra diga o que dá para fazer.
   */
  const prenderNoTeto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    /* Curso sem trava: a barra é livre, e não há teto a prender. */
    if (!travado) return;

    /* Um segundo de folga: o navegador posiciona no quadro-chave mais próximo,
       e sem a folga o vídeo ficaria preso repetindo o mesmo instante. */
    if (video.currentTime > maxAlcancado.current + 1) {
      video.currentTime = maxAlcancado.current;
      setCurrent(maxAlcancado.current);
    }
  }, [travado]);

  /**
   * O miniplayer, quando o navegador oferece e o curso permite.
   *
   * `document.pictureInPictureEnabled` responde por dois motivos diferentes:
   * o navegador não implementa, ou a política da página bloqueou. Nos dois o
   * botão não deve aparecer, e o estado começa em `false` de propósito: no
   * servidor não existe `document`, e ler durante a renderização quebraria a
   * hidratação.
   */
  const [temMiniplayer, setTemMiniplayer] = useState(false);

  useEffect(() => {
    if (!travado && typeof document !== "undefined") {
      setTemMiniplayer(document.pictureInPictureEnabled === true);
    }
  }, [travado]);

  const alternarMiniplayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* O navegador recusa por gesto do usuário ausente, vídeo sem metadados
         ou política da página. Nenhum desses casos merece derrubar a aula, e
         o vídeo continua tocando na tela normalmente. */
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }, []);

  /** Atalhos só quando o foco está dentro do player: não sequestrar a página. */
  function onKeyDown(event: React.KeyboardEvent) {
    const video = videoRef.current;
    if (!video) return;
    if (event.target instanceof HTMLInputElement && event.key !== "k") return;

    const actions: Record<string, () => void> = {
      " ": togglePlay,
      k: togglePlay,
      /* Avançar cinco segundos é atalho legítimo — desde que não passe de
         onde já se chegou. */
      ArrowRight: () =>
        (video.currentTime = Math.min(
          video.duration,
          maxAlcancado.current,
          video.currentTime + 5,
        )),
      ArrowLeft: () => (video.currentTime = Math.max(0, video.currentTime - 5)),
      f: toggleFullscreen,
      m: toggleMute,
    };

    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  // Retoma a posição assim que a duração é conhecida.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onLoaded() {
      if (!video) return;
      setDuration(video.duration || 0);
      if (resumeAtSeconds > 0 && resumeAtSeconds < video.duration) {
        video.currentTime = resumeAtSeconds;
        maxAlcancado.current = Math.max(maxAlcancado.current, resumeAtSeconds);
        setTeto(maxAlcancado.current);
      }
    }

    video.addEventListener("loadedmetadata", onLoaded);

    /* O vídeo pode já ter os metadados quando este efeito roda — arquivo em
       cache, navegação de volta, ou hidratação depois do carregamento. Nesses
       casos `loadedmetadata` já disparou e não dispara de novo, então o
       listener sozinho nunca posiciona o vídeo e a aula recomeça do zero.

       `readyState >= HAVE_METADATA` (1) significa que a duração já é
       conhecida, que é tudo o que `onLoaded` precisa. */
    if (video.readyState >= 1) onLoaded();

    return () => video.removeEventListener("loadedmetadata", onLoaded);
  }, [resumeAtSeconds]);

  const percent = duration > 0 ? (current / duration) * 100 : 0;
  const rate = RATES[rateIndex] ?? 1;

  return (
    <div
      ref={containerRef}
      className="player"
      data-playing={playing}
      style={{ "--seek": `${percent}%` } as React.CSSProperties}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <video
        ref={videoRef}
        className="player__video"
        id="video"
        src={src}
        preload="metadata"
        playsInline
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={(event) => {
          setPlaying(false);
          /* Avisa a posição ao parar. Duas coisas no mesmo manipulador porque o
             elemento só aceita um `onPause`: declarar dois faz o segundo
             sobrescrever o primeiro em silêncio, e o ícone de play/pause
             pararia de reagir. */
          onPause?.(event.currentTarget.currentTime);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setCurrent(video.currentTime);

          /* O teto sobe SÓ assistindo. Como `timeupdate` dispara com o vídeo
             rodando, é aqui que ele cresce — e nunca por um salto, porque o
             salto é desfeito em `onSeeking` antes de chegar a este ponto. */
          if (video.currentTime > maxAlcancado.current) {
            maxAlcancado.current = video.currentTime;
            setTeto(video.currentTime);
          }

          onProgress?.(video.currentTime, video.duration);
        }}
        /* `seeking` dispara ao COMEÇAR o salto, antes de o vídeo assentar na
           nova posição; `seeked`, ao terminar. Os dois porque o primeiro corta
           cedo — sem quadro fora de lugar aparecer — e o segundo pega o caso em
           que o navegador reposiciona por conta própria. */
        onSeeking={prenderNoTeto}
        onSeeked={prenderNoTeto}
      />

      <div className="player__scrim" />

      <button type="button" className="player__big-play" aria-label="Reproduzir" onClick={togglePlay}>
        <Play aria-hidden />
      </button>

      <div className="player__controls">
        <span className="player__label">{label}</span>

        <label className="sr-only" htmlFor="seek">
          Posição do vídeo
        </label>
        <input
          className="player__seek"
          id="seek"
          type="range"
          min={0}
          max={Math.floor(duration) || 0}
          step={1}
          value={Math.floor(current)}
          aria-valuetext={`${formatClock(current)} de ${formatClock(duration)}`}
          onChange={(event) => {
            /* A barra vai até a duração inteira de propósito: encolher o
               `max` para o teto esconderia quanto ainda falta, e a pessoa
               perderia a noção do tamanho da aula. O que se limita é o
               destino, não a régua. */
            const seconds = Math.min(Number(event.target.value), teto);
            if (videoRef.current) videoRef.current.currentTime = seconds;
            setCurrent(seconds);
          }}
          style={{
            /* Quanto da barra já foi liberado. O CSS pinta o resto com outro
               tratamento, para o limite ser visível antes de a pessoa tentar
               arrastar e não conseguir. */
            ["--liberado" as string]: `${duration > 0 ? Math.min(100, (teto / duration) * 100) : 0}%`,
          }}
        />

        <div className="player__row">
          <button
            type="button"
            className="player__button"
            aria-label={playing ? "Pausar" : "Reproduzir"}
            onClick={togglePlay}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </button>

          <button
            type="button"
            className="player__button"
            aria-pressed={muted}
            aria-label={muted ? "Ativar som" : "Silenciar"}
            onClick={toggleMute}
          >
            <Volume2 aria-hidden />
          </button>

          <label className="sr-only" htmlFor="volume">
            Volume
          </label>
          <input
            className="player__volume"
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={1}
            onChange={(event) => {
              if (videoRef.current) videoRef.current.volume = Number(event.target.value);
            }}
          />

          <span className="player__time">
            {formatClock(current)} / {formatClock(duration)}
          </span>
          <span className="player__spacer" />

          <button
            type="button"
            className="player__button player__button--wide"
            aria-label={`Velocidade: ${rate} vezes`}
            onClick={() => {
              const next = (rateIndex + 1) % RATES.length;
              setRateIndex(next);
              if (videoRef.current) videoRef.current.playbackRate = RATES[next] ?? 1;
            }}
          >
            {rate}×
          </button>

          {/* As faixas de legenda entram quando o upload aceitar .vtt (ISSUE-002).
              O `title` diz por que está apagado: botão desabilitado sem motivo
              parece defeito. */}
          <button
            type="button"
            className="player__button"
            aria-pressed={false}
            aria-label="Legendas (ainda não disponíveis)"
            title="Legendas ainda não disponíveis: entram junto com o cadastro de conteúdo"
            disabled
          >
            <Captions aria-hidden />
          </button>

          {/* Só nos cursos sem trava. Num curso travado, o vídeo em segundo
              plano é justamente o que a regra de tempo compatível recusa: a
              pessoa assistiria fora da tela e veria o progresso ser cortado
              pelo servidor depois. */}
          {temMiniplayer ? (
            <button
              type="button"
              className="player__button"
              aria-label="Miniplayer"
              title="Continua tocando enquanto você usa outra aba"
              onClick={() => void alternarMiniplayer()}
            >
              <PictureInPicture2 aria-hidden />
            </button>
          ) : null}

          <button type="button" className="player__button" aria-label="Tela cheia" onClick={toggleFullscreen}>
            <Maximize aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
