import type { Metadata } from "next";
import Link from "next/link";

import "@/styles/status-page.css";

export const metadata: Metadata = { title: "Página não encontrada" };

/**
 * 404 da aplicação.
 *
 * Sem este arquivo quem respondia era a página interna do Next, que traz o
 * próprio estilo mínimo e ignora os tokens: no tema escuro saía texto violeta
 * sobre fundo preto, ilegível.
 *
 * Também é o destino de `notFound()` nas camadas de dados, que é como as
 * áreas de outro papel recusam acesso — vale a pena ser uma tela apresentável.
 */
export default function NotFound() {
  return (
    <main className="status-page">
      <div className="status-page__card">
        <p className="status-page__code">404</p>
        <h1 className="status-page__title">Esta página não existe</h1>
        <p className="status-page__text">
          O endereço pode ter sido digitado errado, ou a tela ainda não faz parte desta versão da
          plataforma.
        </p>
        <div className="status-page__actions">
          <Link className="btn btn--primary" href="/dashboard">
            Ir para o início
          </Link>
          <Link className="btn btn--secondary" href="/login">
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
