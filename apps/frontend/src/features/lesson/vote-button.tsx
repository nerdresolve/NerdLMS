"use client";

import { useState } from "react";
import { ThumbsUp } from "lucide-react";

/**
 * Marcar comentário como útil.
 *
 * Guarda o próprio estado em vez de recebê-lo da árvore: a lista é recursiva
 * (respostas dentro de respostas), e propagar um mapa de votos por todos os
 * níveis para mudar um número seria mais frágil que este estado local.
 *
 * O número muda na hora e o servidor confirma depois. A contagem que vale é a
 * da resposta, não a soma otimista: se outra pessoa votar ao mesmo tempo, as
 * duas telas convergem para o total real em vez de discordarem.
 */
export function VoteButton({
  commentId,
  upvotes,
  voted,
}: {
  commentId: string;
  upvotes: number;
  voted: boolean;
}) {
  const [marcado, setMarcado] = useState(voted);
  const [total, setTotal] = useState(upvotes);
  const [enviando, setEnviando] = useState(false);

  async function handleClick() {
    const alvo = !marcado;
    const anterior = total;

    setMarcado(alvo);
    setTotal((atual) => Math.max(0, atual + (alvo ? 1 : -1)));
    setEnviando(true);

    try {
      const response = await fetch("/api/comentarios", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId, voted: alvo }),
      });

      if (!response.ok) {
        setMarcado(!alvo);
        setTotal(anterior);
        return;
      }

      const corpo = (await response.json()) as { upvotes: number };
      setTotal(corpo.upvotes);
    } catch {
      setMarcado(!alvo);
      setTotal(anterior);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <button
      type="button"
      className="comment__action"
      aria-pressed={marcado}
      aria-label={marcado ? "Desmarcar como útil" : "Marcar como útil"}
      onClick={handleClick}
      disabled={enviando}
    >
      <ThumbsUp aria-hidden fill={marcado ? "currentColor" : "none"} />
      Útil{total > 0 ? ` · ${total}` : ""}
    </button>
  );
}
