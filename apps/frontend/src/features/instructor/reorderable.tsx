"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { moveItem } from "@nerdlms/core/courses/reorder.ts";

/**
 * Lista reordenável — F2-06.
 *
 * **Arrastar nunca é a única forma.** A WCAG 2.2 (2.5.7, Dragging Movements)
 * exige que toda ação de arrastar tenha alternativa por ponteiro único, e a
 * verificação do projeto (`check-wcag22.mjs`) reprova o build se encontrar
 * `onDragStart` sem alternativa. Foi escrita para este momento.
 *
 * São três caminhos para a mesma operação:
 *
 *   1. arrastar com o mouse;
 *   2. os botões ↑ ↓, que funcionam com clique, toque e teclado;
 *   3. as setas do teclado com o item focado.
 *
 * O item 2 não é concessão de acessibilidade — é mais rápido para mover uma
 * posição, que é o caso comum. Quem arrasta está movendo para longe.
 */

export interface ReorderableItem {
  id: string;
  label: string;
}

export function Reorderable({
  items,
  onReorder,
  disabled = false,
  itemLabel = "item",
}: {
  items: ReorderableItem[];
  /** Recebe a ordem nova completa. Devolve `false` para desfazer na tela. */
  onReorder: (orderedIds: string[]) => Promise<boolean>;
  disabled?: boolean;
  /** Como chamar um item nas mensagens: "aula", "módulo". */
  itemLabel?: string;
}) {
  /* A ordem local existe para a lista se mover no gesto, antes da resposta do
     servidor. Sem isso o item volta ao lugar e parece que o arrasto falhou. */
  const [ordem, setOrdem] = useState<ReorderableItem[] | null>(null);
  /* O índice arrastado vive numa ref, não em estado.

     `onDrop` dispara no MESMO ciclo em que o React ainda não aplicou o
     `setState` do `onDragStart`, então ler o estado ali devolvia `null` e o
     arrasto não fazia nada — enquanto clique e teclado funcionavam. A ref é
     lida no valor atual, sem esperar renderização.

     O estado continua existindo só para o realce visual, que pode chegar um
     quadro depois sem prejuízo. */
  const arrastandoRef = useRef<number | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const lista = ordem ?? items;

  async function aplicar(nova: ReorderableItem[], mensagem: string) {
    const anterior = lista;
    setOrdem(nova);
    setAviso(mensagem);

    const ok = await onReorder(nova.map((item) => item.id));

    if (!ok) {
      /* Desfaz visualmente: manter a ordem nova depois de o servidor recusar
         faria a tela mentir sobre o que está gravado. */
      setOrdem(anterior);
      setAviso("Não foi possível salvar a nova ordem.");
      return;
    }

    /* Solta o estado local: o `router.refresh()` de quem chamou traz a ordem
       do servidor, que passa a ser a fonte. */
    setOrdem(null);
  }

  function mover(de: number, para: number) {
    if (para < 0 || para >= lista.length) return;

    const nome = lista[de]?.label ?? itemLabel;
    void aplicar(moveItem(lista, de, para), `${nome} movido para a posição ${para + 1}.`);
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    /* Só com Alt: as setas sozinhas rolam a página e navegam entre controles,
       e sequestrá-las quebraria a navegação normal por teclado. */
    if (!event.altKey) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    event.preventDefault();
    mover(index, index + (event.key === "ArrowUp" ? -1 : 1));
  }

  return (
    <div className="reorder">
      <ol className="reorder__list">
        {lista.map((item, index) => (
          <li
            key={item.id}
            className="reorder__item"
            data-arrastando={arrastando === index || undefined}
            draggable={!disabled}
            onDragStart={() => {
              arrastandoRef.current = index;
              setArrastando(index);
            }}
            onDragEnd={() => {
              arrastandoRef.current = null;
              setArrastando(null);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const de = arrastandoRef.current;
              arrastandoRef.current = null;
              setArrastando(null);

              if (de === null || de === index) return;
              mover(de, index);
            }}
          >
            <span className="reorder__grip" aria-hidden="true">
              <GripVertical />
            </span>

            <span className="reorder__label">{item.label}</span>

            {/* A alternativa à arrastada. `aria-label` diz o que o botão faz
                COM QUAL item: "Subir" sozinho não informa nada a quem navega
                por lista de controles. */}
            <span className="reorder__buttons">
              <button
                type="button"
                className="reorder__button"
                aria-label={`Mover ${item.label} para cima`}
                disabled={disabled || index === 0}
                onClick={() => mover(index, index - 1)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <ChevronUp aria-hidden />
              </button>
              <button
                type="button"
                className="reorder__button"
                aria-label={`Mover ${item.label} para baixo`}
                disabled={disabled || index === lista.length - 1}
                onClick={() => mover(index, index + 1)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <ChevronDown aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ol>

      <p className="reorder__hint">
        Arraste, use os botões ↑ ↓, ou <kbd>Alt</kbd> + setas com o botão focado.
      </p>

      {/* `role="status"` anuncia a mudança a quem não vê a lista se mover. */}
      <p className="sr-only" role="status">
        {aviso}
      </p>
    </div>
  );
}
