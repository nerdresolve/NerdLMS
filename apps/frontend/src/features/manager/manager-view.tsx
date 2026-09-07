import { Award, Download, Layers, TrendingUp, Users } from "lucide-react";

import type { ManagerPageData } from "./data.ts";

import "@/features/profile/profile.css";
import "@/features/studio/studio.css";

/**
 * Painel do gestor.
 *
 * Tudo aqui é recortado pelo projeto dele. O subtítulo diz qual é, porque um
 * número sem recorte explícito é um número que alguém vai ler como se fosse da
 * plataforma inteira.
 *
 * O TÍTULO NÃO CARREGA O RÓTULO DA UNIDADE
 *
 * Era "Painel da {unidade}", e a unidade é palavra do cliente: com "Campo" saía
 * "Painel da campo". Não há como acertar o artigo sem saber o gênero de um termo
 * que ainda não foi cadastrado, e inventá-lo por terminação erra em "filial" e
 * em "unidade". O título passa a ser o mesmo do menu, que não precisa dele.
 */
export function ManagerView({
  project,
  stats,
  courses,
}: Omit<ManagerPageData, "manager" | "team">) {
  const cards = [
    { Icon: Users, value: String(stats.people), label: `pessoas em ${project}` },
    { Icon: TrendingUp, value: String(stats.active30d), label: "ativos em 30 dias" },
    { Icon: Layers, value: String(stats.enrollments), label: "matrículas da equipe" },
    { Icon: Award, value: String(stats.completions), label: "cursos concluídos" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Painel da gestão</h1>
          <p className="page-head__sub">Somente pessoas e matrículas de {project}.</p>
        </div>

        {/* Links, não botões: o CSV é um arquivo que se baixa, e o servidor
            recorta o relatório pelo projeto de quem pede. */}
        <div className="page-head__actions">
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
                  <th scope="col" data-num>Pessoas</th>
                  <th scope="col" data-num>Progresso médio</th>
                  <th scope="col" data-num>Concluíram</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(({ course, learners, averagePercent, completed }) => (
                  <tr key={course.id}>
                    <td data-label="Curso">{course.title}</td>
                    <td data-label="Pessoas" data-num>{learners}</td>
                    <td data-label="Progresso médio" data-num>{averagePercent}%</td>
                    <td data-label="Concluíram" data-num>{completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <span className="empty__rule" aria-hidden="true" />
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
