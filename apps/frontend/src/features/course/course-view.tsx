"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Award, Check, ChevronRight, Clock, Layers, ListVideo, Play, MessageSquare } from "lucide-react";

import { FluidWave } from "@/components/brand/fluid-wave.tsx";
import { SaveButton } from "@/features/catalog/save-button.tsx";
import { Feature } from "@/features/tenant/feature-context.tsx";
import { useFeature } from "@/features/tenant/feature-context.tsx";
import { ProgressBar } from "@/features/dashboard/dashboard-view.tsx";
import type { CourseOutline, OutlineModule } from "@nerdlms/core/courses/outline.ts";
import type { Course } from "@nerdlms/core/courses/types.ts";

import "./course.css";
import { plural } from "@nerdlms/core/courses/plural.ts";

const LESSON_LABEL = {
  done: "Aula concluída",
  current: "Aula atual",
  todo: "Aula não iniciada",
} as const;

function Module({ module, position, defaultOpen }: { module: OutlineModule; position: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="module">
      <button
        type="button"
        className="module__head"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight className="module__chevron" aria-hidden />
        <span className="module__title">
          Módulo {position} — {module.title}
        </span>
        <span className="module__count">{plural(module.lessonCount, "aula")}</span>
        <span className="module__bar">
          <ProgressBar percent={module.progress.percent} />
        </span>
        <span className="module__percent" data-complete={module.progress.percent === 100}>
          {module.progress.percent}%
        </span>
      </button>

      <div className="module__panel" id={panelId} hidden={!open}>
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
    </div>
  );
}

type TabId = "content" | "about";

export function CourseView({
  course,
  outline,
  enrolled,
  saved,
}: {
  course: Course;
  outline: CourseOutline;
  enrolled: boolean;
  saved: boolean;
}) {
  const podeFavoritar = useFeature("favoritos");
  const [tab, setTab] = useState<TabId>("content");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "content", label: "Conteúdo" },
    { id: "about", label: "Sobre" },
  ];

  /** Setas movem a seleção, como manda o padrão ARIA de tablist. */
  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next) {
      setTab(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    }
  }

  return (
    <div className="course">
      

      <section className="course-hero">
        <FluidWave variant="blob" className="course-hero__wave" />

        <div className="course-hero__body">
          <h1 className="course-hero__title">{course.title}</h1>
          <p className="course-hero__summary">{course.summary}</p>

          <div className="course-hero__meta">
            <span className="badge badge--on-brand">
              <Layers aria-hidden /> {plural(outline.modules.length, "módulo")}
            </span>
            <span className="badge badge--on-brand">
              <ListVideo aria-hidden /> {plural(outline.lessonCount, "aula")}
            </span>
            <span className="badge badge--on-brand">
              <Clock aria-hidden /> {outline.duration}
            </span>
          </div>

          <div className="course-hero__progress">
            <div className="progress-legend">
              <span>Seu progresso</span>
              <span className="progress-legend__value">{outline.progress.percent}%</span>
            </div>
            <ProgressBar percent={outline.progress.percent} onBrand />
          </div>

          <div className="course-hero__actions">
            {/* Três situações, não duas. "Curso concluído" aparecia também em
                curso SEM AULAS, porque `currentLessonId` é null nos dois
                casos, e "Continuar" aparecia para quem nunca tinha começado. */}
            {outline.currentLessonId ? (
              <Link className="btn btn--primary btn--on-brand" href={`/aulas/${outline.currentLessonId}`}>
                <Play aria-hidden /> {enrolled ? "Continuar curso" : "Começar curso"}
              </Link>
            ) : outline.lessonCount === 0 ? (
              <span className="badge badge--on-brand">Curso ainda sem aulas</span>
            ) : (
              <span className="badge badge--on-brand">
                <Award aria-hidden /> Curso concluído
              </span>
            )}

            {/* O fórum some quando o cliente desliga a feature — o `Feature`
                resolve isso sem a página precisar saber. */}
            <Feature is="forum">
              <Link className="btn btn--secondary btn--on-brand" href={`/cursos/${course.slug}/forum`}>
                <MessageSquare aria-hidden /> Fórum
              </Link>
            </Feature>
            {/* `saved` vive na matrícula: sem ela não há onde gravar, então
                o marcador só aparece para quem está matriculado. */}
            {enrolled && podeFavoritar ? (
              <SaveButton
                courseId={course.id}
                saved={saved}
                className="icon-button icon-button--on-brand"
              />
            ) : null}
          </div>
        </div>

        <div className="course-hero__art" aria-hidden="true">
          <FluidWave variant="organic" />
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Seções do curso">
        {tabs.map(({ id, label }, index) => (
          <button
            key={id}
            type="button"
            className="tabs__tab"
            role="tab"
            id={`tab-${id}`}
            aria-controls={`painel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="course-section" role="tabpanel" id="painel-content" aria-labelledby="tab-content" tabIndex={0} hidden={tab !== "content"}>
        <h2 className="course-section__title">Conteúdo do curso</h2>
        <div className="modules">
          {outline.modules.map((module, index) => (
            <Module
              key={module.id}
              module={module}
              position={index + 1}
              defaultOpen={module.id === outline.defaultOpenModuleId}
            />
          ))}
        </div>
      </section>

      <section className="course-section" role="tabpanel" id="painel-about" aria-labelledby="tab-about" tabIndex={0} hidden={tab !== "about"}>
        <div className="card card--reading">
          <h2 className="card__title">Sobre este curso</h2>
          <p className="course-prose">{course.summary}</p>
          <div className="course-hero__meta course-about__meta">
            <span className="badge">
              <Award aria-hidden /> Certificado incluso
            </span>
            <span className="badge badge--neutral">
              <Layers aria-hidden /> {plural(outline.modules.length, "módulo")}
            </span>
            <span className="badge badge--neutral">
              <Clock aria-hidden /> {outline.duration}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
