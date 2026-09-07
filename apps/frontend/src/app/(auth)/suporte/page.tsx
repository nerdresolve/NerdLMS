import type { Metadata } from "next";
import Link from "next/link";

import "@/styles/status-page.css";

export const metadata: Metadata = {
  title: "Suporte · a organização",
  robots: { index: false, follow: false },
};

/**
 * Suporte.
 *
 * A tela de acesso linka "Fale com seu administrador" para cá, e o link caía
 * em 404. Enquanto o canal de chamados não existe (TASK-071), a página diz
 * qual é o caminho real hoje: falar com o gestor da área, que é quem cria e
 * reativa acesso pela tela de usuários.
 *
 * Fica fora do grupo `(app)` porque quem chega aqui normalmente não está
 * autenticado — é justamente quem não conseguiu entrar.
 */
export default function SuportePage() {
  return (
    <main className="status-page">
      <div className="status-page__card">
        <h1 className="status-page__title">Acesso à plataforma</h1>
        <p className="status-page__text">
          As contas são criadas pela administração da organização. Se você ainda não tem acesso, ou perdeu
          o acesso que tinha, fale com o gestor da sua área: é ele quem cadastra e reativa contas.
        </p>

        <div className="planned">
          <p className="planned__title">Abertura de chamado pela plataforma</p>
          <p className="planned__text">
            Está planejado: abrir chamado, acompanhar o status e consultar o histórico. Enquanto não
            existe, o contato é pelo gestor da área.
          </p>
        </div>

        <div className="status-page__actions">
          <Link className="btn btn--primary" href="/login">
            Voltar para o acesso
          </Link>
        </div>
      </div>
    </main>
  );
}
