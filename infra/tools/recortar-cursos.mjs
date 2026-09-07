/**
 * Recorta os vídeos que já estão publicados, com a matemática corrigida.
 *
 * POR QUE EXISTE
 *
 * As aulas ficaram com 901 segundos — quinze minutos e um. O `-segment_time` do
 * ffmpeg escolhe o quadro-chave DEPOIS do limite, nunca o anterior, e a
 * ferramenta de corte tinha dois minutos de tolerância que deixavam isso passar
 * calado. `planoDeCorte`, no núcleo, escolhe o último quadro-chave ANTES do
 * teto; este script aplica isso ao que já está no ar.
 *
 * PARTE DO ORIGINAL, E NÃO DAS PARTES
 *
 * Recortar uma parte de 901s produziria uma de 899s e um resto de 2s — uma
 * aula de dois segundos. O corte certo se faz sobre o vídeo inteiro, e é por
 * isso que este script precisa da pasta de origem.
 *
 * REAPROVEITA AS AULAS, NÃO AS RECRIA
 *
 * As aulas têm progresso de aluno pendurado (`lesson_progress` é CASCADE) e
 * podem estar referenciadas noutros lugares. Apagar e recriar perderia isso
 * sem nada avisando. Aqui cada aula existente é REESCRITA com a parte
 * correspondente; sobra vira aula nova, e falta é removida — nessa ordem, e só
 * quando o número de partes muda de verdade.
 *
 *   node --experimental-strip-types infra/tools/recortar-cursos.mjs "<pasta CURSOS>" [--aplicar]
 *
 * Sem `--aplicar` ele só mostra o que faria.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  TETO_DA_AULA_SEGUNDOS,
  nomeDaParte,
  planoDeCorte,
} from "../../packages/core/src/courses/cortes-do-video.ts";
import { buildKey, putObject, removeObject } from "../../apps/backend/src/storage/object-storage.ts";
import { query, withTransaction } from "../../apps/backend/src/db/pool.ts";

const executar = promisify(execFile);
const LIMITE_MS = 30 * 60 * 1000;

const origem = process.argv[2];
const aplicar = process.argv.includes("--aplicar");

if (!origem) {
  console.error('uso: node infra/tools/recortar-cursos.mjs "<pasta CURSOS>" [--aplicar]');
  process.exit(1);
}

/* Arredonda os SEGUNDOS TOTAIS antes de separar em minuto e segundo.
   Arredondar só o resto produzia "14min60" para 899,6s — um relógio que não
   existe. */
const minutos = (s) => {
  const total = Math.round(s);
  return `${Math.floor(total / 60)}min${String(total % 60).padStart(2, "0")}`;
};

async function duracaoDe(caminho) {
  const { stdout } = await executar(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", caminho],
    { timeout: LIMITE_MS },
  );
  const valor = Number.parseFloat(stdout.trim());
  return Number.isFinite(valor) ? valor : 0;
}

