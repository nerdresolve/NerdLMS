import Link from "next/link";
import { BookOpen, Pencil, Users } from "lucide-react";

import { DuplicateButton } from "./duplicate-button.tsx";

import { formatDuration } from "@nerdlms/core/courses/progress.ts";
import type { AuthoredCourse } from "./data.ts";
import { NewCourse } from "./new-course.tsx";

import "@/features/studio/studio.css";

const STATUS_LABEL = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
} as const;

/**
 * Lista de cursos do instrutor.
 *
 * Mostra o estado de publicação e quantos alunos há em cada curso, porque são
 * as duas perguntas que levam alguém a abrir esta tela: "o que ainda não
 * publiquei" e "o que está sendo usado".
 */
export function StudioView({ courses }: { courses: AuthoredCourse[] }) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          {/* O mesmo nome do item no menu. "Meus cursos" aparecia nos dois
              lados — aqui e no bloco do aluno — e o título da página repetia a
              ambiguidade em vez de resolvê-la. */}
          <h1 className="page-head__title">Cursos que ensino</h1>
          <p className="page-head__sub">
            Cursos de sua autoria. Você edita e publica os seus; os de outros instrutores não aparecem aqui.
          </p>
        </div>
        <NewCourse />
      </div>

      {courses.length > 0 ? (
        <div className="studio-list">
          {courses.map(({ course, lessons, durationSeconds, engagement }) => (
            <article className="studio-course" key={course.id}>
              <span className="studio-course__seal" aria-hidden="true">
                <BookOpen />
              </span>

              <div className="studio-course__body">
                <h2 className="studio-course__title">{course.title}</h2>
                <p className="studio-course__meta">
                  <span className={`badge${course.status === "published" ? "" : " badge--pending"}`}>
                    {STATUS_LABEL[course.status]}
                  </span>
                  <span className="studio-course__fact">
                    {lessons} {lessons === 1 ? "aula" : "aulas"} · {formatDuration(durationSeconds)}
                  </span>
                  <span className="studio-course__fact">
                    <Users aria-hidden /> {engagement.learners}{" "}
                    {engagement.learners === 1 ? "aluno" : "alunos"}
                  </span>
                </p>
              </div>

              <div className="studio-course__actions">
                <Link className="btn btn--secondary" href={`/instrutor/cursos/${course.id}`}>
                  <Pencil aria-hidden /> Editar
                </Link>
                <DuplicateButton courseId={course.id} title={course.title} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <span className="empty__rule" aria-hidden="true" />
          <div className="empty__inner">
            <span className="empty__icon">
              <BookOpen aria-hidden />
            </span>
            <h2 className="empty__title">Você ainda não tem cursos</h2>
            <p className="empty__text">
              Crie o primeiro pelo botão acima. Ele nasce como rascunho, só visível para você, e
              fica disponível para os alunos quando você publicar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
