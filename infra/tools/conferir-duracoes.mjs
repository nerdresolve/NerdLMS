/**
 * A duração no banco bate com a do arquivo?
 *
 * POR QUE EXISTE
 *
 * As aulas apareceram com 901 e 902 segundos — quinze minutos e um ou dois —
 * numa plataforma cuja regra é "no máximo quinze". Duas causas somadas:
 *
 *   1. o corte com `-segment_time` escolhia o quadro-chave DEPOIS do limite,
 *      nunca o anterior (corrigido em `core/courses/cortes-do-video.ts`);
 *   2. a leitura da duração arredondava para CIMA, e um teto que arredonda
 *      para cima se estoura sozinho (corrigido em `duracao-mp4.mjs`).
 *
 * Este script mede os arquivos que já estão no storage e diz onde o banco
 * discorda deles. Com `--corrigir`, grava a duração medida.
 *
 * NÃO CORTA NADA. Um arquivo que realmente passa do teto continua passando —
 * encurtá-lo perderia conteúdo, e o corte certo se faz sobre o vídeo original.
 * O script separa as duas coisas: o que era erro de contagem, e o que é vídeo
 * grande de verdade.
 *
 *   docker run --rm --network nerdlms-local_internal \
 *     -v "$PWD:/repo" -w /repo -e DATABASE_URL="$DATABASE_URL" \
 *     node:22-alpine sh -c 'apk add -q ffmpeg && node --experimental-strip-types \
 *     infra/tools/conferir-duracoes.mjs'
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { baixarObjeto } from "../../apps/backend/src/storage/object-storage.ts";
import { query } from "../../apps/backend/src/db/pool.ts";
import { TETO_DA_AULA_SEGUNDOS } from "../../packages/core/src/courses/cortes-do-video.ts";

const executar = promisify(execFile);
const corrigir = process.argv.includes("--corrigir");

async function medir(caminho) {
  const { stdout } = await executar(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", caminho],
    { timeout: 5 * 60 * 1000 },
  );

  const valor = Number.parseFloat(stdout.trim());
  return Number.isFinite(valor) ? valor : 0;
}

const aulas = await query(
  `SELECT l.id, l.title, l.duration_seconds, l.media_key
     FROM lessons l
    WHERE l.media_key IS NOT NULL AND l.kind = 'video'
    ORDER BY l.duration_seconds DESC`,
);

console.log(`${aulas.length} aula(s) com vídeo.\n`);

const pasta = await mkdtemp(join(tmpdir(), "duracoes-"));
let divergentes = 0;
let acimaDoTeto = 0;

try {
  for (const aula of aulas) {
    const arquivo = join(pasta, "aula.mp4");

    let real;
    try {
      await baixarObjeto(aula.media_key, arquivo);
      real = await medir(arquivo);
    } catch (erro) {
      console.log(`  ??  ${aula.title}: ${erro instanceof Error ? erro.message : erro}`);
      continue;
    } finally {
      await rm(arquivo, { force: true });
    }

    /* Para baixo, a mesma regra que a leitura passou a usar: a duração
       alimenta um teto. */
    const medida = Math.floor(real);
    const guardada = aula.duration_seconds;
    const passa = medida > TETO_DA_AULA_SEGUNDOS;

    if (passa) acimaDoTeto++;

    if (medida !== guardada) {
      divergentes++;
      console.log(
        `  !=  ${aula.title}: banco ${guardada}s, arquivo ${medida}s` +
          (passa ? "  (acima do teto)" : ""),
      );

      if (corrigir) {
        await query(`UPDATE lessons SET duration_seconds = $2 WHERE id = $1`, [aula.id, medida]);
      }
      continue;
    }

    if (passa) console.log(`  >>  ${aula.title}: ${medida}s, acima do teto`);
  }
} finally {
  await rm(pasta, { recursive: true, force: true });
}

console.log(
  `\n${divergentes} divergência(s) entre banco e arquivo` +
    (corrigir ? " — corrigidas." : ". Rode com --corrigir para gravar."),
);
console.log(`${acimaDoTeto} arquivo(s) realmente acima de ${TETO_DA_AULA_SEGUNDOS}s.`);

process.exit(0);
