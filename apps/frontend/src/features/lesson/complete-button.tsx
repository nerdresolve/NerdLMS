"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheckBig, Info, Loader2 } from "lucide-react";

import { decideConfirm, estimateFromPages } from "@nerdlms/core/rigor/reading-time.ts";

import { useFeature } from "@/features/tenant/feature-context.tsx";

/**
 * Botão de concluir aula.
 *
 * Componente de cliente porque precisa de estado e de clique; a `LessonView`
 * continua sendo renderizada no servidor. É só este botão que atravessa a
 * fronteira, e não a tela inteira.
 *
 * Depois de gravar, `router.refresh()` recarrega os dados do servidor: o
 * progresso do curso, a barra lateral e o ponto de retomada são calculados lá,
 * e reproduzi-los aqui criaria duas versões do mesmo número.
 */
export function CompleteLessonButton({
  lessonId,
  completed,
  pageCount,
  openedAt,
}: {
  lessonId: string;
  completed: boolean;
  /**
   * Páginas do documento, quando a aula é um.
   *
   * Sem isso não há estimativa, e sem estimativa não há pergunta — o produto
   * não inventa um tempo para um documento que não sabe medir.
   */
  pageCount?: number;
  /** Quando a aula abriu, em milissegundos. Mede o tempo na página. */
  openedAt?: number;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);

  const perguntaLeitura = useFeature("rigor.leitura");

  /**
   * A pessoa leu rápido demais?
   *
   * A conta é feita no CLIQUE, não no render: o tempo na página cresce
   * enquanto ela lê, e um valor calculado na montagem estaria sempre errado.
   */
  function precisaConfirmar(): string | null {
    if (!perguntaLeitura || !pageCount || !openedAt) return null;

    const decisao = decideConfirm(
      (Date.now() - openedAt) / 1000,
      estimateFromPages(pageCount),
      true,
    );

    return decisao.confirm ? decisao.message : null;
  }

  async function handleClick() {
    /* A pergunta vem ANTES de gravar. Perguntar depois seria pedir confirmação
       de algo já feito. */
    const pergunta = precisaConfirmar();
    if (pergunta && confirmacao === null) {
      setConfirmacao(pergunta);
      return;
    }

    setConfirmacao(null);
    await gravar();
  }

  async function gravar() {
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/progresso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, complete: true }),
      });

      /* 204 significa "já estava concluída": não é erro, e insistir com
         mensagem de falha confundiria quem clicou duas vezes. */
      if (response.ok) {
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? "Não foi possível registrar a conclusão.");
    } catch {
      setNotice("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* A confirmação de leitura.

          PERGUNTA, não trava. Bloquear puniria quem lê rápido e não impediria
          quem quer burlar — bastaria deixar a aba aberta. O modal faz a pessoa
          AFIRMAR que leu, e é isso que ele acrescenta. */}
      {confirmacao ? (
        <div
          className="leitura-modal"
          onClick={() => setConfirmacao(null)}
          role="presentation"
        >
          <div
            className="leitura-modal__painel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leitura-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="leitura-modal__titulo" id="leitura-titulo">
              Confirmar leitura
            </h2>

            <p className="leitura-modal__texto">{confirmacao}</p>

            <div className="leitura-modal__acoes">
              {/* "Voltar ao documento" primeiro, e é o padrão de foco: quem
                  abriu este modal provavelmente não terminou de ler, e a ação
                  menos destrutiva deve ser a mais fácil de alcançar. */}
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setConfirmacao(null)}
                autoFocus
              >
                Voltar ao documento
              </button>

              <button type="button" className="btn btn--primary" onClick={() => void gravar()}>
                Já terminei
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn--primary"
        onClick={handleClick}
        disabled={saving || completed}
      >
        {saving ? <Loader2 aria-hidden /> : <CircleCheckBig aria-hidden />}
        {completed ? "Aula concluída" : saving ? "Salvando…" : "Concluir aula"}
      </button>

      <div className="notice" data-visible={notice ? "true" : "false"} role="status">
        {notice ? (
          <>
            <Info aria-hidden="true" />
            <span>{notice}</span>
          </>
        ) : null}
      </div>
    </>
  );
}
