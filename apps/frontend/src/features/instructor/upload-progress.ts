/**
 * Envio de arquivo com progresso.
 *
 * `fetch` não serve aqui: ele acompanha o download da resposta, não o upload
 * do corpo. O que demora neste fluxo é o vídeo subindo, e é justamente essa
 * parte que `fetch` não expõe. `XMLHttpRequest` continua sendo a única API do
 * navegador com `upload.onprogress`.
 *
 * O arquivo vai direto ao storage por URL assinada — a aplicação não fica no
 * meio do caminho (DEC-009).
 */

export interface UploadHandle {
  /** Resolve `true` quando o storage aceita o arquivo. */
  done: Promise<boolean>;
  /** Interrompe o envio em andamento. */
  abort: () => void;
}

/**
 * @param onProgress recebe 0–100. Só é chamado quando o total é conhecido:
 * sem `lengthComputable`, uma porcentagem seria invenção.
 */
export function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): UploadHandle {
  const request = new XMLHttpRequest();

  const done = new Promise<boolean>((resolve) => {
    request.open("PUT", url);
    request.setRequestHeader("content-type", contentType);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    /* `load` dispara para qualquer resposta, inclusive 403. Só 2xx é sucesso:
       sem esta checagem, uma assinatura recusada viraria aula apontando para
       vídeo que nunca chegou. */
    request.addEventListener("load", () => {
      resolve(request.status >= 200 && request.status < 300);
    });
    request.addEventListener("error", () => resolve(false));
    request.addEventListener("abort", () => resolve(false));

    request.send(file);
  });

  return { done, abort: () => request.abort() };
}
