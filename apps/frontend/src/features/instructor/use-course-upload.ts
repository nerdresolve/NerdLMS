"use client";

import { useState } from "react";

import { uploadWithProgress } from "./upload-progress.ts";

/**
 * O envio de arquivos do editor de curso.
 *
 * Sai do componente porque não é sobre a tela: é a conversa com o servidor e o
 * storage, com um estado de progresso que só existe enquanto ela dura. O
 * editor cuidava disso junto com módulos, aulas, publicação e SCORM — nove
 * funções assíncronas no mesmo lugar, e quem fosse mexer numa precisava ler as
 * outras oito.
 *
 * O QUE ESTE HOOK FAZ, E POR QUE EM DUAS ETAPAS
 *
 * O arquivo NÃO passa pelo servidor: a rota devolve uma URL assinada e o
 * navegador fala direto com o storage. Um vídeo de duas horas atravessando o
 * processo do Next ocuparia o event loop e travaria a renderização para todo
 * mundo.
 */

export interface UploadState {
  /** O nome do arquivo em envio, ou `null`. */
  enviando: string | null;
  /** 0 a 100 enquanto sobe. */
  progresso: number | null;
}

export interface CourseUpload extends UploadState {
  /**
   * Envia e devolve a chave no storage.
   *
   * `null` em qualquer falha, com a mensagem em `erro` — quem chama decide
   * como mostrá-la, e não precisa distinguir os motivos: para quem está
   * enviando, "não subiu" é a mesma informação.
   */
  enviar: (file: File, scope?: "aulas" | "materiais") => Promise<string | null>;
  erro: string | null;
  limparErro: () => void;
  /**
   * Marca um envio que NÃO usa URL assinada.
   *
   * O pacote SCORM vai pelo servidor, porque precisa ser descompactado. Ele
   * não tem progresso — o navegador não sabe quanto do POST já subiu —, mas
   * precisa da mesma indicação de "enviando" que os outros: sem ela, o botão
   * fica mudo enquanto um zip de dezenas de megabytes atravessa.
   */
  marcarEnvio: (nome: string | null) => void;
}

export function useCourseUpload(courseId: string): CourseUpload {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(
    file: File,
    scope: "aulas" | "materiais" = "aulas",
  ): Promise<string | null> {
    setProgresso(0);
    setEnviando(`Enviando ${file.name}`);
    setErro(null);

    try {
      const autorizacao = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, filename: file.name, scope }),
      });

      if (!autorizacao.ok) {
        const corpo = (await autorizacao.json().catch(() => ({}))) as { error?: string };
        setErro(corpo.error ?? "Não foi possível preparar o envio.");
        return null;
      }

      const { url, key, contentType } = (await autorizacao.json()) as {
        url: string;
        key: string;
        contentType: string;
      };

      /* `XMLHttpRequest`, e não `fetch`: só ele reporta progresso de ENVIO.
         `fetch` acompanha o download da resposta, o que aqui não serve — o que
         demora é o vídeo subindo. Sem isso, um arquivo grande em conexão de
         campo deixava o botão em "Enviando" por minutos, sem sinal de que algo
         acontecia, e quem opera recarregava a página no meio. */
      const envio = uploadWithProgress(url, file, contentType, setProgresso);

      if (!(await envio.done)) {
        setErro("O arquivo não chegou ao armazenamento. Tente de novo.");
        return null;
      }

      return key;
    } catch {
      setErro("Não foi possível enviar o arquivo. Verifique sua conexão.");
      return null;
    } finally {
      setEnviando(null);
      setProgresso(null);
    }
  }

  return {
    enviando,
    progresso,
    erro,
    enviar,
    limparErro: () => setErro(null),
    marcarEnvio: setEnviando,
  };
}
