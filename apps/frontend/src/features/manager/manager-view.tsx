import { Award, Download, Layers, TrendingUp, Users } from "lucide-react";

import { FluidWave } from "@/components/brand/fluid-wave.tsx";
import type { ManagerPageData } from "./data.ts";

import "@/features/profile/profile.css";
import "@/features/studio/studio.css";

/**
 * Painel do gestor.
 *
 * Tudo aqui é recortado pelo projeto dele. O subtítulo diz qual é, porque um
 * número sem recorte explícito é um número que alguém vai ler como se fosse da
 * plataforma inteira.
 */
export function ManagerView({
  project,
  stats,
  courses,
  unitLower,
}: Omit<ManagerPageData, "manager" | "team"> & { unitLower: string }) {
  const cards = [
    { Icon: Users, value: String(stats.people), label: `pessoas em ${project}` },
    { Icon: TrendingUp, value: String(stats.active30d), label: "ativos em 30 dias" },
    { Icon: Layers, value: String(stats.enrollments), label: "matrículas da equipe" },
    { Icon: Award, value: String(stats.completions), label: "cursos concluídos" },
  ];

  return (
    <div className="studio">
      <div className="studio__head">
        <div className="studio__head-text">
          <h1 className="page-head__greeting">Painel da {unitLower}</h1>
          <p className="page-head__sub">
            Visão de {project}. Só aparecem pessoas e matrículas desta {unitLower}.
          </p>
        </div>

        {/* Links, não botões: o CSV é um arquivo que se baixa, e o servidor
            recorta o relatório pelo projeto de quem pede. */}
        <div className="studio-course__actions">
          <a className="btn btn--secondary" href="/api/relatorios?tipo=progresso">
            <Download aria-hidden /> Progresso
          </a>
          <a className="btn btn--secondary" href="/api/relatorios?tipo=usuarios">
            <Download aria-hidden /> Equipe
          </a>
        </div>
      </div>

      <section className="course-section" aria-labelledby="numeros">
        <h2 className="course-section__title" id="numeros">
          Visão geral
        </h2>
        <div className="profile-stats">
          {cards.map(({ Icon, value, label }) => (
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
          Desempenho da equipe por curso
        </h2>
        <p className="status-text">Somente cursos em que alguém de {project} está matriculado.</p>

        {courses.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Desempenho da equipe em cada curso</caption>
              <thead>
                <tr>
                  <th scope="col">Curso</th>
                  <th scope="col">Pessoas</th>
                  <th scope="col">Progresso médio</th>
                  <th scope="col">Concluíram</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(({ course, learners, averagePercent, completed }) => (
                  <tr key={course.id}>
                    <td>{course.title}</td>
                    <td>{learners}</td>
                    <td>{averagePercent}%</td>
                    <td>{completed}</td>
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
                <Layers aria-hidden />
              </span>
              <h3 className="empty__title">Nenhuma matrícula ainda</h3>
              <p className="empty__text">
                Assim que alguém da equipe for matriculado, o desempenho aparece aqui.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
