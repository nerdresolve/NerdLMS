/**
 * Todo pacote importado precisa estar declarado — TASK-065.
 *
 * Existe porque `server-only` era importado por seis arquivos sem estar no
 * `package.json`. Sem node_modules e sem rede, nada acusava: os testes rodam
 * só os módulos de domínio, que não importam pacote externo. O erro só
 * apareceu na primeira instalação real, em outra máquina.
 *
 * Verifica também o caminho inverso: dependência declarada e nunca usada, que
 * vira peso e superfície de ataque sem ninguém notar.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Pacotes que o Next injeta e não precisam ser declarados. */
const IMPLICIT = new Set(["next", "react", "react-dom"]);

/** Subpacotes contam para o pacote raiz: `next/font/local` → `next`. */
function packageOf(specifier) {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

async function walk(dir, extensoes = /\.(ts|tsx|js|jsx|mjs)$/) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path, extensoes)));
    else if (extensoes.test(entry.name)) files.push(path);
  }
  return files;
}

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

const used = new Map();
let failures = 0;

/* Ferramenta em Python também consome dependência: `certificate-preview.py` lê
   o `pdfjs-dist` direto de node_modules para renderizar o PDF no Chromium.
   Sem contar isto, o pacote apareceria como "declarado e nunca importado" e a
   saída seria removê-lo — quebrando a única forma de OLHAR o certificado. */
for (const file of await walk(join(root, "tools"), /\.py$/)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/node_modules["'\s/]+(@?[\w.-]+(?:\/[\w.-]+)?)/g)) {
    const nome = packageOf(match[1]);
    used.set(nome, (used.get(nome) ?? 0) + 1);
  }
}

/* Os arquivos de configuração da RAIZ do app entram junto: `eslint.config.mjs`
   importa `@eslint/eslintrc`, e sem varrê-lo o pacote aparecia como "declarado
   e nunca importado" — a saída seria removê-lo e quebrar o lint. */
const raizDoApp = ["eslint.config.mjs", "next.config.ts"].map((nome) => join(root, nome));

for (const file of [
  ...(await walk(join(root, "src"))),
  ...(await walk(join(root, "tools"))),
  ...raizDoApp,
]) {
  const source = await readFile(file, "utf8");
  const specifiers = [
    ...source.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s*["']([^"']+)["']/g),
    ...source.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]);

  for (const specifier of specifiers) {
    // Relativo e alias interno não são pacote.
    if (specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("/")) continue;
    if (specifier.startsWith("node:") || builtinModules.includes(specifier)) continue;

    const name = packageOf(specifier);
    const list = used.get(name) ?? [];
    list.push(file.replace(`${root}/`, ""));
    used.set(name, list);
  }
}

console.log(`Pacotes externos importados: ${used.size}\n`);

for (const [name, files] of [...used].sort()) {
  if (declared.has(name) || IMPLICIT.has(name)) {
    console.log(`  ok      ${name} (${files.length} arquivo${files.length === 1 ? "" : "s"})`);
    continue;
  }
  failures += 1;
  console.log(`  FALHA   ${name} importado mas não declarado — ${files[0]}`);
}

// Dependência declarada e nunca importada: peso e superfície sem uso.
/* Ferramentas e dependências de runtime que ninguém importa por nome:
   `react-dom` é exigido pelo Next para renderizar, mesmo sem aparecer em
   nenhum `import`. Removê-la quebraria o build — não é peso morto. */
const tooling = new Set([
  "typescript",
  "eslint",
  "eslint-config-next",
  "@lhci/cli",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "react-dom",
]);
for (const name of declared) {
  if (used.has(name) || tooling.has(name)) continue;
  failures += 1;
  console.log(`  FALHA   ${name} declarado e nunca importado`);
}

console.log(
  failures === 0
    ? "\nTodo pacote importado está declarado, e todo declarado é usado."
    : `\n${failures} problema(s).`,
);
process.exit(failures === 0 ? 0 : 1);
