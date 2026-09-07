/**
 * Corta os vídeos longos em aulas de no máximo 15 minutos.
 *
 * POR QUE EXISTE, E POR QUE FICA SEPARADO
 *
 * Vídeo de uma hora não é assistido inteiro: a pessoa perde o fio, sai e volta
 * do começo. O corte em partes menores também melhora o registro — uma aula de
 * 56 minutos abandonada aos 50 aparece como não concluída, enquanto quatro
 * aulas de 15 mostram exatamente onde ela parou.
 *
 * ESTA FERRAMENTA DEPENDE DE ffmpeg, e é a única do repositório que depende de
 * algo de fora. Ela roda UMA VEZ, sobre o material de origem, e o resultado é
 * o que entra na plataforma. O ffmpeg não faz parte da aplicação nem do
 * ambiente: instale, rode isto, desinstale.
 *
 *   scoop install ffmpeg      (ou winget, ou o gerenciador que preferir)
 *   node infra/tools/cortar-cursos.mjs <origem> <destino>
 *   scoop uninstall ffmpeg
 *
 * CORTE SEM RECODIFICAR
 *
 * `-c copy` copia os fluxos como estão: é rápido, não perde qualidade e não
 * exige placa nenhuma. O preço é que o corte só acontece em quadro-chave, e
 * por isso as partes não saem com 15 minutos exatos. O script MEDE cada parte
 * depois de cortar e reprova se alguma passar do teto com folga, porque um
 * vídeo com quadros-chave esparsos produziria partes muito maiores que o
 * pedido sem nenhum aviso.
 *
 * O ORIGINAL NÃO É TOCADO. A saída vai para outra pasta.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const origem = process.argv[2];
const destino = process.argv[3];

if (!origem || !destino) {
  console.error("uso: node infra/tools/cortar-cursos.mjs <origem> <destino>");
  process.exit(1);
}

/** O teto por aula, em segundos. Precisa bater com `duracao-da-aula.ts`. */
const TETO = 15 * 60;

/**
 * Acima disto, a parte é reprovada.
 *
 * ERA 120 SEGUNDOS, e era esse o defeito.
 *
 * O `-segment_time` do ffmpeg corta no primeiro quadro-chave DEPOIS do limite,
 * nunca no anterior — daí as aulas de 15 minutos e 1 segundo. A tolerância de
 * dois minutos deixava isso passar calado.
 *
 * O corte certo escolhe o último quadro-chave ANTES do teto, e está em
 * `packages/core/src/courses/cortes-do-video.ts`, testado sem ffmpeg. O corte
 * automático do upload usa ele. Esta ferramenta continua servindo para
 * material de origem em lote, e agora reprova QUALQUER excesso — se aparecer,
 * é sinal de quadros-chave esparsos demais, e aí o vídeo precisa de
 * recodificação, não de tolerância.
 */
const EXCESSO_ACEITAVEL = 0;

function ffprobeDuracao(arquivo) {
  const saida = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arquivo],
    { encoding: "utf8" },
  );
  const valor = Number.parseFloat(saida.trim());
  return Number.isFinite(valor) ? valor : 0;
}

