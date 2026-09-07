import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  TETO_DA_AULA_SEGUNDOS,
  nomeDaParte,
  planoDeCorte,
} from "@nerdlms/core/courses/cortes-do-video.ts";

import { baixarObjeto, buildKey, putObject, removeObject } from "../storage/object-storage.ts";
import { duracaoDoVideo, extrairTrecho, quadrosChave, temFfmpeg } from "./ffmpeg.ts";
import {
  concluirCorte,
  falharCorte,
  pegarProximoCorte,
  substituirPorPartes,
  type TrabalhoDeCorte,
} from "./video-split-repository.ts";
import { query } from "../db/pool.ts";

/**
 * Corta um vídeo longo em aulas de no máximo quinze minutos.
 *
 * O QUE ACONTECE, EM ORDEM
 *
 *   1. o arquivo desce do storage para um diretório temporário;
 *   2. o ffprobe diz a duração e onde estão os quadros-chave;
 *   3. `planoDeCorte` (no núcleo, testado sem ffmpeg) decide os cortes;
 *   4. cada parte é extraída SEM RECODIFICAR e sobe como um objeto novo;
 *   5. a aula original vira a parte 1 e as demais entram logo depois;
 *   6. o arquivo inteiro sai do bucket.
 *
 * O TEMPORÁRIO SAI SEMPRE
 *
 * Um `finally` limpa o diretório mesmo quando o corte falha no meio. Sem isso,
 * cada tentativa deixaria centenas de megabytes no disco do contêiner, e a
 * terceira falha encheria o volume.
 */

export interface ResultadoDoCorte {
  partes: number;
  /** Alguma parte passou do teto porque não havia quadro-chave utilizável. */
  temExcesso: boolean;
}

export async function cortarVideo(trabalho: TrabalhoDeCorte): Promise<ResultadoDoCorte> {
  const pasta = await mkdtemp(join(tmpdir(), "corte-"));

  try {
    const original = join(pasta, "original.mp4");
    await baixarObjeto(trabalho.mediaKey, original);

    const duracao = await duracaoDoVideo(original);
    if (duracao <= 0) throw new Error("não foi possível ler a duração do vídeo");

    const plano = planoDeCorte(duracao, await quadrosChave(original));

    /* Uma parte só: o vídeo já cabia, e não há o que trocar. Acontece quando o
       teto muda, ou quando a duração real é menor que a que a tela informou —
       o instrutor digita os minutos à mão, e o arquivo é quem tem razão. */
    if (plano.partes.length <= 1) {
      await query(
        `UPDATE lessons SET media_status = 'ready', duration_seconds = $2 WHERE id = $1`,
        [trabalho.lessonId, Math.floor(duracao)],
      );
      return { partes: 1, temExcesso: plano.temExcesso };
    }

    const titulos = await query<{ title: string }>(
      `SELECT title FROM lessons WHERE id = $1`,
      [trabalho.lessonId],
    );

    /* O título ORIGINAL, sem a marca de parte: se o trabalho for repetido
       depois de uma falha, ler "Aula (parte 1 de 4)" produziria
       "Aula (parte 1 de 4) (parte 1 de 4)". */
    const titulo = (titulos[0]?.title ?? "Aula").replace(/\s*\(parte \d+ de \d+\)\s*$/i, "");

    const partes = [];

    for (const [indice, parte] of plano.partes.entries()) {
      const arquivo = join(pasta, `parte-${indice + 1}.mp4`);
      await extrairTrecho(original, arquivo, parte.inicio, parte.fim);

      const chave = buildKey("aulas", trabalho.courseId, `parte-${indice + 1}.mp4`);
      await putObject(chave, await readFile(arquivo), "video/mp4");

      partes.push({
        titulo: nomeDaParte(titulo, indice, plano.partes.length),
        mediaKey: chave,
        duracaoSegundos: Math.floor(parte.fim - parte.inicio),
      });
    }

    await substituirPorPartes(trabalho.lessonId, partes);

    /* O inteiro sai depois de as partes estarem gravadas E referenciadas.
       Antes disso, uma falha deixaria a aula apontando para um arquivo que já
       não existe. */
    await removeObject(trabalho.mediaKey);

    return { partes: partes.length, temExcesso: plano.temExcesso };
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

/**
 * Esvazia a fila de cortes, um trabalho por vez.
 *
 * QUEM CHAMA, E POR QUE NÃO É UM TEMPORIZADOR
 *
 * A primeira versão subia um trabalhador no arranque do servidor, pelo
 * `instrumentation.ts` do Next. Não deu: aquele arquivo é compilado para os
 * DOIS runtimes, node e edge, e o empacotamento de edge tentava resolver `fs`,
 * `path` e `stream` dentro do driver do Postgres. O build parava apontando para
 * um arquivo que não tinha nada a ver com o erro.
 *
 * Então quem dispara é a própria rota que registra a aula, DEPOIS de responder.
 * O instrutor não espera, e a fila é o que garante que nada se perde: um corte
 * interrompido continua pendente e é retomado no próximo envio — ou por uma
 * chamada a `/api/cortes`, que existe para não depender disso.
 *
 * UM POR VEZ, DE PROPÓSITO
 *
 * Cortar é I/O e CPU no mesmo processo que atende as requisições. Dois cortes
 * simultâneos deixariam a plataforma lenta para todo mundo enquanto um
 * instrutor envia dois vídeos. A fila espera; a tela do aluno, não.
 *
 * NUNCA LANÇA. Toda falha vira `falharCorte` e o laço continua — um vídeo
 * corrompido não pode levar junto o servidor da plataforma.
 */
let esvaziando = false;

export async function esvaziarFilaDeCortes(limite = 20): Promise<number> {
  /* Reentrância: duas rotas podem disparar ao mesmo tempo. Sem esta guarda,
     dois cortes rodariam sobrepostos no mesmo processo. */
  if (esvaziando) return 0;
  esvaziando = true;

  let feitos = 0;

  try {
    if (!(await temFfmpeg())) {
      console.warn(
        "[corte] ffmpeg não encontrado: vídeos longos ficam inteiros. " +
          "Instale ffmpeg na imagem para o corte automático funcionar.",
      );
      return 0;
    }

    for (let i = 0; i < limite; i++) {
      const trabalho = await pegarProximoCorte();
      if (!trabalho) break;

      try {
        const resultado = await cortarVideo(trabalho);
        await concluirCorte(trabalho.id);
        feitos++;

        console.log(
          `[corte] aula ${trabalho.lessonId} virou ${resultado.partes} parte(s)` +
            (resultado.temExcesso
              ? ` — ALGUMA PASSOU DE ${TETO_DA_AULA_SEGUNDOS}s: quadros-chave esparsos demais`
              : ""),
        );
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : String(erro);
        console.error(`[corte] falhou na aula ${trabalho.lessonId}:`, motivo);
        await falharCorte(trabalho.id, trabalho.lessonId, motivo);
      }
    }
  } catch (erro) {
    /* Falha ao FALAR COM A FILA. Não há trabalho para marcar como falho. */
    console.error("[corte] não foi possível consultar a fila:", erro);
  } finally {
    esvaziando = false;
  }

  return feitos;
}
