"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";

/**
 * Botão de matrícula, usado na biblioteca.
 *
 * Quem já está matriculado vê o estado, não o botão: oferecer "matricular" a
 * quem já entrou levaria a um clique que não faz nada.
 *
 * A mensagem de recusa vem do servidor porque o motivo é dele — curso
 * atribuído pelo gestor, curso não publicado. Reproduzir a regra aqui criaria
 * duas versões dela.
 */
export function EnrollButton({ courseId, enrolled }: { courseId: string; enrolled: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (enrolled) {
    return (
      <span className="badge badge--success">
        <Check aria-hidden /> Matriculado
      </span>
    );
  }

  async function handleClick() {
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/matricula", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      if (response.ok) {
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? "Não foi possível concluir a matrícula.");
    } catch {
      setNotice("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--primary" onClick={handleClick} disabled={saving}>
        {saving ? <Loader2 aria-hidden /> : <Plus aria-hidden />}
        {saving ? "Matriculando…" : "Matricular"}
      </button>

      {notice ? (
        <span className="status-text" role="status">
          {notice}
        </span>
      ) : null}
    </>
  );
}
