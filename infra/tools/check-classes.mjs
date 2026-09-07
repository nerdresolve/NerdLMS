/**
 * Classe de CSS pedida pela tela e definida em lugar nenhum.
 *
 * `className="btn btn--ghost"` com uma variante que não existe não é erro: o
 * navegador aplica o que reconhece, ignora o resto e não avisa ninguém. O botão
 * aparece — só que como botão comum. Nada quebra, nada aparece no console, e a
 * tela só está errada para quem comparar com a de ao lado.
 *
 * Foi o que a auditoria de aparência encontrou, e não em um lugar só:
 *
 *   btn--ghost      25 telas pedindo um botão discreto e recebendo um sólido;
 *   btn--sm         13 telas pedindo um botão pequeno e recebendo o tamanho
 *                   cheio, porque o nome no sistema é `btn--small`;
 *   badge--warning   2 telas pedindo um selo de atenção que nunca existiu.
 *
 * É o mesmo defeito de `check-css.mjs`, um degrau acima: lá o token some, aqui
 * some a regra inteira.
 *
 * O QUE FICA DE FORA, E POR QUÊ
 *
 * Nome montado em tempo de execução — `card--${variante}` — não pode ser
 * conferido daqui: o valor só existe com dados. O verificador descarta o pedaço
 * que termina em `--`, que é o que sobra de uma interpolação, em vez de acusar
 * um nome que ninguém escreveu.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const arquivos = execSync("git ls-files --cached --others --exclude-standard", {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);

const semComentario = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, "");

/* Toda classe que qualquer folha define. O conjunto é global de propósito: uma
   folha importada por uma tela vale para ela, e rastrear qual importa qual daria
   um verificador mais exato e frágil demais para valer a pena. */
const definidas = new Set();
for (const arquivo of arquivos.filter((a) => a.endsWith(".css"))) {
  for (const [, nome] of semComentario(readFileSync(arquivo, "utf8")).matchAll(
    /\.([A-Za-z][A-Za-z0-9_-]*)/g,
  )) {
    definidas.add(nome);
  }
}

const usadas = new Map();
for (const arquivo of arquivos.filter((a) => a.endsWith(".tsx"))) {
  const fonte = semComentario(readFileSync(arquivo, "utf8"));

  for (const achado of fonte.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const bruto = (achado[1] ?? achado[2] ?? "").replace(/\$\{[^}]*\}/g, " ");

    for (const nome of bruto.split(/\s+/)) {
      /* `card--` é o que sobra de `card--${variante}`: o nome inteiro nasce em
         tempo de execução e não há o que conferir. */
      if (!nome || nome.endsWith("-") || definidas.has(nome)) continue;
      if (!usadas.has(nome)) usadas.set(nome, new Set());
      usadas.get(nome).add(arquivo);
    }
  }
}

if (usadas.size === 0) {
  console.log(`check:classes — ${definidas.size} classes definidas, nenhuma pedida sem existir.`);
  process.exit(0);
}

console.error("Classes pedidas pelo JSX e definidas em nenhum CSS:\n");
for (const nome of [...usadas.keys()].sort()) {
  const onde = [...usadas.get(nome)].sort();
  const resto = onde.length > 1 ? ` (+${onde.length - 1} arquivo(s))` : "";
  console.error(`  .${nome}`);
  console.error(`      ${onde[0]}${resto}`);
}
console.error(
  "\nOu a classe passa a existir na folha certa, ou o nome no JSX vira o que o sistema já tem.",
);
process.exit(1);
