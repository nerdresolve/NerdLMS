import { Award, CircleCheck, Info, TrendingUp, Users } from "lucide-react";

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
export function EngagementView({
  summary,
  learners,
  courses,
  aproveitamento,
  leitura,
}: Omit<EngagementPageData, "instructor">) {
  const stats = [
    { Icon: Users, value: String(summary.learners), label: "alunos nos seus cursos" },
    { Icon: Award, value: String(summary.enrollments), label: "matrículas ativas" },
    { Icon: TrendingUp, value: `${summary.averagePercent}%`, label: "progresso médio" },
    { Icon: CircleCheck, value: String(summary.completions), label: "conclusões" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          {/* Esta é a tela em que o instrutor cai ao entrar, então ela se
              anuncia como painel. "Engajamento" nomeava bem uma aba escondida
              no meio do menu; como porta de entrada, não dizia de quem era. */}
          <h1 className="page-head__title">Painel do instrutor</h1>
          <p className="page-head__sub">Somente os cursos de sua autoria.</p>
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

      {/* Em que tentativa as pessoas passam.

          A taxa de aprovação sozinha não distingue uma prova calibrada de uma
          aula que não prepara para ela: nas duas o total pode ser o mesmo. O
          que separa as duas leituras é a proporção de quem passa de primeira. */}
      <section className="course-section" aria-labelledby="aproveitamento">
        <h2 className="course-section__title" id="aproveitamento">
          Aproveitamento nas provas
        </h2>

        {aproveitamento.tentaram === 0 ? (
          <p className="platform__hint">
            Ninguém enviou prova nos seus cursos ainda.
          </p>
        ) : (
          <>
            <p className="status-text">
              {aproveitamento.tentaram}{" "}
              {aproveitamento.tentaram === 1 ? "pessoa enviou" : "pessoas enviaram"} prova ·{" "}
              {aproveitamento.taxaDeAprovacao}% aprovadas ·{" "}
              {aproveitamento.mediaAteAprovar.toFixed(1).replace(".", ",")} tentativas em média
            </p>

            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">
                  Distribuição de aprovação por número de tentativas
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Resultado</th>
                    <th scope="col" data-num>Pessoas</th>
                    <th scope="col" data-num>Percentual</th>
                  </tr>
                </thead>
                <tbody>
                  {aproveitamento.faixas.map((faixa) => (
                    <tr key={faixa.rotulo} data-sem-aprovacao={faixa.tentativa === null}>
                      <td data-label="Resultado">{faixa.rotulo}</td>
                      <td data-label="Pessoas" data-num>{faixa.pessoas}</td>
                      <td data-label="Percentual" data-num>{faixa.percentual}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* A leitura só aparece com dados suficientes. Abaixo disso a
                função devolve null, porque cinco pessoas não sustentam
                conclusão sobre calibragem de prova. */}
            {leitura ? (
              <p className="engagement__leitura">
                <Info aria-hidden /> {leitura}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="course-section" aria-labelledby="por-curso">
        <h2 className="course-section__title" id="por-curso">
          Por curso
        </h2>

        {courses.length > 0 ? (
          /* As mesmas quatro colunas do painel da gestão, na mesma tabela. Era
             uma linha de texto por curso — "5 alunos · 20% médio · 1 concluíram"
             —, e três números escritos em prosa não se alinham entre as linhas:
             comparar dois cursos exigia ler as duas frases inteiras. */
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Engajamento em cada curso de sua autoria</caption>
              <thead>
                <tr>
                  <th scope="col">Curso</th>
                  <th scope="col" data-num>Alunos</th>
                  <th scope="col" data-num>Progresso médio</th>
                  <th scope="col" data-num>Concluíram</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(({ course, engagement }) => (
                  <tr key={course.id}>
                    <td data-label="Curso">{course.title}</td>
                    <td data-label="Alunos" data-num>{engagement.learners}</td>
                    <td data-label="Progresso médio" data-num>{engagement.averagePercent}%</td>
                    <td data-label="Concluíram" data-num>{engagement.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          /* Uma linha por aluno POR CURSO: com trinta e seis matrículas a
             tabela já respondia por dois terços da altura da página, e cresce
             com a base. Rola dentro de si, com o cabeçalho fixo — cortar em N
             linhas esconderia justamente quem ninguém procurou ainda. */
          <div className="table-wrap table-wrap--rolagem">
            <table className="table">
              <caption className="sr-only">Progresso de cada aluno nos seus cursos</caption>
              <thead>
                <tr>
                  <th scope="col">Aluno</th>
                  <th scope="col">Curso</th>
                  <th scope="col" data-num>Progresso</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((row) => (
                  <tr key={`${row.learnerId}-${row.courseId}`}>
                    <td data-label="Aluno">{row.learnerName}</td>
                    <td data-label="Curso">{row.courseTitle}</td>
                    <td data-label="Progresso" data-num>{row.percent}%</td>
                    <td data-label="Situação">
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
            <span className="empty__rule" aria-hidden="true" />
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
