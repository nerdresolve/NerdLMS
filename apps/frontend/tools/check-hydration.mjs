import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guarda contra quebra de hidratação por formatação dependente de ambiente.
 *
 * O QUE ELE PEGA, e por que importa:
 *
 * `toLocaleDateString("pt-BR")` sem `timeZone` formata no fuso de quem executa.
 * No servidor isso é UTC; no navegador, o fuso de quem lê. Uma data de 03:00
 * UTC sai "23 de ago" lá e "22 de ago" aqui — e texto diferente entre servidor
 * e cliente é HIDRATAÇÃO QUEBRADA (React #418).
 *
 * O sintoma não é um erro visível: o React descarta a árvore do cliente e a
 * PÁGINA INTEIRA para de responder a clique. Foi assim que apareceu — um botão
 * de copiar link que chamava a função certa, copiava certo, e nunca mudava de
 * rótulo. Levou meia hora para achar, e o mesmo defeito estava latente em duas
 * outras telas que ninguém tinha clicado ainda.
 *
 * Só vale para COMPONENTE DE CLIENTE. Um componente de servidor renderiza uma
 * vez, no servidor, e nunca hidrata — ali `toLocaleString` sem fuso é seguro.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(AQUI, "..", "src");

/** As funções que dependem do fuso de quem executa. */
const FORMATADORES = /\.toLocale(?:Date|Time)?String\s*\(/g;

/** `Intl.DateTimeFormat` tem o mesmo problema pelo mesmo motivo. */
const INTL = /new\s+Intl\.DateTimeFormat\s*\(/g;

async function arquivos(dir) {
  const saida = [];

  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...(await arquivos(full)));
      continue;
    }
    if (entrada.name.endsWith(".tsx") || entrada.name.endsWith(".ts")) saida.push(full);
  }

  return saida;
}

/**
 * A chamada declara `timeZone`?
 *
 * Olha os 220 caracteres seguintes: as opções vêm logo depois, e uma chamada
 * multilinha cabe nesse trecho. Aceitar o arquivo inteiro daria falso negativo
 * — um `timeZone` noutra função "cobriria" a chamada errada.
 */
function temFuso(conteudo, indice) {
  return /timeZone/.test(conteudo.slice(indice, indice + 220));
}

/**
 * Formatar NÚMERO não tem o problema: `toLocaleString` sobre número usa
 * separador de milhar, que não depende de fuso.
 */
function ehNumero(conteudo, indice) {
  const antes = conteudo.slice(Math.max(0, indice - 40), indice);
  return /\b(?:linhas|count|total|valor|numero|qtd|n)\s*$/i.test(antes);
}

const problemas = [];

for (const caminho of await arquivos(SRC)) {
  const conteudo = await readFile(caminho, "utf8");

  /* Só componente de cliente: é o único que hidrata. */
  if (!/^\s*["']use client["']/m.test(conteudo)) continue;

  for (const padrao of [FORMATADORES, INTL]) {
    padrao.lastIndex = 0;
    let achado;

    while ((achado = padrao.exec(conteudo)) !== null) {
      if (temFuso(conteudo, achado.index)) continue;
      if (padrao === FORMATADORES && ehNumero(conteudo, achado.index)) continue;

      const linha = conteudo.slice(0, achado.index).split("\n").length;
      problemas.push(`${caminho.replace(/.*src[\\/]/, "src/")}:${linha} — ${achado[0]}`);
    }
  }
}

if (problemas.length > 0) {
  console.error("Formatação de data sem `timeZone` em componente de cliente:\n");
  for (const problema of problemas) console.error(`  ${problema}`);
  console.error(
    "\nSem `timeZone`, servidor e navegador formatam diferente, a hidratação quebra\n" +
      "(React #418) e a página para de responder a clique. Use `timeZone: \"UTC\"`.\n",
  );
  process.exit(1);
}

console.log("Datas em componentes de cliente: todas com fuso explícito.");
