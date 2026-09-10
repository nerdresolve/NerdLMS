/**
 * Verificação dos comandos citados na documentação.
 *
 * Todo `npm run <algo>` escrito num `.md` tem de existir no `package.json` do
 * pacote correspondente. Quem lê a documentação copia e cola: um comando que
 * não existe para em "Missing script", e a pessoa não tem como saber se errou
 * de passo ou se o texto é que envelheceu.
 *
 * Este portão existe porque a documentação envelhece calada. Ao consolidar os
 * arquivos de ambiente num `infra/.env` só, sumiram `compose:prod`,
 * `migrate:prod` e `up:prod`; três documentos continuaram ensinando os três,
 * e nenhum teste reclamou, porque nada aqui é código executado.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IGNORADOS = new Set(["node_modules", ".next", ".git", "dist", "coverage", ".work"]);

/* Comandos que a documentação cita para ilustrar o que NÃO fazer, ou que
   pertencem a outro projeto que a pessoa vai criar. */
const TOLERADOS = new Set();

async function scripts() {
  const nomes = new Set();
  const pacotes = [
    "package.json",
    "apps/frontend/package.json",
    "apps/backend/package.json",
    "packages/core/package.json",
  ];

  for (const p of pacotes) {
    try {
      const json = JSON.parse(await readFile(join(raiz, p), "utf8"));
      for (const nome of Object.keys(json.scripts ?? {})) nomes.add(nome);
    } catch {
      /* Pacote sem `package.json` próprio não contribui com script nenhum. */
    }
  }

  return nomes;
}

async function markdowns(dir) {
  const achados = [];

  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (IGNORADOS.has(entrada.name)) continue;
    const caminho = join(dir, entrada.name);

    if (entrada.isDirectory()) achados.push(...(await markdowns(caminho)));
    else if (entrada.name.endsWith(".md")) achados.push(caminho);
  }

  return achados;
}

const disponiveis = await scripts();
const faltando = [];

for (const caminho of await markdowns(raiz)) {
  const texto = await readFile(caminho, "utf8");

  texto.split("\n").forEach((linha, i) => {
    /* `npm run x`, `npm run x -- ...` e `npm run x --workspace y`. O nome do
       script aceita `:` porque é assim que o projeto agrupa variantes. */
    for (const achado of linha.matchAll(/npm run ([a-z][a-z0-9:_-]*)/g)) {
      const nome = achado[1];
      if (disponiveis.has(nome) || TOLERADOS.has(nome)) continue;
      faltando.push({ arquivo: relative(raiz, caminho), linha: i + 1, nome });
    }
  });
}

if (faltando.length > 0) {
  console.log(`comandos: ${faltando.length} citação(ões) de script inexistente`);
  for (const f of faltando) console.log(`  FALHA  ${f.arquivo}:${f.linha}  npm run ${f.nome}`);
  console.log("");
  console.log("Corrija o texto, ou registre o script no package.json.");
  process.exit(1);
}

console.log("comandos: todo `npm run` citado na documentação existe");
