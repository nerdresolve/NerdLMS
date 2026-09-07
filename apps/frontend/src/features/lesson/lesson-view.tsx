"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bookmark, Check, CircleCheckBig, Clock, FileText, ListVideo, Play, X } from "lucide-react";

import { FluidWave } from "@/components/brand/fluid-wave.tsx";
import { ProgressBar } from "@/features/dashboard/dashboard-view.tsx";
import { VideoPlayer } from "./video-player.tsx";
import { DocumentViewer } from "./document-viewer.tsx";
import { InteractivePlayer } from "./interactive-player.tsx";
import { ScormPlayer, type ScormInitial } from "./scorm-player.tsx";
import { Feature } from "@/features/tenant/feature-context.tsx";

import { CommentThread } from "./comment-thread.tsx";
import { CompleteLessonButton } from "./complete-button.tsx";
import type { LessonNeighbour, LessonView as LessonViewData } from "@nerdlms/core/courses/lesson.ts";
import type { Comment, LessonMaterial } from "@nerdlms/core/courses/types.ts";
import type { Course } from "@nerdlms/core/courses/types.ts";

import "./lesson.css";
import { plural } from "@nerdlms/core/courses/plural.ts";

const LESSON_LABEL = {
  done: "Aula concluída",
  current: "Aula atual",
  todo: "Aula não iniciada",
} as const;

function Pager({ neighbour, direction }: { neighbour: LessonNeighbour | null; direction: "previous" | "next" }) {
  if (!neighbour) return <span />;
  const isNext = direction === "next";

  return (
    <Link className={`btn ${isNext ? "btn--primary" : "btn--secondary"}`} href={`/aulas/${neighbour.id}`}>
      {isNext ? null : <ArrowLeft aria-hidden />}
      <span className={`lesson-pager__stack${isNext ? " lesson-pager__next" : ""}`}>
        <span className="lesson-pager__eyebrow">{isNext ? "Próxima aula" : "Aula anterior"}</span>
        <span className="lesson-pager__title">{neighbour.title}</span>
      </span>
      {isNext ? <ArrowRight aria-hidden /> : null}
    </Link>
  );
}

interface Props {
  course: Course;
  view: LessonViewData;
  /** URL assinada do vídeo, emitida pelo servidor. */
  mediaSrc: string;
  materials: LessonMaterial[];
  comments: Comment[];
  authorInitials: string;
  /** Quem está lendo: decide quais comentários oferecem excluir. */
  viewerId: string;
  /** Autor do curso: o instrutor modera o que está no curso dele. */
  courseAuthorId: string;
  /** Pacote SCORM da aula, quando é uma. */
  scorm?: { src: string; initial: ScormInitial };
}

/* `course` continua no contrato — as telas o passam e o breadcrumb vai usá-lo —
   mas ainda não é lido aqui, então não é desestruturado. */
