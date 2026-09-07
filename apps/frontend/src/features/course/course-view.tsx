"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  ClipboardCheck,
  ChevronRight,
  Clock,
  Info,
  Layers,
  ListVideo,
  Play,
  MessageSquare,
} from "lucide-react";

import { BrandMosaic } from "@/components/brand/brand-mosaic.tsx";
import { SaveButton } from "@/features/catalog/save-button.tsx";
import { Feature } from "@/features/tenant/feature-context.tsx";
import { useFeature } from "@/features/tenant/feature-context.tsx";
import { ProgressBar } from "@/features/dashboard/dashboard-view.tsx";
import { PedidoDeReteste } from "@/features/quiz/retake-request.tsx";
import { ROTULO_DO_ESTADO, type EstadoDoCurso } from "@nerdlms/core/courses/completion.ts";
import { aboutSection, cargaFormatada, ROTULO_DO_NIVEL } from "@nerdlms/core/courses/about.ts";
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
          Módulo {position}: {module.title}
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

/**
 * O que a tela explica em cada situação.
 *
 * Fora do componente porque é texto, não lógica — e porque um objeto no corpo
 * do componente seria recriado a cada render sem necessidade nenhuma.
 */
const DICA_DA_PROVA: Record<string, string> = {
  visitante: "A prova fica disponível depois da matrícula, a tentativa pertence ao seu vínculo com o curso.",
  fazer: "A nota da prova entra no certificado: sem atingir o mínimo, concluir as aulas não basta.",
  "pedir-reteste": "Você usou sua tentativa. Refazer depende da liberação do instrutor do curso.",
  aguardando: "Seu pedido de reteste está com o instrutor. Você receberá um aviso com a resposta.",
  aprovado: "Você foi aprovado nesta prova. O certificado está liberado.",
  "sem-saida": "Esta prova não está disponível no momento.",
};

