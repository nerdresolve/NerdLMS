/**
 * Só as pessoas do seed de homologação, sem o conteúdo fictício.
 *
 * POR QUE EXISTE
 *
 * `npm run seed` traz as contas E sete cursos inventados, com 84 aulas e 20
 * matrículas, tudo em `ON CONFLICT DO UPDATE`. Rodá-lo num banco que já tem o
 * conteúdo real da Exemplo S.A. devolve o catálogo fictício ao lado do
 * verdadeiro, e o catálogo passa a misturar os dois.
 *
 * Na prática, o que se quer ao recriar o ambiente é: gente para entrar, e os
 * cursos reais por cima. Este script faz a primeira metade; `import-cursos.mjs`
 * faz a segunda.
 *
 * COMO ELE ESCOLHE O QUE APLICAR
 *
 * Recorta do `hml.sql` gerado apenas as instruções que escrevem em `users`,
 * `org_units` e `tenants`. Recortar do arquivo GERADO, e não manter uma cópia
 * das contas aqui, evita que as senhas divirjam do seed no dia em que alguém
 * mudar `mocks/data.ts`.
 *
 * Uso: node infra/tools/seed-usuarios.mjs [projeto]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const projeto = process.argv[2] ?? "nerdlms-local";

const hml = readFileSync(join(raiz, "infra", "db", "seeds", "hml.sql"), "utf8");

/** As tabelas que descrevem PESSOAS e onde elas trabalham. */
const PERMITIDAS = new Set(["tenants", "org_units", "users"]);

/*
 * O arquivo é uma sequência de instruções separadas por `;` no fim da linha.
 * Cortar por `;` solto quebraria dentro de texto que contenha ponto e vírgula,
 * e há resumos de curso com ele.
 */
const instrucoes = hml
  .split(/;\s*\n/)
  .map((bloco) => bloco.trim())
  .filter(Boolean);

/**
 * Um bloco, sem o que não é SQL.
 *
 * O `hml.sql` traz uma trava em meta-comando do psql (`\if :{?allow_seed}`),
 * que existe para o seed completo não entrar em produção por descuido. Ela
 * mora no MESMO bloco do primeiro INSERT, e ao ser repassada aqui o psql
 * executava o `\quit` e abandonava tudo em silêncio: a conta de administrador
 * simplesmente não aparecia, sem erro nenhum.
 *
 * A trava continua valendo para `npm run seed`. Este script tem a sua própria
 * garantia, que é aplicar apenas instruções de três tabelas.
 */
const soSql = (bloco) =>
  bloco
    .split("\n")
    .filter((linha) => !linha.trimStart().startsWith("\\"))
    .join("\n")
    .trim();

const escolhidas = instrucoes
  .map(soSql)
  .filter((bloco) => {
    /* `m` e não âncora simples: o bloco pode começar com linhas de comentário,
       e foi assim que a conta de administrador ficou de fora na primeira
       tentativa. O INSERT dela vem depois de vários comentários. */
    const alvo = /^INSERT INTO ([a-z_]+)/im.exec(bloco);
    return alvo ? PERMITIDAS.has(alvo[1].toLowerCase()) : false;
  });

if (escolhidas.length === 0) {
  console.error("nenhuma instrução de usuário no hml.sql. Rode `npm run build:seed` antes.");
  process.exit(1);
}

const sql = ["BEGIN;", ...escolhidas.map((bloco) => `${bloco};`), "COMMIT;"].join("\n");

execFileSync(
  "docker",
  ["exec", "-i", `${projeto}-db-1`, "psql", "-U", "lms_migrator", "-d", "lms",
   "-v", "ON_ERROR_STOP=1", "-q"],
  { input: sql, stdio: ["pipe", "inherit", "inherit"] },
);

const porTabela = new Map();
for (const bloco of escolhidas) {
  const alvo = /^INSERT INTO ([a-z_]+)/im.exec(bloco)[1].toLowerCase();
  porTabela.set(alvo, (porTabela.get(alvo) ?? 0) + 1);
}

console.log(`\n${escolhidas.length} instruções aplicadas, de ${instrucoes.length} no arquivo:`);
for (const [tabela, quantas] of porTabela) console.log(`  ${tabela}: ${quantas}`);
console.log("\nO conteúdo fictício do seed ficou de fora. Os cursos reais entram por");
console.log("`node infra/tools/import-cursos.mjs`.\n");