export function LessonView({
  view,
  mediaSrc,
  materials,
  comments,
  authorInitials,
  viewerId,
  courseAuthorId,
  scorm,
}: Props) {
  const [railOpen, setRailOpen] = useState(true);
  const [materialNotice, setMaterialNotice] = useState<string | null>(null);

  /* O download é em dois passos: a rota confere a permissão e devolve uma URL
     assinada de vida curta, e o navegador então busca o arquivo direto no
     storage. O arquivo não passa pelo processo do Next — um PDF grande
     atravessando o servidor ocuparia o event loop. */
  async function baixar(material: LessonMaterial) {
    setMaterialNotice(null);

    try {
      const resposta = await fetch(
        `/api/materiais/${material.id}?aula=${encodeURIComponent(view.lesson.id)}`,
      );

      if (!resposta.ok) {
        setMaterialNotice("Não foi possível abrir este material.");
        return;
      }

      const { url } = (await resposta.json()) as { url: string };
      /* `noopener` porque a URL assinada aponta para outro host: sem isso a
         aba aberta ganharia referência ao `window` desta. */
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setMaterialNotice("Não foi possível falar com o servidor.");
    }
  }

  /* O player avisa a cada `timeupdate`, que dispara umas quatro vezes por
     segundo. Gravar tudo seria uma requisição a cada 250ms por espectador;
     com 200 pessoas assistindo, o banco levaria centenas por segundo. Guarda
     no máximo uma a cada 15 segundos de vídeo assistido, e o servidor só move
     a posição para frente (`GREATEST`), então perder a última não retrocede
     nada. */
  const ultimoEnvio = useRef(0);

  /* Quando esta aula abriu. `useRef` e não `useState`: o valor é fixado na
     montagem e nunca muda, e guardá-lo em estado provocaria um render extra
     sem que nada aparecesse diferente na tela. */
  const abertaEm = useRef(Date.now());

  const enviarProgresso = useCallback(
    (currentSeconds: number) => {
      void fetch("/api/progresso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId: view.lesson.id, watchedSeconds: Math.floor(currentSeconds) }),
        /* `keepalive` para o último envio sobreviver a fechar a aba. */
        keepalive: true,
      }).catch(() => {
        /* Progresso é melhor-esforço: falhar aqui não pode interromper a aula.
           A próxima janela de 15s tenta de novo. */
      });
    },
    [view.lesson.id],
  );

  const handleProgress = useCallback(
    (currentSeconds: number, durationSeconds: number) => {
      if (!Number.isFinite(currentSeconds) || !Number.isFinite(durationSeconds)) return;
      if (Math.abs(currentSeconds - ultimoEnvio.current) < 15) return;
      ultimoEnvio.current = currentSeconds;
      enviarProgresso(currentSeconds);
    },
    [enviarProgresso],
  );

  /**
   * Grava a posição ao parar de assistir.
   *
   * O `timeupdate` só dispara com o vídeo rodando, e a janela de 15s existe
   * para não inundar o banco. As duas coisas juntas perdem exatamente o
   * momento que interessa para retomar: quem volta para rever um trecho e
   * pausa não gera mais nenhum evento, e a última posição enviada continua
   * sendo a de antes — a pessoa retomaria adiante de onde parou.
   *
   * Aqui o envio é imediato e ignora a janela: pausar e sair são eventos
   * raros, não cabem no argumento de volume que justifica o throttle.
   */
  /**
   * Registra que a pessoa chegou a uma página do documento.
   *
   * É o rastro que libera o botão de concluir: sem ele, qualquer um marcaria a
   * aula como lida sem abrir o arquivo — e há cursos que existem justamente
   * para a pessoa passar pelo material inteiro.
   */
  const registrarPagina = useCallback(
    (page: number) => {
      void fetch("/api/progresso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId: view.lesson.id, pageSeen: page }),
        keepalive: true,
      }).catch(() => {
        /* Melhor-esforço, como o progresso de vídeo: a próxima virada de
           página tenta de novo. */
      });
    },
    [view.lesson.id],
  );

  const handlePause = useCallback(
    (currentSeconds: number) => {
      if (!Number.isFinite(currentSeconds)) return;
      ultimoEnvio.current = currentSeconds;
      enviarProgresso(currentSeconds);
    },
    [enviarProgresso],
  );

  return (
    <div className="lesson-page">
      <div className="lesson-main">
        <div className="lesson-topline">
          
          <span className="lesson-topline__spacer" />
          <button
            type="button"
            className="btn btn--secondary lesson-rail-toggle"
            aria-expanded={railOpen}
            aria-controls="rail"
            onClick={() => setRailOpen((value) => !value)}
          >
            <ListVideo aria-hidden /> Aulas
          </button>
        </div>

        {/* Vídeo tem player; o resto tem visualizador. A aula de texto não
            tem arquivo nenhum — o conteúdo é escrito no editor. */}
        {(view.lesson.kind ?? "video") === "video" ? (
          <VideoPlayer
            src={mediaSrc}
            label={`Aula ${view.index} — ${view.lesson.title}`}
            resumeAtSeconds={view.resumeAtSeconds}
            watchedUpTo={view.watchedUpToSeconds}
            onProgress={handleProgress}
            onPause={handlePause}
          />
        ) : view.lesson.kind === "scorm" && scorm ? (
          /* O SCORM traz o próprio player: o conteúdo controla a navegação, o
             progresso e a conclusão. A plataforma só hospeda e escuta. */
          <ScormPlayer
            lessonId={view.lesson.id}
            src={scorm.src}
            title={view.lesson.title}
            initial={scorm.initial}
          />
        ) : view.lesson.kind === "interactive" ? (
          /* Conteúdo interativo (F6-05): o player busca o próprio conteúdo,
             porque ele depende das respostas de QUEM está vendo — e essas não
             cabem no dado que a página já carregou para todo mundo. */
          <InteractivePlayer lessonId={view.lesson.id} />
        ) : view.lesson.kind === "text" ? (
          <article className="doc doc--text">{view.lesson.textContent}</article>
        ) : (
          <DocumentViewer
            src={view.lesson.kind === "link" ? (view.lesson.externalUrl ?? "#") : mediaSrc}
            kind={view.lesson.kind ?? "document"}
            title={view.lesson.title}
            {...(view.lesson.pageCount ? { pageCount: view.lesson.pageCount } : {})}
            pagesSeen={view.pagesSeen ?? []}
            onPageSeen={registrarPagina}
          />
        )}

        <div className="lesson-head">
          <div className="lesson-head__text">
            <div className="lesson-head__meta">
              <span className="badge">
                Aula {view.index} de {view.outline.lessonCount}
              </span>
              <span className="badge badge--neutral">
                <Clock aria-hidden /> {view.duration}
              </span>
              {view.completed ? (
                <span className="badge badge--success">
                  <CircleCheckBig aria-hidden /> Concluída
                </span>
              ) : null}
            </div>
            <h1 className="lesson-head__title">{view.lesson.title}</h1>
          </div>

          <div className="lesson-head__actions">
            {/* Salvar aula ainda não tem persistência (favoritar existe só
                para curso, via matrícula). Desabilitado em vez de inerte:
                botão que aceita clique e não faz nada parece defeito. */}
            <button
              type="button"
              className="icon-button"
              aria-label="Salvar aula (ainda não disponível)"
              title="Salvar aula ainda não está disponível"
              disabled
            >
              <Bookmark aria-hidden />
            </button>
            <CompleteLessonButton
              lessonId={view.lesson.id}
              completed={view.completed}
              {...(view.lesson.pageCount ? { pageCount: view.lesson.pageCount } : {})}
              openedAt={abertaEm.current}
            />
          </div>
        </div>

        <section className="course-section">
          <h2 className="course-section__title">Materiais da aula</h2>

          {materials.length > 0 ? (
            <>
              <div className="materials">
                {materials.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    className="material"
                    onClick={() => void baixar(material)}
                  >
                    <span className="material__icon">
                      <FileText aria-hidden />
                    </span>
                    <span className="material__name">{material.name}</span>
                    <span className="material__meta">{material.sizeLabel}</span>
                    <span className="material__download">
                      <ArrowRight aria-hidden />
                    </span>
                  </button>
                ))}
              </div>
              <p className="status-text" role="status">
                {materialNotice}
              </p>
            </>
          ) : (
            <div className="empty">
              <FluidWave variant="band" className="empty__wave" />
              <div className="empty__inner">
                <span className="empty__icon">
                  <FileText aria-hidden />
                </span>
                <h3 className="empty__title">Nenhum material nesta aula</h3>
                <p className="empty__text">
                  Quando o instrutor anexar PDFs ou planilhas, eles aparecem aqui para download.
                </p>
              </div>
            </div>
          )}
        </section>

        <Feature is="comentarios">
        <CommentThread
          comments={comments}
          lessonId={view.lesson.id}
          authorInitials={authorInitials}
          viewerId={viewerId}
          courseAuthorId={courseAuthorId}
        />
        </Feature>

        <nav className="lesson-pager" aria-label="Navegação entre aulas">
          <Pager neighbour={view.previous} direction="previous" />
          <Pager neighbour={view.next} direction="next" />
        </nav>
      </div>

      <aside className="rail" id="rail" aria-label="Conteúdo do curso" hidden={!railOpen}>
        <div className="rail__head">
          <div className="rail__title-row">
            <h2 className="rail__title">Conteúdo do curso</h2>
            <span className="rail__count">{plural(view.outline.lessonCount, "aula")}</span>
            <button
              type="button"
              className="icon-button rail__close"
              aria-label="Fechar lista de aulas"
              onClick={() => setRailOpen(false)}
            >
              <X aria-hidden />
            </button>
          </div>
          <div>
            <div className="progress-legend">
              <span>Seu progresso</span>
              <span className="progress-legend__value">{view.outline.progress.percent}%</span>
            </div>
            <ProgressBar percent={view.outline.progress.percent} />
          </div>
        </div>

        <div className="rail__list">
          {view.outline.modules.map((module, index) => (
            <div className="rail__module" key={module.id}>
              <div className="rail__module-head">
                <span className="rail__module-title">
                  Módulo {index + 1} — {module.title}
                </span>
                <span className="rail__module-percent" data-complete={module.progress.percent === 100}>
                  {module.progress.percent}%
                </span>
              </div>

              {module.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  className="lesson"
                  href={`/aulas/${lesson.id}`}
                  data-state={lesson.state}
                  {...(lesson.state === "current" ? { "aria-current": true as const } : {})}
                >
                  <span className="lesson__marker">
                    {lesson.state === "done" ? (
                      <Check aria-hidden strokeWidth={3} />
                    ) : lesson.state === "current" ? (
                      <Play aria-hidden />
                    ) : (
                      lesson.index
                    )}
                  </span>
                  <span className="lesson__title">{lesson.title}</span>
                  <span className="sr-only">{LESSON_LABEL[lesson.state]}</span>
                  <span className="lesson__duration">{lesson.duration}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