export function CourseView({
  course,
  outline,
  enrolled,
  saved,
  quiz,
  estado,
  podeEditar = false,
}: {
  course: Course;
  outline: CourseOutline;
  enrolled: boolean;
  saved: boolean;
  quiz: {
    id: string;
    title: string;
    notaMinima: number;
    questions: number;
    acao: "fazer" | "pedir-reteste" | "aguardando" | "aprovado" | "sem-saida";
    /** Quantas aulas faltam para a prova liberar. Zero significa liberada. */
    aulasRestantes: number;
    melhorNota: number | null;
  } | null;
  estado: EstadoDoCurso;
  /** Quem edita o curso vê o que falta preencher na aba Sobre. */
  podeEditar?: boolean;
}) {
  const podeFavoritar = useFeature("favoritos");
  const [tab, setTab] = useState<TabId>("content");

  const sobre = aboutSection(course);
  const carga = cargaFormatada(sobre.cargaMinutos);

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
              {/* O RÓTULO NÃO É O PERCENTUAL DAS AULAS.

                  A barra continua medindo consumo de aula — é o que ela sempre
                  mediu. O texto ao lado diz o estado do CURSO, que com prova
                  obrigatória é outra pergunta: dá para ter 100% das aulas e não
                  ter concluído. Antes as duas coisas eram a mesma, e o perfil
                  oferecia certificado que o servidor recusava. */}
              <span>{enrolled ? ROTULO_DO_ESTADO[estado] : "Seu progresso"}</span>
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

        {/* O grafismo mora NESTE painel, e não atrás do hero inteiro: a
            coluna da direita já é o lugar dele, com a máscara que dissolve a
            emenda. Havia os dois ao mesmo tempo, um por cima do outro, e o
            resultado era o mosaico lavado. */}
        <div className="course-hero__art" aria-hidden="true">
          <BrandMosaic variant="layered" tone="silhueta" />
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

        {/* A prova, depois dos módulos.

            Depois e não antes: a ordem da tela é a ordem do percurso, e a
            avaliação vem no fim. Aparece só para quem está matriculado —
            oferecer a prova a quem está visitando o catálogo prometeria uma
            porta que o servidor recusaria. */}
        {quiz ? (
          <div className="course-quiz" data-estado={quiz.acao}>
            <span className="course-quiz__icon" aria-hidden="true">
              <ClipboardCheck />
            </span>
            <div className="course-quiz__body">
              <h3 className="course-quiz__title">{quiz.title}</h3>
              <p className="course-quiz__meta">
                {quiz.questions} {quiz.questions === 1 ? "questão" : "questões"} · aprovação a
                partir de {quiz.notaMinima.toFixed(1).replace(".", ",")}
                {quiz.melhorNota !== null ? (
                  <>
                    {" · "}
                    <strong>sua nota: {quiz.melhorNota.toFixed(1).replace(".", ",")}</strong>
                  </>
                ) : null}
              </p>
              <p className="course-quiz__hint">
                {!enrolled
                  ? DICA_DA_PROVA.visitante
                  : quiz.acao === "fazer" && quiz.aulasRestantes > 0
                    ? "A prova é o fim do curso: ela libera quando você concluir todas as aulas."
                    : DICA_DA_PROVA[quiz.acao]}
              </p>
            </div>

            {/* O BLOCO APARECE SEMPRE; a ação, não.

                Cada estado tem uma saída e só uma. Antes havia um "Fazer a
                prova" fixo, que aparecia para quem já tinha sido aprovado e
                para quem não tinha mais tentativa — nos dois casos levando a
                uma recusa do servidor. */}
            {!enrolled ? (
              <span className="course-quiz__travada">Disponível após a matrícula</span>
            ) : quiz.acao === "fazer" && quiz.aulasRestantes > 0 ? (
              /* AINDA NÃO PODE FAZER: fica desabilitado, e não some.

                 Antes o botão levava à prova e o servidor recusava com "faltam
                 N aulas" numa tela de erro. Oferecer e depois negar é promessa
                 quebrada; pior, a tela de erro tira a pessoa do curso e ela
                 precisa achar o caminho de volta.

                 Desabilitado E explicado: botão inerte sem motivo é tão ruim
                 quanto o erro. */
              <span className="course-quiz__travada">
                {quiz.aulasRestantes === 1
                  ? "Falta 1 aula para liberar"
                  : `Faltam ${quiz.aulasRestantes} aulas para liberar`}
              </span>
            ) : quiz.acao === "fazer" ? (
              <Link className="btn btn--primary" href={`/provas/${quiz.id}`}>
                Fazer a prova
              </Link>
            ) : quiz.acao === "pedir-reteste" ? (
              /* O formulário no próprio lugar, e não um link para outra tela.

                 A primeira versão apontava para `/provas/[id]/reteste`, que não
                 existe — e mesmo a tela da prova recusaria, porque quem pede
                 reteste já gastou a tentativa. Pedir é uma ação sobre a prova,
                 não uma visita a ela. */
              <PedidoDeReteste quizId={quiz.id} />
            ): quiz.acao === "aprovado" ? (
              /* Aprovado tem uma ação, e é o certificado.
                 Dizer "o certificado está liberado" sem oferecer o documento
                 obriga a pessoa a procurar onde ele mora. */
              <a className="btn btn--primary" href={`/api/certificado?curso=${course.id}`}>
                <Award aria-hidden /> Baixar certificado
              </a>
            ) : (
              <span className="course-quiz__travada">Aguardando o instrutor</span>
            )}
          </div>
        ) : null}
      </section>

      <section className="course-section" role="tabpanel" id="painel-about" aria-labelledby="tab-about" tabIndex={0} hidden={tab !== "about"}>
        <div className="card card--reading">
          <h2 className="card__title">Sobre este curso</h2>
          <p className="course-prose">{course.summary}</p>

          {/* Os campos abaixo já eram preenchidos no editor e gravados no
              banco, e nenhum chegava ao aluno: a aba mostrava só o resumo de
              uma linha. Quem escrevia objetivo e público não via o resultado
              em lugar nenhum. */}
          {sobre.objetivos.length > 0 ? (
            <>
              <h3 className="course-about__titulo">O que você vai aprender</h3>
              <ul className="course-about__objetivos">
                {sobre.objetivos.map((objetivo) => (
                  <li key={objetivo}>
                    <Check aria-hidden /> {objetivo}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {sobre.publico ? (
            <>
              <h3 className="course-about__titulo">Para quem é</h3>
              <p className="course-prose">{sobre.publico}</p>
            </>
          ) : null}

          <dl className="course-about__ficha">
            {carga ? (
              <div>
                <dt>Carga horária</dt>
                {/* A carga DECLARADA, e não a soma dos vídeos: é ela que vai
                    para o certificado e para o relatório de compliance. */}
                <dd>{carga}</dd>
              </div>
            ) : null}
            {sobre.nivel ? (
              <div>
                <dt>Nível</dt>
                <dd>{ROTULO_DO_NIVEL[sobre.nivel]}</dd>
              </div>
            ) : null}
            <div>
              <dt>Conteúdo</dt>
              <dd>
                {plural(outline.modules.length, "módulo")}, {outline.duration} de vídeo
              </dd>
            </div>
            {sobre.idioma ? (
              <div>
                <dt>Idioma</dt>
                <dd>{sobre.idioma}</dd>
              </div>
            ) : null}
            {sobre.codigo ? (
              <div>
                <dt>Código</dt>
                <dd>{sobre.codigo}</dd>
              </div>
            ) : null}
          </dl>

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

          {/* Só para quem edita o curso. O aluno não tem o que fazer com a
              lista, e vê-la sugeriria que o curso está incompleto. */}
          {podeEditar && sobre.faltando.length > 0 ? (
            <p className="course-about__pendente">
              <Info aria-hidden /> Faltam preencher: {sobre.faltando.join(", ")}. O aluno
              não vê este aviso.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
