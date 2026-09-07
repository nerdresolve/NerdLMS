"use client";

import { useSyncExternalStore } from "react";

// Módulo em JS puro, compartilhado com o protótipo (ver DEC-031). Os tipos vêm
// do JSDoc do próprio arquivo, com `checkJs` — não é mais preciso suprimir nada.
//
// A store mora em `@nerdlms/core`; este arquivo é o que a liga ao React, e por
// isso ficou no app: `useSyncExternalStore` é React, e o pacote de domínio não
// conhece framework.
import { learnerStore } from "@nerdlms/core/store/learner-store.js";

/**
 * Liga o React à mesma store que o protótipo usa.
 *
 * `useSyncExternalStore` é o caminho correto para estado fora do React: evita
 * o "tearing" em renderização concorrente, no qual duas partes da tela leem
 * versões diferentes do mesmo estado.
 */
export function useLearnerStore<T>(selector: (state: ReturnType<typeof learnerStore.getState>) => T): T {
  return useSyncExternalStore(
    learnerStore.subscribe,
    () => selector(learnerStore.getState()),
    // No servidor não há estado do cliente: renderiza a partir do dado recebido.
    () => selector(learnerStore.getState()),
  );
}

export { learnerStore };
