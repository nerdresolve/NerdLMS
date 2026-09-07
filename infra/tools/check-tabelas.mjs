/**
 * Célula de tabela sem rótulo, que some no celular.
 *
 * `.table` vira LISTA abaixo de 720px: o `<thead>` é escondido e cada célula
 * passa a mostrar o nome da coluna por `content: attr(data-label)`. É o que
 * torna uma tabela de cinco colunas legível num telefone.
 *
 * A célula que não declara `data-label` não some — some o NOME dela. No modo
 * estreito ficam números soltos, um sob o outro, sem nada dizendo o que são.
 * A tabela do painel da gestão mostrava "1 / 0% / 0" e mais nada.
 *
 * Onze telas estavam assim, cinquenta e sete células ao todo, e nenhuma
 * quebrava nada: no monitor do desenvolvedor a tabela está sempre certa.
 *
 * O RÓTULO VAZIO É UMA RESPOSTA
 *
 * `data-label=""` passa. A coluna de seletor da equipe não tem nome visível, e
 * declarar o vazio é diferente de esquecer — que é justamente a diferença que
 * este verificador existe para cobrar.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const arquivos = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((a) => a.endsWith(".tsx"));

const faltando = [];

for (const arquivo of arquivos) {
  const fonte = readFileSync(arquivo, "utf8");
  if (!fonte.includes('className="table"')) continue;

  /* Só as tabelas do produto: `.table` é quem carrega o modo estreito. Uma
     `<table>` sem essa classe não vira lista e não precisa do rótulo. */
  for (const tabela of fonte.matchAll(/<table\b[^>]*className="table"[\s\S]*?<\/table>/g)) {
    for (const celula of tabela[0].matchAll(/<td\b([^>]*)>/g)) {
      if (!celula[1].includes("data-label")) {
        const antes = fonte.slice(0, tabela.index + celula.index);
        faltando.push({ arquivo, linha: antes.split("\n").length, trecho: celula[0].slice(0, 60) });
      }
    }
  }
}

if (faltando.length === 0) {
  console.log("check:tabelas — toda célula declara o rótulo que o celular mostra.");
  process.exit(0);
}

console.error("Células de tabela sem `data-label` (somem de nome no celular):\n");
for (const { arquivo, linha, trecho } of faltando) {
  console.error(`  ${arquivo}:${linha}  ${trecho}`);
}
console.error(
  '\nCada `<td>` de uma `.table` declara `data-label` com o nome da coluna.\nColuna sem nome visível declara `data-label=""`.',
);
process.exit(1);
