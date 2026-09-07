"use client";

import { createContext, useContext } from "react";

/**
 * O que está ligado para este cliente.
 *
 * Chega resolvido — a herança já foi aplicada no servidor — então consultar é
 * uma leitura de mapa, não uma subida pela árvore a cada render.
 *
 * O contexto existe porque funcionalidade não respeita a árvore de
 * componentes: o upvote vive dentro do comentário, que vive dentro da aula, e
 * a bandeira que o governa é a mesma que esconde um item do menu lateral.
 * Passar por prop obrigaria cada nível intermediário a repassar algo que não
 * usa — e bastaria um esquecer para a funcionalidade "desligada" reaparecer.
 */
const FeatureCtx = createContext<Record<string, boolean>>({});

export function FeatureProvider({
  features,
  children,
}: {
  features: Record<string, boolean>;
  children: React.ReactNode;
}) {
  return <FeatureCtx.Provider value={features}>{children}</FeatureCtx.Provider>;
}

/**
 * Se a funcionalidade está ligada.
 *
 * Devolve `false` para chave desconhecida — inclusive fora do provider. Um
 * typo não pode fazer uma tela aparecer: é melhor esconder por engano do que
 * mostrar o que o cliente pediu para não ter.
 */
export function useFeature(key: string): boolean {
  return useContext(FeatureCtx)[key] === true;
}

/** O mapa inteiro, para quem filtra uma lista em vez de consultar uma chave. */
export function useFeatures(): Record<string, boolean> {
  return useContext(FeatureCtx);
}

/**
 * Esconde o conteúdo quando a funcionalidade está desligada.
 *
 * Existe para o caso comum — um bloco inteiro que some — sem espalhar
 * `if (!ligado) return null` por dezenas de componentes.
 */
export function Feature({
  is,
  children,
  fallback = null,
}: {
  is: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return useFeature(is) ? <>{children}</> : <>{fallback}</>;
}
