import { Award, CircleCheck, TrendingUp, Users } from "lucide-react";

import { FluidWave } from "@/components/brand/fluid-wave.tsx";
import type { EngagementPageData } from "./data.ts";

/* `profile.css` entra pelo grid `.profile-stats`, que arruma os quatro números
   em linha. A regra nasceu no perfil, mas é a mesma faixa de indicadores —
   duplicá-la aqui criaria duas versões do mesmo layout. */
import "@/features/profile/profile.css";
import "@/features/studio/studio.css";

const STATUS_LABEL = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
} as const;

/**
 * Engajamento dos cursos do instrutor.
 *
 * Os quatro números do topo respondem "meus cursos estão sendo usados?"; a
 * quebra por curso responde "qual deles"; e a tabela de alunos responde "quem
 * travou onde" — que é a pergunta que leva alguém a agir.
 */
export function EngagementView({ summary, learners, courses }: Omit<EngagementPageData, "instructor">) {
  const stats = [
    { Icon: Users, value: String(summary.learners), label: "alunos nos seus cursos" },
    { Icon: Award, value: String(summary.enrollments), label: "matrículas ativas" },
    { Icon: TrendingUp, value: `${summary.averagePercent}%`, label: "progresso médio" },
    { Icon: CircleCheck, value: String(summary.completions), label: "conclusões" },
  ];

  return (
    <div className="studio">
      <div className="studio__head">
        <div className="studio__head-text">
          <h1 className="page-head__greeting">Engajamento</h1>
          <p className="page-head__sub">
            Como os seus cursos estão sendo usados. Só aparecem cursos de sua autoria.
          </p>
        </div>
      </div>

      <section className="course-section" aria-labelledby="numeros">
        <h2 className="course-section__title" id="numeros">
          Visão geral
        </h2>
        <div className="profile-stats">
          {stats.map(({ Icon, value, label }) => (
            <article className="stat-card" key={label}>
              <span className="stat-card__icon">
                <Icon aria-hidden />
              </span>
              <span className="stat-card__value">{value}</span>
              <span className="stat-card__label">{label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="course-section" aria-labelledby="por-curso">
        <h2 className="course-section__title" id="por-curso">
          Por curso
        </h2>

        {courses.length > 0 ? (
          <div className="breakdown">
            {courses.map(({ course, engagement }) => (
              <div className="breakdown__row" key={course.id}>
                <span className="breakdown__label">{course.title}</span>
                <span className="breakdown__value">
                  {engagement.learners} {engagement.learners === 1 ? "aluno" : "alunos"} ·{" "}
                  {engagement.averagePercent}% médio · {engagement.completed} concluíram
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="status-text">Nenhum curso de sua autoria ainda.</p>
        )}
      </section>

      <section className="course-section" aria-labelledby="alunos">
        <h2 className="course-section__title" id="alunos">
          Alunos
        </h2>

        {learners.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Progresso de cada aluno nos seus cursos</caption>
              <thead>
                <tr>
                  <th scope="col">Aluno</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Progresso</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((row) => (
                  <tr key={`${row.learnerId}-${row.courseId}`}>
                    <td>{row.learnerName}</td>
                    <td>{row.courseTitle}</td>
                    <td>{row.percent}%</td>
                    <td>
                      <span
                        className={`badge${row.status === "completed" ? " badge--success" : row.status === "not_started" ? " badge--pending" : ""}`}
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <FluidWave variant="band" className="empty__wave" />
            <div className="empty__inner">
              <span className="empty__icon">
                <Users aria-hidden />
              </span>
              <h3 className="empty__title">Nenhum aluno matriculado ainda</h3>
              <p className="empty__text">
                Assim que alguém for matriculado nos seus cursos, o progresso aparece aqui.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
