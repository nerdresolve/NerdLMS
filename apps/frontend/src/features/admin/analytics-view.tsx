import { AlertTriangle, Clock, TrendingDown, Users } from "lucide-react";

import type {
  AbandonedEnrollment,
  DepartmentPerformance,
  DropoffPoint,
  HabitMetrics,
  VideoRetention,
} from "@nerdlms/core/analytics/advanced.ts";

import "./analytics.css";

/**
 * Analytics avançado — F6-06 (guia §21).
 *
 * O §21 abre dizendo "não confunda analytics com simples contador de visitas".
 * Esta tela mostra o que os contadores não mostram: ONDE as pessoas param, até
 * que ponto do vídeo assistem, se voltam, e qual área precisa de ajuda.
 *
 * Componente de SERVIDOR: são números que já vêm calculados, e nada aqui muda
 * sem recarregar.
 */

export interface AnalyticsData {
  courseTitle: string;
  enrollments: number;
  dropoff: DropoffPoint[];
  worst: DropoffPoint | null;
  retention: VideoRetention[];
  habit: HabitMetrics;
  abandoned: AbandonedEnrollment[];
  departments: DepartmentPerformance[];
}

function minutos(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m > 0 ? `${m}min${s > 0 ? ` ${s}s` : ""}` : `${s}s`;
}

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  return (
    <>
      <section className="course-section" aria-labelledby="habito">
        <h2 className="course-section__title" id="habito">
          <Users aria-hidden /> Hábito de uso
        </h2>

        <p className="platform__hint">
          Volume de acesso não distingue mil visitas de cinquenta pessoas de mil visitas de
          novecentas. A aderência distingue.
        </p>

        <ul className="an__numeros">
          <li>
            <strong>{data.habit.dau}</strong>
            <span>pessoas por dia, em média</span>
          </li>
          <li>
            <strong>{data.habit.wau}</strong>
            <span>na última semana</span>
          </li>
          <li>
            <strong>{data.habit.mau}</strong>
            <span>no último mês</span>
          </li>
          <li className="an__destaque">
            <strong>{data.habit.stickiness}%</strong>
            <span>
              de aderência
              {/* A tradução em dias só aparece quando ela diz algo. Com
                  aderência baixa, "0 dias por mês" contradiz o próprio painel,
                  que mostra pessoas ativas logo ao lado. */}
              {data.habit.stickiness >= 4
                ? (() => {
                    const dias = Math.round((data.habit.stickiness / 100) * 30);
                    return ` — a pessoa média entra ${dias} ${dias === 1 ? "dia" : "dias"} por mês`;
                  })()
                : " — uso ainda esporádico"}
            </span>
          </li>
        </ul>
      </section>

      <section className="course-section" aria-labelledby="funil">
        <h2 className="course-section__title" id="funil">
          <TrendingDown aria-hidden /> Onde as pessoas param — {data.courseTitle}
        </h2>

        <p className="platform__hint">
          &ldquo;40% de conclusão&rdquo; não diz o que consertar. Esta lista diz: cada linha
          mostra quantos chegaram, quantos seguiram, e quantos pararam ali.
        </p>

        {data.worst ? (
          <div className="an__alerta" role="note">
            <AlertTriangle aria-hidden />
            <p>
              O maior abandono é em <strong>{data.worst.title}</strong>: de{" "}
              {data.worst.reached} pessoas que chegaram, <strong>{data.worst.droppedHere}</strong>{" "}
              pararam ali ({data.worst.dropoffPercent}%).
            </p>
          </div>
        ) : null}

        {data.dropoff.length === 0 ? (
          <p className="platform__hint">Este curso ainda não tem aulas.</p>
        ) : (
          <ol className="an__funil">
            {data.dropoff.map((ponto) => (
              <li
                className="an__etapa"
                key={ponto.lessonId}
                data-critica={ponto.dropoffPercent >= 30 || undefined}
              >
                <div className="an__etapa-nome">
                  <span className="an__pos">{ponto.position}</span>
                  <div>
                    <strong>{ponto.title}</strong>
                    <span className="an__modulo">{ponto.moduleTitle}</span>
                  </div>
                </div>

                {/* A barra E os números: quem não distingue a cor lê a
                    contagem ao lado. */}
                <div className="an__barra" aria-hidden>
                  <span style={{ width: `${ponto.retentionPercent}%` }} />
                </div>

                <div className="an__etapa-numeros">
                  <span>{ponto.completed} concluíram</span>
                  {ponto.droppedHere > 0 ? (
                    <span className="an__perda">
                      −{ponto.droppedHere} ({ponto.dropoffPercent}%)
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {data.retention.length > 0 ? (
        <section className="course-section" aria-labelledby="retencao">
          <h2 className="course-section__title" id="retencao">
            <Clock aria-hidden /> Retenção de vídeo
          </h2>

          <p className="platform__hint">
            Quanto do vídeo a pessoa média assiste. Um vídeo com muitos
            espectadores e retenção baixa é um vídeo que perde a atenção — não um
            vídeo que ninguém abriu.
          </p>

          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Retenção por vídeo</caption>
              <thead>
                <tr>
                  <th scope="col">Aula</th>
                  <th scope="col">Duração</th>
                  <th scope="col">Abriram</th>
                  <th scope="col">Assistiram em média</th>
                  <th scope="col">Retenção</th>
                  <th scope="col">Até o fim</th>
                </tr>
              </thead>
              <tbody>
                {data.retention.map((video) => (
                  <tr key={video.lessonId} data-baixa={video.retentionPercent < 50 || undefined}>
                    <td>{video.title}</td>
                    <td>{minutos(video.durationSeconds)}</td>
                    <td>{video.viewers}</td>
                    <td>{minutos(video.averageWatchedSeconds)}</td>
                    <td>{video.retentionPercent}%</td>
                    <td>{video.finished}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="course-section" aria-labelledby="areas">
        <h2 className="course-section__title" id="areas">
          Desempenho por unidade
        </h2>

        <p className="platform__hint">
          Ordenado pela <strong>pior</strong> taxa: quem abre este relatório quer saber onde
          intervir.
        </p>

        {data.departments.length === 0 ? (
          <p className="platform__hint">Nenhuma matrícula ainda.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Desempenho por unidade</caption>
              <thead>
                <tr>
                  <th scope="col">Unidade</th>
                  <th scope="col">Pessoas</th>
                  <th scope="col">Matrículas</th>
                  <th scope="col">Progresso médio</th>
                  <th scope="col">Concluíram</th>
                  <th scope="col">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((area) => (
                  <tr key={area.department} data-baixa={area.completionRate < 40 || undefined}>
                    <td>{area.department}</td>
                    <td>{area.learners}</td>
                    <td>{area.enrollments}</td>
                    <td>{area.averagePercent}%</td>
                    <td>{area.completed}</td>
                    <td>{area.completionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="course-section" aria-labelledby="abandono">
        <h2 className="course-section__title" id="abandono">
          Cursos abandonados
        </h2>

        <p className="platform__hint">
          Quem <strong>começou</strong>, não terminou, e parou de mexer há mais de 30 dias. Quem
          começou ontem não abandonou nada.
        </p>

        {data.abandoned.length === 0 ? (
          <p className="platform__hint">Ninguém parou no meio há mais de 30 dias.</p>
        ) : (
          <ul className="an__abandonos">
            {data.abandoned.slice(0, 20).map((item) => (
              <li key={`${item.learnerId}-${item.courseId}`}>
                <div>
                  <strong>{item.learnerName}</strong>
                  <span className="an__modulo">{item.courseTitle}</span>
                </div>
                <span className="an__parado">
                  {item.percent}% feito · parado há {item.daysIdle} dias
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
