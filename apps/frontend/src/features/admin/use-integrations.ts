"use client";

import { useState } from "react";

/**
 * As chamadas da tela de integrações.
 *
 * Criar chave, criar webhook, revogar e remover conversam com a mesma rota e
 * seguem o mesmo roteiro: marcar ocupado, limpar o aviso anterior, mandar
 * JSON, ler a resposta, decidir. Estava escrito quatro vezes — e as quatro
 * cópias não eram iguais.
 *
 * As duas de criação tinham `try/catch` e `finally`; as duas de remoção não.
 * Numa rede caída, revogar uma chave não mostrava aviso nenhum: a promessa
 * rejeitava, o `resposta.ok` nunca era avaliado e a tela ficava como estava.
 * Quem clicasse concluiria que a chave foi revogada. Com um caminho só, a
 * falha de rede vira aviso nas quatro.
 */

/** Uma resposta já lida: os campos que a rota devolve, ou `null` se falhou. */
export type RespostaIntegracao = Record<string, unknown> | null;

export interface IntegrationsClient {
  /** Há uma chamada em andamento — desabilita os botões. */
  ocupado: boolean;
  aviso: string | null;
  /** Troca o aviso sem chamar o servidor (validação local, confirmação). */
  avisar: (mensagem: string | null) => void;
  /**
   * Envia e devolve o corpo da resposta, ou `null` em qualquer falha.
   *
   * `exige` nomeia um campo que a resposta precisa trazer para ser
   * considerada boa: a rota pode responder 200 sem o segredo, e seguir em
   * frente gravaria `undefined` na lista da tela.
   */
  chamar: (opcoes: {
    metodo: "POST" | "DELETE";
    corpo: unknown;
    exige?: string;
    seFalhar: string;
  }) => Promise<RespostaIntegracao>;
}

const ROTA = "/api/integracoes";

export function useIntegrations(): IntegrationsClient {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function chamar({
    metodo,
    corpo,
    exige,
    seFalhar,
  }: {
    metodo: "POST" | "DELETE";
    corpo: unknown;
    exige?: string;
    seFalhar: string;
  }): Promise<RespostaIntegracao> {
    setOcupado(true);
    setAviso(null);

    try {
      const resposta = await fetch(ROTA, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;

      if (!resposta.ok || (exige !== undefined && !dados[exige])) {
        setAviso(typeof dados.error === "string" ? dados.error : seFalhar);
        return null;
      }

      return dados;
    } catch {
      setAviso("Não foi possível falar com o servidor.");
      return null;
    } finally {
      setOcupado(false);
    }
  }

  return { ocupado, aviso, avisar: setAviso, chamar };
}