async function quadrosChaveDe(caminho) {
  const { stdout } = await executar(
    "ffprobe",
    [
      "-v", "error", "-skip_frame", "nokey", "-select_streams", "v:0",
      "-show_entries", "frame=best_effort_timestamp_time", "-of", "csv=p=0", caminho,
    ],
    { timeout: LIMITE_MS, maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout.split("\n").map((l) => Number.parseFloat(l.trim())).filter(Number.isFinite);
}

/** O MP4 dentro da pasta do curso, seja em `com-prova` ou `sem-prova`. */
function acharVideo(codigo) {
  for (const grupo of ["com-prova", "sem-prova"]) {
    for (const nome of [codigo.toUpperCase(), codigo.toLowerCase()]) {
      const pasta = join(origem, grupo, nome);
      if (!existsSync(pasta)) continue;

      const mp4 = readdirSync(pasta).find((a) => a.toLowerCase().endsWith(".mp4"));
      if (mp4) return join(pasta, mp4);
    }
  }
  return null;
}

const cursos = await query(`
  SELECT c.id, c.slug, c.code, c.title, c.tenant_id,
         (SELECT m.id FROM modules m WHERE m.course_id = c.id ORDER BY m.position LIMIT 1) AS module_id
    FROM courses c
   ORDER BY c.slug`);

let recortados = 0;

for (const curso of cursos) {
  const video = acharVideo(curso.code ?? curso.slug);

  if (!video) {
    console.log(`\n${curso.slug}: sem vídeo de origem, pulado`);
    continue;
  }

  const duracao = await duracaoDe(video);
  const plano = planoDeCorte(duracao, await quadrosChaveDe(video));

  const aulas = await query(
    `SELECT l.id, l.title, l.position, l.duration_seconds, l.media_key
       FROM lessons l
      WHERE l.module_id = $1 AND l.kind = 'video'
      ORDER BY l.position`,
    [curso.module_id],
  );

  const acima = aulas.filter((a) => a.duration_seconds > TETO_DA_AULA_SEGUNDOS).length;

  console.log(
    `\n${curso.slug}: ${minutos(duracao)} → ${plano.partes.length} parte(s)` +
      `  (hoje ${aulas.length} aula(s), ${acima} acima do teto)`,
  );

  for (const parte of plano.partes) {
    console.log(`    ${minutos(parte.fim - parte.inicio)}${parte.excedeu ? "  ACIMA" : ""}`);
  }

  if (plano.temExcesso) {
    console.log("    quadros-chave esparsos demais: este vídeo precisaria de recodificação.");
  }

  if (!aplicar || acima === 0) continue;

  /* O TÍTULO DE HOJE FICA.

     As aulas já se chamam "Parte 2 de 5", que é o nome certo e é o que os
     alunos veem. Gerar um nome novo a partir do slug daria "1001 pr 0006
     (parte 2 de 5)", e a partir do título do curso repetiria o nome do curso em
     cada linha da lista. Como a contagem de partes não muda, não há por que
     renomear nada: este script troca a MÍDIA, não a estrutura.

     `base` só serve às partes que não existem hoje — quando o corte novo dá
     mais partes que o antigo. */
  const base = curso.title ?? "Aula";

  const pasta = await mkdtemp(join(tmpdir(), "recorte-"));

  try {
    const novas = [];

    for (const [indice, parte] of plano.partes.entries()) {
      const arquivo = join(pasta, `parte-${indice + 1}.mp4`);

      await executar(
        "ffmpeg",
        [
          "-hide_banner", "-loglevel", "error", "-y",
          "-ss", parte.inicio.toFixed(3),
          "-i", video,
          "-t", (parte.fim - parte.inicio).toFixed(3),
          "-c", "copy", "-map", "0", "-avoid_negative_ts", "make_zero",
          arquivo,
        ],
        { timeout: LIMITE_MS },
      );

      const chave = buildKey("aulas", curso.id, `parte-${indice + 1}.mp4`);
      await putObject(chave, await readFile(arquivo), "video/mp4");
      const real = Math.floor(await duracaoDe(arquivo));

      novas.push({
        titulo: nomeDaParte(base, indice, plano.partes.length),
        chave,
        duracao: real,
      });

      console.log(`      parte ${indice + 1}: ${real}s enviada`);
    }

    const antigas = aulas.map((a) => a.media_key).filter(Boolean);

    await withTransaction(async (exec) => {
      for (const [indice, nova] of novas.entries()) {
        const existente = aulas[indice];

        if (existente) {
          await exec(
            `UPDATE lessons
                SET media_key = $2, duration_seconds = $3, media_status = 'ready'
              WHERE id = $1`,
            [existente.id, nova.chave, nova.duracao],
          );
          continue;
        }

        await exec(
          `INSERT INTO lessons (module_id, title, position, duration_seconds, kind, media_key)
           VALUES ($1, $2, $3, $4, 'video', $5)`,
          [curso.module_id, nova.titulo, indice + 1, nova.duracao, nova.chave],
        );
      }

      /* Sobra: o corte novo deu menos partes que o antigo. */
      for (const sobrando of aulas.slice(novas.length)) {
        await exec(`DELETE FROM lessons WHERE id = $1`, [sobrando.id]);
      }
    });

    /* Os arquivos antigos saem depois de as aulas apontarem para os novos. */
    for (const chave of antigas) await removeObject(chave);

    recortados++;
    console.log(`    ${novas.length} aula(s) reescrita(s).`);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

console.log(
  aplicar
    ? `\n${recortados} curso(s) recortado(s).`
    : "\nNada foi alterado. Rode com --aplicar para gravar.",
);

process.exit(0);