const minutos = (s) => `${Math.floor(s / 60)}min${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Todos os MP4 da árvore de origem, com a pasta a que pertencem. */
function acharVideos(raiz) {
  const achados = [];

  for (const nivel1 of readdirSync(raiz)) {
    const caminho1 = join(raiz, nivel1);
    if (!statSync(caminho1).isDirectory()) continue;

    for (const nivel2 of readdirSync(caminho1)) {
      const caminho2 = join(caminho1, nivel2);
      if (!statSync(caminho2).isDirectory()) continue;

      for (const arquivo of readdirSync(caminho2)) {
        if (!arquivo.toLowerCase().endsWith(".mp4")) continue;
        achados.push({ pasta: nivel1, codigo: nivel2, arquivo, caminho: join(caminho2, arquivo) });
      }
    }
  }

  return achados;
}

const videos = acharVideos(origem);
if (videos.length === 0) {
  console.error(`nenhum .mp4 em ${origem}`);
  process.exit(1);
}

console.log(`${videos.length} vídeos em ${origem}\n`);

const relatorio = [];
let reprovadas = 0;

for (const video of videos) {
  const duracao = ffprobeDuracao(video.caminho);
  const pastaDestino = join(destino, video.pasta, video.codigo);
  mkdirSync(pastaDestino, { recursive: true });

  /* O que não é vídeo vai junto: o `prova.txt` mora ao lado do arquivo, e o
     parser espera achar os dois na mesma pasta. Sem copiar, a pasta cortada
     produziria cursos sem prova. */
  const pastaOrigem = join(origem, video.pasta, video.codigo);
  for (const arquivo of readdirSync(pastaOrigem)) {
    if (arquivo.toLowerCase().endsWith(".mp4")) continue;
    writeFileSync(join(pastaDestino, arquivo), readFileSync(join(pastaOrigem, arquivo)));
  }

  const base = basename(video.arquivo, extname(video.arquivo));

  /* Vídeo que já cabe é COPIADO, não cortado. Passar pelo segmentador só para
     produzir um arquivo idêntico gastaria tempo e mudaria o contêiner sem
     necessidade. */
  if (duracao <= TETO + EXCESSO_ACEITAVEL) {
    const saida = join(pastaDestino, `${base}.mp4`);
    writeFileSync(saida, readFileSync(video.caminho));
    console.log(`  ${video.codigo}: ${minutos(duracao)} cabe inteiro, copiado`);
    relatorio.push({ codigo: video.codigo, pasta: video.pasta, partes: [{ arquivo: `${base}.mp4`, duracao }] });
    continue;
  }

  console.log(`  ${video.codigo}: ${minutos(duracao)}, cortando...`);

  /* `-reset_timestamps 1` faz cada parte começar do zero. Sem isso a segunda
     parte abre no minuto 15 e o player mostra a barra já pela metade. */
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", video.caminho,
      "-c", "copy",
      "-map", "0",
      "-f", "segment",
      "-segment_time", String(TETO),
      "-reset_timestamps", "1",
      "-segment_start_number", "1",
      join(pastaDestino, `${base}-parte%02d.mp4`),
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

  const partes = readdirSync(pastaDestino)
    .filter((nome) => nome.startsWith(`${base}-parte`))
    .sort()
    .map((nome) => ({ arquivo: nome, duracao: ffprobeDuracao(join(pastaDestino, nome)) }));

  for (const parte of partes) {
    const excedeu = parte.duracao > TETO + EXCESSO_ACEITAVEL;
    if (excedeu) reprovadas++;
    console.log(`      ${excedeu ? "ACIMA" : "ok   "} ${parte.arquivo}  ${minutos(parte.duracao)}`);
  }

  relatorio.push({ codigo: video.codigo, pasta: video.pasta, partes });
}

const total = relatorio.reduce((soma, item) => soma + item.partes.length, 0);
console.log(`\n${total} aulas geradas em ${destino}`);

if (reprovadas > 0) {
  console.error(
    `\n${reprovadas} parte(s) passaram do teto com folga. O vídeo tem quadros-chave ` +
      `esparsos demais para corte por cópia, e precisaria ser recodificado.`,
  );
  process.exit(1);
}

/* O mapa serve ao parser, que precisa saber quais arquivos formam cada curso e
   em que ordem. Deduzir pela ordem alfabética funcionaria hoje e quebraria no
   dia em que uma parte passar de nove. */
const mapa = join(destino, "partes.json");
writeFileSync(mapa, `${JSON.stringify({ teto: TETO, cursos: relatorio }, null, 2)}\n`, "utf8");
console.log(`mapa das partes em ${mapa}`);
