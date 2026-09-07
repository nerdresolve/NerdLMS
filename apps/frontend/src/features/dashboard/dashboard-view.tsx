import Link from "next/link";
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  Layers,
  Play,
} from "lucide-react";

import { BrandMosaic } from "@/components/brand/brand-mosaic.tsx";
import type { MosaicVariant } from "@nerdlms/core/brand/mosaic.ts";
import {
  courseDurationSeconds,
  courseProgress,
  formatDuration,
  greeting,
  resumePoint,
  type ProgressSummary,
} from "@nerdlms/core/courses/progress.ts";
import {
  ROTULO_CURTO_DO_ESTADO,
  type EstadoDoCurso,
} from "@nerdlms/core/courses/completion.ts";
import type { Course, Enrollment, Student } from "@nerdlms/core/courses/types.ts";

import "./dashboard.css";

export function ProgressBar({ percent, onBrand = false }: { percent: number; onBrand?: boolean }) {
  return (
    <div
      className={`progress-bar${onBrand ? " progress-bar--on-brand" : ""}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso do curso"
      style={{ "--value": `${percent}%` } as React.CSSProperties}
    >
      <div className="progress-bar__fill" />
    </div>
  );
}

const ART_CLASS = ["", " course-card__art--b", " course-card__art--c", " course-card__art--d"] as const;
const ART_TILE: MosaicVariant[] = ["art1", "art2", "art3", "art4"];

/**
 * @param level nível do título. No dashboard os cards ficam sob a seção
 * "Meus cursos" (h2), então são h3; no catálogo são o primeiro nível abaixo
 * do h1 da página. Pular nível quebra a navegação por headings.
 */
export function CourseCard({
  course,
  summary,
  level = 3,
  estado,
}: {
  course: Course;
  summary: ProgressSummary;
  level?: 2 | 3;
  estado?: EstadoDoCurso | undefined;
}) {
  /* O selo "Concluído" segue o estado do CURSO, e não o das aulas: com prova
     obrigatória, terminar o conteúdo não fecha o curso. Sem `estado` — quem
     montou a lista sem saber das provas — vale o de antes. */
  const done = estado ? estado === "concluido" : summary.status === "completed";
  const Title = `h${level}` as "h2" | "h3";

  return (
    <Link className="course-card" href={`/cursos/${course.slug}`}>
      <div className={`course-card__art${ART_CLASS[course.artwork]}`}>
        <BrandMosaic variant={ART_TILE[course.artwork] ?? "organic"} tone="silhueta" />
        {done ? (
          <span className="course-card__chip course-card__chip--done">
            <CheckCircle2 aria-hidden /> Concluído
          </span>
        ) : estado === "falta-prova" ? (
          /* O percentual das aulas NÃO serve aqui. Ele estampava "100%" num
             curso que ainda depende da prova, e o número é o que a pessoa lê
             antes de qualquer palavra do cartão: ela concluiria que acabou. */
          <span className="course-card__chip course-card__chip--prova">
            <ClipboardList aria-hidden /> {ROTULO_CURTO_DO_ESTADO["falta-prova"]}
          </span>
        ) : (
          <span className="course-card__chip">{summary.percent}%</span>
        )}
      </div>

      <div className="course-card__body">
        <Title className="course-card__title">{course.title}</Title>
        <p className="course-card__summary">{course.summary}</p>
        <div className="course-card__foot">
          <ProgressBar percent={summary.percent} />
          <span className="course-card__count">
            <Layers aria-hidden /> {summary.completed} de {summary.total} aulas ·{" "}
            {formatDuration(courseDurationSeconds(course))}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CoursesEmptyState() {
  return (
    <div className="empty">
      <span className="empty__rule" aria-hidden="true" />
      <div className="empty__inner">
        <span className="empty__icon">
          <GraduationCap aria-hidden />
        </span>
        <h3 className="empty__title">Você ainda não tem cursos</h3>
        <p className="empty__text">
          Assim que você for matriculado em um curso, ele aparece nesta lista. Fale com seu gestor para solicitar acesso.
        </p>
        <div className="empty__actions">
          <Link className="btn btn--secondary" href="/cursos">
            Ver catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}

const RING_RADIUS = 62;

interface Totals {
  lessons: number;
  completed: number;
  finishedCourses: number;
  totalCourses: number;
  watchedSeconds: number;
}

export function ProgressSummaryCard({ totals }: { totals: Totals }) {
  const percent = totals.lessons === 0 ? 0 : Math.round((totals.completed / totals.lessons) * 100);

  return (
    <aside className="card" aria-labelledby="seu-progresso">
      <h2 className="card__title" id="seu-progresso">
        Seu progresso
      </h2>

      <div className="ring">
        <svg className="ring__svg" viewBox="0 0 148 148" role="img" aria-label={`${percent}% das aulas concluídas`}>
          <circle className="ring__track" cx="74" cy="74" r={RING_RADIUS} />
          <circle
            className="ring__value"
            cx="74"
            cy="74"
            r={RING_RADIUS}
            /* `pathLength` reescala o traço para 100 unidades: o CSS anima de
               100 (vazio) até o valor sem precisar saber o raio. */
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={(100 - percent).toFixed(1)}
          />
        </svg>
        <span className="ring__label" aria-hidden="true">
          <span className="ring__percent">{percent}%</span>
          <span className="ring__caption">concluído</span>
        </span>
      </div>

      <dl className="stat-list">
        <div className="stat">
          <dt className="stat__label">
            <CheckCircle2 aria-hidden /> Aulas concluídas
          </dt>
          <dd className="stat__value">
            {totals.completed} de {totals.lessons}
          </dd>
        </div>
        <div className="stat">
          <dt className="stat__label">
            <Award aria-hidden /> Cursos concluídos
          </dt>
          <dd className="stat__value">
            {totals.finishedCourses} de {totals.totalCourses}
          </dd>
        </div>
        <div className="stat">
          <dt className="stat__label">
            <Clock aria-hidden /> Tempo assistido
          </dt>
          <dd className="stat__value">{formatDuration(totals.watchedSeconds)}</dd>
        </div>
      </dl>
    </aside>
  );
}

export interface DashboardData {
  student: Student;
  entries: Array<{
    course: Course;
    enrollment: Enrollment;
    /**
     * O estado do CURSO, prova incluída.
     *
     * Sem ele o painel contava como concluído quem terminou as aulas e ainda
     * devia a prova — e o mesmo curso aparecia com selo de "Concluído" no
     * cartão enquanto o certificado era recusado.
     */
    estado?: EstadoDoCurso;
  }>;
  /** Hora local do aluno, para a saudação. */
  hour: number;
}

export function DashboardView({ student, entries, hour }: DashboardData) {
  const rows = entries.map(({ course, enrollment, estado }) => ({
    course,
    enrollment,
    estado,
    summary: courseProgress(course, enrollment),
    resume: resumePoint(course, enrollment),
  }));

  const totals: Totals = {
    lessons: rows.reduce((sum, row) => sum + row.summary.total, 0),
    completed: rows.reduce((sum, row) => sum + row.summary.completed, 0),
    finishedCourses: rows.filter((row) =>
      row.estado ? row.estado === "concluido" : row.summary.status === "completed",
    ).length,
    totalCourses: rows.length,
    watchedSeconds: rows.reduce(
      (sum, row) => sum + Object.values(row.enrollment.progress).reduce((acc, item) => acc + item.watchedSeconds, 0),
      0,
    ),
  };

  // Destaque: curso mais avançado entre os que ainda têm aula pendente.
  const featured = rows
    .filter((row) => row.resume !== null && row.summary.completed > 0)
    .sort((a, b) => b.summary.percent - a.summary.percent)[0];

  return (
    /* A mesma coluna dos outros três painéis. Antes esta tela montava o próprio
       ritmo com margens soltas — 32px sob o cabeçalho, 48px sob a faixa — e as
       quatro portas de entrada do produto não batiam entre si. */
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">
            {greeting(hour)}, {student.firstName}
          </h1>
          {/* A frase anterior prometia "a poucas aulas do próximo certificado"
              para todo mundo, inclusive para quem está em 0%; a seguinte
              descrevia a tela com uma imagem ("o que ficou pela metade") que
              nada na tela sustenta. O subtítulo agora diz o que a página traz,
              no mesmo tom dos outros painéis. */}
          <p className="page-head__sub">Seus cursos e o progresso em cada um.</p>
        </div>
      </div>

      {/* SEM CURSO EM ANDAMENTO A FAIXA TEM UM CARTÃO SÓ.

          A grade é de duas colunas — 2,1fr para "Continue aprendendo" e 1fr
          para o resumo. Quando não há aula a retomar, o resumo caía sozinho na
          coluna larga e ficava metade vazio, com o gráfico encostado à
          esquerda. Com um cartão só, a faixa passa a ter uma coluna. */}
      <section
        className={`spotlight${featured?.resume ? "" : " spotlight--sozinha"}`}
        aria-label="Sua jornada"
      >
        {featured?.resume ? (
          <article className="continue">
            <BrandMosaic variant="layered" className="continue__waves" tone="silhueta" />
            <div className="continue__body">
              <span className="eyebrow">
                <Play aria-hidden /> Continue aprendendo
              </span>
              <h2 className="continue__title">{featured.course.title}</h2>
              <p className="continue__lesson">
                {featured.resume.module.title} · {featured.resume.lesson.title}
              </p>
              <p className="continue__meta">
                <Clock aria-hidden />{" "}
                {featured.resume.resumeAtSeconds >= 60
                  ? `Retoma em ${formatDuration(featured.resume.resumeAtSeconds)} de ${formatDuration(featured.resume.lesson.durationSeconds)}`
                  : `Aula de ${formatDuration(featured.resume.lesson.durationSeconds)}`}
              </p>

              <div className="continue__progress">
                <div className="progress-legend">
                  <span>Seu progresso no curso</span>
                  <span className="progress-legend__value">{featured.summary.percent}%</span>
                </div>
                <ProgressBar percent={featured.summary.percent} onBrand />
              </div>

              <Link className="btn btn--primary btn--on-brand" href={`/cursos/${featured.course.slug}`}>
                Continuar aula
              </Link>
            </div>
          </article>
        ) : null}

        <ProgressSummaryCard totals={totals} />
      </section>

      <section aria-labelledby="meus-cursos">
        <div className="section-head">
          <h2 className="section-head__title" id="meus-cursos">
            Meus cursos
          </h2>
          <Link className="link" href="/cursos">
            Ver todos
          </Link>
        </div>

        {rows.length === 0 ? (
          <CoursesEmptyState />
        ) : (
          <div className="course-grid">
            {rows.map(({ course, summary, estado }) => (
              /* `estado` também: sem ele o selo "Concluído" voltava a sair das
                 aulas, e o cartão contradizia a contagem logo acima — que já
                 conta o curso como pendente enquanto a prova não sai. */
              <CourseCard key={course.id} course={course} summary={summary} estado={estado} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
