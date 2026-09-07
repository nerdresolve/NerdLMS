/**
 * Verificação da direção das dependências.
 *
 * A regra é `frontend → backend → core`, e só nesse sentido. O núcleo não sabe
 * que existe banco; o backend não sabe que existe React. É o que permite testar
 * regra de negócio sem subir nada, e o que faria a API sobreviver a uma troca
 * do Next.
 *
 * A regra valia por disciplina, sem nada que a verificasse. Um import na mão
 * errada não quebra teste nem typecheck — passa, funciona, e só cobra o preço
 * depois, quando alguém tenta usar o núcleo fora do servidor e descobre que ele
 * arrasta metade da aplicação junto.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Cada camada e o que ela NÃO pode importar. A ordem da lista é a das camadas:
   quem está mais fundo não enxerga quem está acima. */
const CAMADAS = [
  { nome: "core", dir: "packages/core/src", proibidos: ["@nerdlms/backend", "@nerdlms/frontend"] },
  { nome: "backend", dir: "apps/backend/src", proibidos: ["@nerdlms/frontend"] },
];

/* Além dos pacotes irmãos, o núcleo não pode alcançar o mundo: se ele importa
   `pg` ou `node:fs`, deixou de ser testável sem infraestrutura — que é a única
   razão de ele existir separado.

   A proibição vale para o CÓDIGO, não para o teste dele. Um `.test.ts` que lê o
   próprio fixture do disco (`reports/fixtures/…`) não torna o núcleo dependente
   de infraestrutura: o fixture é parte do teste, e o teste continua rodando com
   `node --test` e nada mais. Proibir ali empurraria o fixture para dentro do
   fonte como base64, que é pior — o arquivo deixa de ser inspecionável e o
   codificador que o gerou deixa de ser independente do nosso leitor. */
const IO_PROIBIDO_NO_CORE = ["pg", "node:fs", "node:fs/promises", "node:http", "node:https"];

const IGNORADOS = new Set(["node_modules", ".next", "dist"]);

async function* fontes(dir) {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (IGNORADOS.has(entrada.name)) continue;
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) yield* fontes(caminho);
    else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) yield caminho;
  }
}

/** O que o arquivo importa: `from "…"` cobre import estático e re-export. */
function importados(codigo) {
  return [...codigo.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

const violacoes = [];

for (const camada of CAMADAS) {
  const proibidos =
    camada.nome === "core" ? [...camada.proibidos, ...IO_PROIBIDO_NO_CORE] : camada.proibidos;

  for await (const caminho of fontes(join(raiz, camada.dir))) {
    const codigo = await readFile(caminho, "utf-8");

    /* O teste do núcleo pode tocar o disco para carregar o próprio fixture; o
       fonte não. Os pacotes irmãos continuam proibidos nos dois. */
    const proibidosAqui = caminho.endsWith(".test.ts")
      ? proibidos.filter((p) => !IO_PROIBIDO_NO_CORE.includes(p))
      : proibidos;

    for (const alvo of importados(codigo)) {
      if (!proibidosAqui.some((p) => alvo === p || alvo.startsWith(`${p}/`))) continue;
      violacoes.push({
        arquivo: relative(raiz, caminho).split("\\").join("/"),
        camada: camada.nome,
        alvo,
      });
    }
  }
}

if (violacoes.length > 0) {
  console.log(`camadas: ${violacoes.length} import(s) na direção errada`);
  for (const v of violacoes) console.log(`  FALHA  ${v.arquivo} (${v.camada}) importa ${v.alvo}`);
  console.log("");
  console.log("A dependência vai só de frontend para backend, e de backend para core.");
  process.exit(1);
}

console.log("camadas: dependências só na direção frontend → backend → core");
