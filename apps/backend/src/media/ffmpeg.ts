import { execFile } from "node:child_process";
import { promisify } from "node:util";

const executar = promisify(execFile);

/**
 * A conversa com o ffmpeg.
 *
 * Isolado num arquivo só para o caso de uso ficar legível e para os testes do
 * plano de corte não precisarem de ffmpeg nenhum — a matemática vive em
 * `core/courses/cortes-do-video.ts` e é testada sem processo externo.
 *
 * `execFile` e não `exec`: os argumentos vão como lista, sem shell no meio.
 * Um nome de arquivo com aspas ou ponto-e-vírgula seria comando embutido se
 * passasse por um shell, e o nome vem do que a pessoa enviou.
 */

/** Teto de tempo por chamada. Um vídeo de duas horas remuxa bem dentro disso. */
const LIMITE_MS = 20 * 60 * 1000;

/** O ffmpeg está instalado? Serve para o trabalhador não nascer se não estiver. */
export async function temFfmpeg(): Promise<boolean> {
  try {
    await executar("ffmpeg", ["-version"], { timeout: 30_000 });
    await executar("ffprobe", ["-version"], { timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

/** Duração do arquivo, em segundos. Zero quando não dá para ler. */
export async function duracaoDoVideo(caminho: string): Promise<number> {
  const { stdout } = await executar(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", caminho],
    { timeout: LIMITE_MS },
  );

  const valor = Number.parseFloat(stdout.trim());
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

/**
 * Os instantes dos quadros-chave, em segundos.
 *
 * `-skip_frame nokey` faz o ffprobe pular tudo que não é quadro-chave: sem
 * isso ele decodifica o vídeo inteiro para listar todos os quadros, e um
 * arquivo de uma hora leva minutos em vez de segundos.
 *
 * Devolve vazio quando o vídeo não tem quadro-chave legível — o plano de corte
 * sabe lidar com isso e marca a parte como excedida em vez de fingir que coube.
 */
export async function quadrosChave(caminho: string): Promise<number[]> {
  const { stdout } = await executar(
    "ffprobe",
    [
      "-v", "error",
      "-skip_frame", "nokey",
      "-select_streams", "v:0",
      "-show_entries", "frame=best_effort_timestamp_time",
      "-of", "csv=p=0",
      caminho,
    ],
    { timeout: LIMITE_MS, maxBuffer: 64 * 1024 * 1024 },
  );

  return stdout
    .split("\n")
    .map((linha) => Number.parseFloat(linha.trim()))
    .filter((valor) => Number.isFinite(valor));
}

/**
 * Extrai um trecho SEM RECODIFICAR.
 *
 * `-ss` antes do `-i` posiciona por busca, e é o que torna a extração rápida —
 * depois do `-i`, o ffmpeg decodifica desde o começo até chegar lá.
 *
 * `-avoid_negative_ts make_zero` faz o trecho começar do zero. Sem isso a
 * segunda parte abre no minuto 15 e o player mostra a barra já pela metade.
 */
export async function extrairTrecho(
  origem: string,
  destino: string,
  inicio: number,
  fim: number,
): Promise<void> {
  await executar(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", inicio.toFixed(3),
      "-i", origem,
      "-t", (fim - inicio).toFixed(3),
      "-c", "copy",
      "-map", "0",
      "-avoid_negative_ts", "make_zero",
      destino,
    ],
    { timeout: LIMITE_MS },
  );
}
