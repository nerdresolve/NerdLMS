import { AlertTriangle, CircleCheckBig, Clock, Target } from "lucide-react";

import { levelLabel } from "@nerdlms/core/competencies/proficiency.ts";
import type { PlanProgress } from "@nerdlms/core/competencies/proficiency.ts";

import "./profile-competencies.css";

/**
 * As competências de quem está logado, e o que falta — F6-02 (guia §20).
 *
 * Componente de SERVIDOR: só mostra, não interage. Nada aqui precisa de estado
 * no navegador, e um `"use client"` desnecessário mandaria React para o
 * navegador sem motivo.
 *
 * O que a tela responde, em ordem: o que eu já sei fazer, o que preciso saber,
 * e o que está prestes a vencer. A terceira é a que costuma pegar as pessoas de
 * surpresa — quem estava autorizado a fazer algo e deixou de estar sem notar.
 */

export interface ProfileCompetency {
  competencyId: string;
  name: string;
  frameworkName: string;
  levels: string[];
  level: number;
  /** ISO 8601, ou nulo quando não vence. */
  expiresAt: string | null;
  /** Origem da evidência vigente, para a pessoa saber de onde veio. */
  source: string;
  courseTitle: string | null;
}

export interface ProfilePlan {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  progress: PlanProgress;
  /** Rótulos dos níveis, por competência do plano. */
  levelsByCompetency: Record<string, string[]>;
}

const ORIGEM: Record<string, string> = {
  course: "Concluiu o curso",
  lesson: "Concluiu a aula",
  quiz: "Passou na prova",
  assignment: "Entregou o trabalho",
  manual: "Atestada pela liderança",
  external: "Formação externa",
};

function dataLonga(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** Vence nos próximos 60 dias? É o aviso que precisa chegar antes do prazo. */
function venceEmBreve(iso: string | null): boolean {
  if (!iso) return false;

  const limite = new Date();
  limite.setDate(limite.getDate() + 60);

  return new Date(iso) <= limite;
}

export function ProfileCompetencies({
  competencies,
  plans,
}: {
  competencies: ProfileCompetency[];
  plans: ProfilePlan[];
}) {
  if (competencies.length === 0 && plans.length === 0) return null;

  return (
    <section className="course-section" aria-labelledby="minhas-competencias">
      <h2 className="course-section__title" id="minhas-competencias">
        <Target aria-hidden /> Competências
      </h2>

      {plans.length > 0 ? (
        <div className="pcomp__planos">
          {plans.map((plan) => (
            <article className="pcomp__plano" key={plan.id}>
              <header className="pcomp__plano-cabeca">
                <div>
                  <h3 className="pcomp__plano-nome">{plan.name}</h3>
                  {plan.dueDate ? (
                    <p className="pcomp__prazo">Prazo: {dataLonga(plan.dueDate)}</p>
                  ) : null}
                </div>

                <span className="pcomp__percent">
                  {plan.progress.met} de {plan.progress.total}
                </span>
              </header>

              {/* A barra e o número dizem a mesma coisa: quem não distingue a
                  cor da barra lê o "3 de 5" ao lado. */}
              <div
                className="pcomp__barra"
                role="progressbar"
                aria-valuenow={plan.progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${plan.name}: ${plan.progress.percent}% concluído`}
              >
                <span style={{ width: `${plan.progress.percent}%` }} />
              </div>

              {plan.progress.gaps.length === 0 ? (
                <p className="pcomp__completo">
                  <CircleCheckBig aria-hidden /> Você cumpre todas as competências deste plano.
                </p>
              ) : (
                <ul className="pcomp__gaps">
                  {plan.progress.gaps.map((gap) => {
                    const escala = plan.levelsByCompetency[gap.competencyId] ?? [];

                    return (
                      <li
                        className="pcomp__gap"
                        key={gap.competencyId}
                        data-vencido={gap.expired || undefined}
                      >
                        <span className="pcomp__gap-nome">{gap.competencyName}</span>

                        <span className="pcomp__gap-estado">
                          {/* Vencido e "nunca teve" são gaps diferentes: o
                              primeiro é reciclagem, o segundo é formação. */}
                          {gap.expired ? (
                            <>
                              <AlertTriangle aria-hidden /> Venceu — precisa renovar
                            </>
                          ) : gap.currentLevel > 0 ? (
                            <>
                              {levelLabel(escala, gap.currentLevel)} → precisa de{" "}
                              {levelLabel(escala, gap.requiredLevel)}
                            </>
                          ) : (
                            <>Falta: {levelLabel(escala, gap.requiredLevel)}</>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {competencies.length > 0 ? (
        <>
          <h3 className="pcomp__subtitulo">O que você já demonstrou</h3>

          <ul className="pcomp__lista">
            {competencies.map((competency) => (
              <li className="pcomp__item" key={competency.competencyId}>
                <div className="pcomp__dados">
                  <strong>{competency.name}</strong>
                  <span className="pcomp__meta">
                    {competency.frameworkName}
                    <span aria-hidden> · </span>
                    {ORIGEM[competency.source] ?? "Registrada"}
                    {competency.courseTitle ? ` "${competency.courseTitle}"` : ""}
                  </span>

                  {venceEmBreve(competency.expiresAt) ? (
                    <span className="pcomp__vencendo">
                      <Clock aria-hidden /> Vence em {dataLonga(competency.expiresAt!)}
                    </span>
                  ) : competency.expiresAt ? (
                    <span className="pcomp__meta">
                      Válida até {dataLonga(competency.expiresAt)}
                    </span>
                  ) : null}
                </div>

                <span className="pcomp__nivel">
                  {levelLabel(competency.levels, competency.level)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
