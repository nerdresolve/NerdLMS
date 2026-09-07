"use client";

import { useState } from "react";

/**
 * O salvamento dos formulários de SSO.
 *
 * As três seções da tela — OIDC, LDAP e SAML — gravam do mesmo jeito: marcam
 * qual cartão está salvando, limpam o erro anterior, mandam o formulário como
 * JSON e, se voltar bem, aplicam a linha devolvida pelo servidor. Só mudam a
 * rota, o corpo e onde a resposta é guardada.
 *
 * Estava escrito três vezes. A repetição não custava linhas: custava que uma
 * correção — o `catch` do json ilegível, o erro que precisa sumir na segunda
 * tentativa — tinha de ser lembrada nos três lugares.
 *
 * A resposta do servidor é a fonte da verdade, não o formulário. O que é
 * gravado passa por normalização (domínios em minúscula, porta com padrão,
 * segredo mantido quando vem vazio), e a tela precisa mostrar o que ficou
 * gravado, não o que foi digitado.
 */

export interface SsoForm {
  /** Qual cartão está salvando agora, ou `null`. */
  salvando: string | null;
  erro: string | null;
  /**
   * Envia e devolve a linha gravada, ou `null` em qualquer falha — com a
   * mensagem já em `erro`.
   *
   * `chave` é o campo do JSON onde a linha vem: cada rota nomeia a sua
   * (`provider`, `directory`, `saml`).
   */
  salvar: <T>(opcoes: {
    cartao: string;
    rota: string;
    corpo: unknown;
    chave: string;
  }) => Promise<T | null>;
}

export function useSsoForm(): SsoForm {
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar<T>({
    cartao,
    rota,
    corpo,
    chave,
  }: {
    cartao: string;
    rota: string;
    corpo: unknown;
    chave: string;
  }): Promise<T | null> {
    setSalvando(cartao);
    setErro(null);

    try {
      const resposta = await fetch(rota, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      const json = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;

      /* Duas condições, não uma: o servidor pode responder 200 com um corpo que
         não traz a linha — e aplicar `undefined` ao estado apagaria da tela uma
         configuração que continua gravada. */
      if (!resposta.ok || !json?.[chave]) {
        setErro(typeof json?.error === "string" ? json.error : "Não foi possível salvar.");
        return null;
      }

      return json[chave] as T;
    } catch {
      setErro("Não foi possível salvar. Verifique sua conexão.");
      return null;
    } finally {
      setSalvando(null);
    }
  }

  return { salvando, erro, salvar };
}
