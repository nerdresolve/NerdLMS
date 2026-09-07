/**
 * Verificação de codificação dos fontes.
 *
 * Todo arquivo de texto do repositório tem de ser UTF-8 válido. O projeto é
 * escrito em português: acento e travessão aparecem em quase todo comentário,
 * string de interface e migração.
 *
 * Este portão existe porque nenhum outro pega esta falha. O `tsc` e o Node
 * toleram bytes inválidos e seguem em frente — typecheck e a suíte inteira
 * passam com o arquivo já corrompido. Quem recusa é o webpack, no `next build`,
 * com "Failed to read source code from". Ou seja: o erro só aparecia ao montar
 * a imagem, longe de quem o causou.
 *
 * A causa é sempre a mesma: um script que reescreve arquivos em lote sem dizer
 * o encoding. No Windows, gravar sem `encoding` usa a codepage do sistema, e o
 * texto acentuado sai em Latin-1.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const EXTENSOES = [".ts", ".tsx", ".mjs", ".js", ".css", ".sql", ".md", ".json", ".yml"];
const IGNORADOS = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

/* `fatal` faz o decodificador lançar em vez de trocar o byte ruim pelo caractere
   de substituição. Sem isto a verificação passaria em qualquer arquivo, que é
   justamente o modo silencioso de falhar que este portão existe para impedir. */
const utf8 = new TextDecoder("utf-8", { fatal: true });

async function* fontes(dir) {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (IGNORADOS.has(entrada.name)) continue;
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) yield* fontes(caminho);
    else if (EXTENSOES.some((ext) => entrada.name.endsWith(ext))) yield caminho;
  }
}

const quebrados = [];

for await (const caminho of fontes(raiz)) {
  try {
    utf8.decode(await readFile(caminho));
  } catch {
    quebrados.push(relative(raiz, caminho).split("\\").join("/"));
  }
}

if (quebrados.length > 0) {
  console.log(`codificação: ${quebrados.length} arquivo(s) fora de UTF-8`);
  for (const caminho of quebrados) console.log(`  FALHA  ${caminho}`);
  console.log("");
  console.log("Restaure do último commit íntegro e refaça a alteração gravando em UTF-8.");
  console.log("Reconverter os bytes já perdidos produz texto corrompido.");
  process.exit(1);
}

console.log("codificação: todos os fontes em UTF-8 válido");
