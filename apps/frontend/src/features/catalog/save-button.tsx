"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark } from "lucide-react";

/**
 * Marca o curso para ver depois.
 *
 * A gravação já existia em `PATCH /api/matricula` e a aba "Salvos" já filtrava
 * por ela; faltava o controle que troca o valor. Antes o ícone era um botão
 * sem ação: aceitava clique e não fazia nada.
 *
 * Só aparece para quem está matriculado, porque `saved` vive na matrícula —
 * sem ela não há onde gravar.
 *
 * O estado muda na hora e é confirmado pelo servidor em seguida: esperar a
 * resposta para pintar o ícone faz o clique parecer perdido. Se a gravação
 * falhar, volta ao valor anterior.
 */
export function SaveButton({
  courseId,
  saved,
  className = "icon-button course-card__save",
}: {
  courseId: string;
  saved: boolean;
  /** O hero do curso fica sobre a marca e precisa da variante clara. */
  className?: string;
}) {
  const router = useRouter();
  const [marcado, setMarcado] = useState(saved);
  const [salvando, setSalvando] = useState(false);

  async function handleClick() {
    const alvo = !marcado;
    setMarcado(alvo);
    setSalvando(true);

    try {
      const response = await fetch("/api/matricula", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, saved: alvo }),
      });

      if (!response.ok) {
        setMarcado(!alvo);
        return;
      }
      /* Recarrega para a aba "Salvos" e o contador acompanharem. */
      router.refresh();
    } catch {
      setMarcado(!alvo);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-pressed={marcado}
      aria-label={marcado ? "Remover dos salvos" : "Salvar para ver depois"}
      title={marcado ? "Remover dos salvos" : "Salvar para ver depois"}
      onClick={handleClick}
      disabled={salvando}
    >
      <Bookmark aria-hidden fill={marcado ? "currentColor" : "none"} />
    </button>
  );
}
