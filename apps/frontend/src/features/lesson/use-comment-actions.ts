"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Publicar, editar e excluir comentários.
 *
 * As três falam com a mesma rota e terminam do mesmo jeito: se deu certo,
 * `router.refresh()` — porque o comentário publicado volta do servidor com id,
 * data e o destaque que só ele sabe decidir, e reconstruir isso no cliente
 * daria uma lista que diverge da real na próxima navegação.
 *
 * Estava escrito três vezes, e a de excluir tinha ficado para trás: sem
 * `sending`, o botão continuava clicável durante a chamada, e dois cliques
 * mandavam dois DELETE. O segundo achava o comentário já removido e voltava
 * erro — quem excluía via "não foi possível excluir" logo depois de excluir.
 */

export interface CommentActions {
  /** Há uma chamada em andamento — desabilita os botões do painel. */
  enviando: boolean;
  aviso: string | null;
  limparAviso: () => void;
  /**
   * Executa e devolve se deu certo. Em caso de sucesso já recarregou a lista;
   * em caso de falha a mensagem está em `aviso`.
   */
  executar: (opcoes: {
    metodo: "POST" | "PATCH" | "DELETE";
    corpo: unknown;
    seFalhar: string;
  }) => Promise<boolean>;
}

const ROTA = "/api/comentarios";

export function useCommentActions(): CommentActions {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function executar({
    metodo,
    corpo,
    seFalhar,
  }: {
    metodo: "POST" | "PATCH" | "DELETE";
    corpo: unknown;
    seFalhar: string;
  }): Promise<boolean> {
    setAviso(null);
    setEnviando(true);

    try {
      const resposta = await fetch(ROTA, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (resposta.ok) {
        router.refresh();
        return true;
      }

      const dados = (await resposta.json().catch(() => ({}))) as { error?: string };
      setAviso(dados.error ?? seFalhar);
      return false;
    } catch {
      setAviso("Não foi possível falar com o servidor. Verifique sua conexão.");
      return false;
    } finally {
      setEnviando(false);
    }
  }

  return { enviando, aviso, limparAviso: () => setAviso(null), executar };
}
