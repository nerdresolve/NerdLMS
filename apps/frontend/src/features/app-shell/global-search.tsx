"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, PlayCircle, Search, X } from "lucide-react";

import type { SearchHit } from "@nerdlms/core/courses/search.ts";

/**
 * Busca do topo.
 *
 * Antes a lupa era um link para o catálogo: clicar levava a uma lista de
 * cursos onde a pessoa tinha de procurar de novo. Agora procura de verdade, e
 * também em aulas — quem digita "cloro" quer a aula sobre cloro, não o curso
 * de segurança inteiro.
 *
 * O painel abre sobre a página em vez de navegar: buscar é uma pausa no que
 * se estava fazendo, e sair da tela para procurar obriga a voltar depois.
 *
 * Vai para o <body> por portal, e não fica onde o componente mora: `.app`
 * declara `container-type`, e um elemento com `container-type` passa a ser o
 * bloco de contenção dos descendentes `position: fixed`. Renderizado ali
 * dentro, o véu cobria só a área do contêiner e o painel ficava ATRÁS do
 * conteúdo da página — visível, mas sem receber clique.
 */
export function GlobalSearch() {
  const router = useRouter();
  const painelId = useId();
  const campoRef = useRef<HTMLInputElement>(null);

  /* O portal precisa do `document`, que não existe no servidor. Sem esta
     guarda, a primeira renderização quebraria a hidratação. */
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [buscando, setBuscando] = useState(false);

  /* O foco vai para o campo ao abrir: quem clicou na lupa quer digitar, e
     obrigar a um segundo clique é atrito à toa. */
  useEffect(() => {
    if (aberto) campoRef.current?.focus();
  }, [aberto]);

  /* Esc fecha de onde quer que o foco esteja — é o que se espera de algo
     sobreposto, e sem isso só o mouse fecha o painel. */
  useEffect(() => {
    if (!aberto) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto]);

  /**
   * Consulta com atraso.
   *
   * Sem o atraso, cada tecla vira uma requisição: digitar "cloro" dispararia
   * cinco, e a resposta da terceira poderia chegar depois da quinta e
   * sobrescrever o resultado certo pelo antigo. O `AbortController` cancela a
   * anterior, então a última digitada é sempre a que vale.
   */
  useEffect(() => {
    const busca = termo.trim();
    if (busca.length < 2) {
      setHits([]);
      setBuscando(false);
      return;
    }

    const controller = new AbortController();
    setBuscando(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/busca?q=${encodeURIComponent(busca)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const corpo = (await response.json()) as { hits: SearchHit[] };
        setHits(corpo.hits);
      } catch {
        /* Abortada pela próxima tecla, ou rede caiu. Em ambos os casos o
           resultado antigo continua na tela, que é melhor que esvaziar. */
      } finally {
        setBuscando(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [termo]);

  function abrir(hit: SearchHit) {
    setAberto(false);
    setTermo("");
    router.push(hit.href);
  }

  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label="Buscar cursos e aulas"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto(true)}
      >
        <Search aria-hidden />
      </button>

      {aberto && montado
        ? createPortal(
        <div className="search-overlay" role="presentation" onClick={() => setAberto(false)}>
          {/* O clique dentro do painel não fecha: só o de fora. */}
          <div
            className="search-panel"
            id={painelId}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="search-panel__field">
              <Search aria-hidden />
              <input
                ref={campoRef}
                type="search"
                className="search-panel__input"
                placeholder="Buscar curso ou aula"
                value={termo}
                onChange={(event) => setTermo(event.target.value)}
                aria-label="Buscar curso ou aula"
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar busca"
                onClick={() => setAberto(false)}
              >
                <X aria-hidden />
              </button>
            </div>

            {/* `aria-live` para quem usa leitor de tela saber que a lista
                mudou: sem isso o resultado aparece em silêncio. */}
            <div className="search-panel__results" aria-live="polite">
              {termo.trim().length < 2 ? (
                <p className="search-panel__hint">Digite ao menos duas letras.</p>
              ) : hits.length === 0 ? (
                <p className="search-panel__hint">
                  {buscando ? "Procurando" : `Nada encontrado para "${termo.trim()}".`}
                </p>
              ) : (
                <ul className="search-panel__list">
                  {hits.map((hit) => (
                    <li key={`${hit.kind}-${hit.id}`}>
                      <button
                        type="button"
                        className="search-hit"
                        onClick={() => abrir(hit)}
                      >
                        <span className="search-hit__icon" aria-hidden="true">
                          {hit.kind === "course" ? <BookOpen /> : <PlayCircle />}
                        </span>
                        <span className="search-hit__body">
                          <span className="search-hit__title">{hit.title}</span>
                          <span className="search-hit__context">{hit.context}</span>
                        </span>
                        <span className="search-hit__kind">
                          {hit.kind === "course" ? "Curso" : "Aula"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
