import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { startQuizUseCase } from "@nerdlms/backend/assessment/quiz-use-case.ts";

import { AppShell } from "@/features/app-shell/app-shell.tsx";
import { QuizView } from "@/features/quiz/quiz-view.tsx";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";

import "@/styles/status-page.css";

export const metadata: Metadata = { title: "Prova" };

/**
 * Fazer a prova.
 *
 * A tentativa começa aqui, no servidor: abrir a página É começar. Um botão
 * "iniciar" que só depois cria a tentativa daria uma tela intermediária sem
 * função — e o guia trata o início como o momento em que o cronômetro corre.
 *
 * Recarregar não consome tentativa: o caso de uso devolve a que está em
 * andamento, se ainda estiver no prazo.
 */
export default async function QuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const user = await requireUser();

  const outcome = await startQuizUseCase({ actor: actorOf(user), quizId });

  /* 404 quando não existe OU não é para esta pessoa: a mesma resposta nos dois
     casos, para trocar o id na URL não revelar quais provas existem. */
  if (outcome.status === 404) notFound();

  if (outcome.status !== 200) {
    return (
      <AppShell fullName={user.fullName} role={user.role} currentPath="/meus-cursos">
        <main className="status-page">
          <div className="status-page__card">
            <p className="status-page__code">Prova</p>
            <h1 className="status-page__title">Não é possível começar agora</h1>
            <p className="status-page__text">{outcome.error}</p>
            <div className="status-page__actions">
              <a className="btn btn--primary" href="/meus-cursos">
                Voltar aos meus cursos
              </a>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell
      fullName={toDisplayUser(user).fullName}
      role={user.role}
      currentPath="/meus-cursos"
      currentKind="location"
    >
      <QuizView
        start={{
          attemptId: outcome.attempt.id,
          attemptNumber: outcome.attempt.attemptNumber,
          startedAt: outcome.attempt.startedAt,
          questions: outcome.questions,
          quiz: {
            title: outcome.quiz.title,
            timeLimitMinutes: outcome.quiz.timeLimitMinutes ?? null,
            questionsPerPage: outcome.quiz.questionsPerPage ?? null,
            sequentialNavigation: outcome.quiz.sequentialNavigation,
            totalPoints: outcome.quiz.totalPoints,
          },
        }}
      />
    </AppShell>
  );
}
