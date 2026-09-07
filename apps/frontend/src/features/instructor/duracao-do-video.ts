/**
 * A duração de um vídeo que ainda não foi enviado.
 *
 * O navegador já sabe ler o cabeçalho de um arquivo local: basta apontar um
 * `<video>` para uma URL de objeto e esperar os metadados. Isso responde a
 * pergunta antes de 300 MB atravessarem a rede, que é o ponto.
 *
 * Existe uma leitura equivalente no servidor, em `infra/tools/duracao-mp4.mjs`,
 * que decodifica o `mvhd` do MP4 à mão. Ela é usada na importação em massa,
 * onde não há navegador. As duas não se sobrepõem.
 */

/** Depois disto, desiste. Metadados que não chegam não devem travar a tela. */
const LIMITE_MS = 8000;

/**
 * Devolve a duração em segundos, ou `null` quando não dá para saber.
 *
 * `null` e não zero: zero é uma duração, e quem chama precisa distinguir "o
 * vídeo não tem duração" de "não consegui ler". A regra de teto trata o nulo
 * como aceito, porque recusar por falha de leitura trancaria quem não tem
 * culpa.
 */
export function duracaoDoVideo(arquivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement("video");

    let respondido = false;

    /* A URL de objeto segura o arquivo na memória até ser revogada, e o
       elemento continua com uma referência ao recurso enquanto tiver `src`.
       Sem limpar os dois, subir vários vídeos numa sessão acumula. */
    const encerrar = (valor: number | null) => {
      if (respondido) return;
      respondido = true;
      clearTimeout(prazo);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(valor);
    };

    const prazo = setTimeout(() => encerrar(null), LIMITE_MS);

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      /* `Infinity` acontece em alguns WebM e em MP4 fragmentado, onde a
         duração não está no cabeçalho principal. É um valor finito ou nada. */
      encerrar(Number.isFinite(video.duration) ? video.duration : null);
    };

    video.onerror = () => encerrar(null);

    video.src = url;
  });
}
