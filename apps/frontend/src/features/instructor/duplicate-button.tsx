"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

/**
 * Duplicar curso — F2-07.
 *
 * A cópia nasce rascunho e pertence a quem duplicou, então o destino natural
 * depois de duplicar é o editor da cópia: quem duplica vai ajustar alguma
 * coisa, senão teria usado o original.
 */
export function DuplicateButton({ courseId, title }: { courseId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function duplicar() {
    setBusy(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/cursos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ duplicate: true, courseId }),
      });

      const dados = (await resposta.json().catch(() => ({}))) as {
        courseId?: string;
        error?: string;
      };

      if (!resposta.ok || !dados.courseId) {
        setErro(dados.error ?? "Não foi possível duplicar.");
        return;
      }

      router.push(`/instrutor/cursos/${dados.courseId}`);
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost"
        disabled={busy}
        /* O título entra no rótulo acessível porque a página lista vários
           cursos: "Duplicar" sozinho não diz qual, a quem navega por lista de
           controles. */
        aria-label={`Duplicar ${title}`}
        onClick={() => void duplicar()}
      >
        <Copy aria-hidden /> {busy ? "Duplicando" : "Duplicar"}
      </button>

      {erro ? (
        <p className="status-text" role="status">
          {erro}
        </p>
      ) : null}
    </>
  );
}
