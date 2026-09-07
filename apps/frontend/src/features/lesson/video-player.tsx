"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, Maximize, Pause, Play, Volume2 } from "lucide-react";

import { formatClock } from "@nerdlms/core/courses/lesson.ts";
import { avancaMaximo, decideSeek } from "@nerdlms/core/rigor/video-seek.ts";

import { useFeature } from "@/features/tenant/feature-context.tsx";

/** Velocidades oferecidas, na ordem em que o botão cicla. */
const RATES = [1, 1.25, 1.5, 1.75, 2, 0.75] as const;

interface VideoPlayerProps {
  /** URL assinada com TTL curto, emitida pelo servidor. */
  src: string;
  label: string;
  /** Segundo em que o vídeo deve começar. */
  resumeAtSeconds?: number;
  /** Chamado quando a posição avança; o servidor revalida. */
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
   * Forçar a trava, independentemente do que o cliente contratou.
   *
   * Existe para a pré-visualização do instrutor, que precisa ver como a aula
   * se comporta. No uso normal fica de fora: a flag do cliente decide.
   */
  lockSeek?: boolean;
  /**
   * O ponto mais distante já assistido, em segundos.
   *
   * Vem do servidor, do progresso gravado: sem ele, fechar a aba e voltar
   * reiniciaria a trava do zero e a pessoa reassistiria tudo.
   */
  watchedUpTo?: number;
}

export function VideoPlayer({
  src,
  label,
  resumeAtSeconds = 0,
  onProgress,
  onPause,
  lockSeek,
  watchedUpTo = 0,
}: VideoPlayerProps) {
  /* A flag é consultada AQUI, e não recebida por prop de cada tela que usa o
     player. Passar por prop obrigaria cada chamador a lembrar dela — e
     bastaria um esquecer para a trava sumir sem ninguém notar. */
  const travaDoCliente = useFeature("rigor.video");
  const travado = lockSeek ?? travaDoCliente;
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);
  const [current, setCurrent] = useState(resumeAtSeconds);
  const [duration, setDuration] = useState(0);

  /* O máximo assistido vive num `ref`, não em estado: o `timeupdate` dispara
     quatro vezes por segundo, e um `setState` a cada um re-renderizaria o
     player inteiro sem que nada mudasse na tela. O aviso, sim, é estado —
     ele aparece. */
  const maximoVisto = useRef(watchedUpTo);
  const [avisoTrava, setAvisoTrava] = useState(false);

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
      ArrowRight: () => (video.currentTime = Math.min(video.duration, video.currentTime + 5)),
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
      if (resumeAtSeconds > 0 && resumeAtSeconds < video.duration) video.currentTime = resumeAtSeconds;
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

          /* O máximo só avança pela REPRODUÇÃO. `avancaMaximo` recusa saltos —
             é o que impede a trava de se liberar sozinha: se pular para o fim
             atualizasse o máximo, o primeiro salto abriria o vídeo inteiro. */
          maximoVisto.current = avancaMaximo(
            maximoVisto.current,
            video.currentTime,
            video.playbackRate,
          );

          setCurrent(video.currentTime);
          onProgress?.(video.currentTime, video.duration);
        }}
        onSeeking={(event) => {
          const video = event.currentTarget;

          const decisao = decideSeek(video.currentTime, maximoVisto.current, travado);
          if (!decisao.blocked) return;

          /* Devolver o vídeo para onde a pessoa parou. Deixá-lo onde está
             travaria a reprodução num ponto que ela nunca alcançou. */
          video.currentTime = decisao.position;

          setAvisoTrava(true);
          window.setTimeout(() => setAvisoTrava(false), 3000);
        }}
      />

      <div className="player__scrim" />

      {/* O aviso da trava.

          `role="status"` e não `alert`: a pessoa provocou a ação e está
          olhando para o player — um alerta interromperia o leitor de tela no
          meio de outra coisa para dizer algo que já está visível. */}
      {avisoTrava ? (
        <p className="player__trava" role="status">
          Esta aula precisa ser assistida até o fim. Você pode voltar e rever.
        </p>
      ) : null}

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
            const seconds = Number(event.target.value);

            /* Escrever em `currentTime` dispara `seeking`, e é lá que a trava
               decide. Aqui só se ajusta a barra — e ela recebe a posição
               DECIDIDA, não a pedida: mostrar a barra no ponto que o vídeo
               recusou deixaria as duas coisas discordando na tela. */
            const decisao = decideSeek(seconds, maximoVisto.current, travado);

            if (videoRef.current) videoRef.current.currentTime = decisao.position;
            setCurrent(decisao.position);
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

          {/* As faixas de legenda entram quando o upload aceitar.vtt.
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

          <button type="button" className="player__button" aria-label="Tela cheia" onClick={toggleFullscreen}>
            <Maximize aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
