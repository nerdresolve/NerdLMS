"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheckBig, Info, Loader2 } from "lucide-react";

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
}: {
  lessonId: string;
  completed: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleClick() {
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
