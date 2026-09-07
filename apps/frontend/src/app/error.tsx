"use client";

import "@/styles/status-page.css";

/**
 * Erro de renderização.
 *
 * Sem este arquivo, uma exceção não tratada virava "Application error: a
 * server-side exception has occurred", que é a tela crua do Next: sem estilo,
 * sem saída e sem informação útil para quem está usando.
 *
 * O `digest` é o identificador que o Next grava junto do erro no log do
 * servidor. Mostrar aqui permite localizar a ocorrência exata sem expor a
 * mensagem, que em produção fica omitida de propósito.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="status-page">
      <div className="status-page__card">
        <p className="status-page__code">Erro</p>
        <h1 className="status-page__title">Algo falhou ao carregar esta tela</h1>
        <p className="status-page__text">
          A falha foi registrada. Tentar de novo costuma resolver quando o problema é momentâneo.
        </p>
        <div className="status-page__actions">
          <button className="btn btn--primary" type="button" onClick={reset}>
            Tentar de novo
          </button>
          <a className="btn btn--secondary" href="/dashboard">
            Ir para o início
          </a>
        </div>
        {error.digest ? <p className="status-page__digest">Código da ocorrência: {error.digest}</p> : null}
      </div>
    </main>
  );
}
