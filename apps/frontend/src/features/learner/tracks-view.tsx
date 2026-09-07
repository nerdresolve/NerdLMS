import Link from "next/link";
import { Check, Lock, Play, Route, Sparkles } from "lucide-react";

import { FluidWave } from "@/components/brand/fluid-wave.tsx";
import { ProgressBar } from "@/features/dashboard/dashboard-view.tsx";
import type { TracksPageData } from "./data.ts";

import "@/features/tracks/tracks.css";

const STATE_LABEL = {
  completed: "Concluído",
  current: "Em andamento",
  available: "Disponível",
  locked: "Bloqueado",
} as const;

/**
 * Trilhas e recomendações.
 *
 * O passo bloqueado aparece — não some da lista. Ver o que vem depois é o que
 * dá sentido à trilha; esconder deixaria a pessoa sem saber onde ela termina.
 */
export function TracksView({
  tracks,
  recommended,
  unitLower,
}: Omit<TracksPageData, "student"> & { unitLower: string }) {
  return (
    <div className="tracks">
      <div className="page-head">
        <h1 className="page-head__greeting">Trilhas</h1>
        <p className="page-head__sub">
          Sequências de cursos pensadas para uma função. Uma etapa abre a seguinte.
        </p>
      </div>

      {tracks.length > 0 ? (
        tracks.map((view) => (
          <section className="track" key={view.track.id} aria-labelledby={`trilha-${view.track.id}`}>
            <div className="track__head">
              <div className="track__text">
                <h2 className="track__title" id={`trilha-${view.track.id}`}>
                  {view.track.title}
                </h2>
                <p className="track__summary">{view.track.summary}</p>
              </div>
              <span className="badge">
                {view.completedCourses} de {view.totalCourses}
              </span>
            </div>

            <div className="track__progress"><ProgressBar percent={view.percent} /></div>

            <ol className="journey">
              {view.steps.map((step) => (
                <li className="step" key={step.course.id} data-state={step.state}>
                  <span className="step__marker" aria-hidden="true">
                    {step.state === "completed" ? <Check /> : step.state === "locked" ? <Lock /> : <Play />}
                  </span>

                  <span className="step__body">
                    <span className="step__title">{step.course.title}</span>
                    <span className="step__hint">
                      {STATE_LABEL[step.state]} · {step.percent}%
                    </span>
                  </span>

                  {step.state === "locked" ? (
                    <span className="step__hint">Conclua a etapa anterior</span>
                  ) : (
                    <Link className="btn btn--secondary" href={`/cursos/${step.course.slug}`}>
                      {step.state === "completed" ? "Rever" : "Continuar"}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))
      ) : (
        <div className="empty">
          <FluidWave variant="band" className="empty__wave" />
          <div className="empty__inner">
            <span className="empty__icon">
              <Route aria-hidden />
            </span>
            <h2 className="empty__title">Nenhuma trilha para a sua {unitLower}</h2>
            <p className="empty__text">
              Quando uma trilha for publicada para a sua área, ela aparece aqui.
            </p>
          </div>
        </div>
      )}

      {recommended.length > 0 ? (
        <section className="course-section" aria-labelledby="recomendados">
          <h2 className="course-section__title" id="recomendados">
            <Sparkles aria-hidden /> Recomendados para você
          </h2>
          <div className="recommendations">
            {recommended.map(({ course, reason }) => (
              <article className="recommendation" key={course.id}>
                <h3 className="recommendation__title">
                  <Link href={`/cursos/${course.slug}`}>{course.title}</Link>
                </h3>
                <p className="recommendation__reason">{reason}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
