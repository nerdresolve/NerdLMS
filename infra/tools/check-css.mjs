/**
 * Variável CSS usada e nunca definida.
 *
 * `color: var(--text-danger)` com um token que não existe não é erro: o
 * navegador descarta a declaração inteira, em silêncio, e o elemento fica com
 * a cor herdada. Nada aparece no console, nada quebra o build, e a tela só
 * está errada para quem olhar.
 *
 * Foram quatro casos achados de uma vez, todos do mesmo jeito — alguém chutou o
 * nome do token pela lógica (`--text-danger`) em vez de olhar o do sistema
 * (`--danger-text`):
 *
 *   quiz.css                — o relógio da prova no último minuto;
 *   interactive-player.css  — o botão sobre o vídeo;
 *   forum.css, studio.css   — a altura de linha de três textos.
 *
 * COM FALLBACK NÃO CONTA
 *
 * `var(--radius-pill, 999px)` funciona: o token pode não existir e o valor de
 * reserva resolve. Fica de fora de propósito — é escolha legítima, e cobrá-la
 * viraria ruído que ninguém lê.
 *
 * DEFINIDO EM JAVASCRIPT TAMBÉM NÃO CONTA
 *
 * `--seek` e `--liberado` nascem no `style` do player, `--font-dm-sans` vem do
 * `next/font`. Nenhum aparece num arquivo `.css`, e todos são usados com
 * fallback — por isso a regra acima já os cobre sem precisar saber deles.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/* `--others --exclude-standard` inclui o que ainda não foi versionado.
   Sem isso o verificador não enxergava folha recém-criada — justamente a que
   tem mais chance de inventar um nome de token —, e passava calado contando
   menos arquivos do que existem. */
const arquivos = execSync("git ls-files --cached --others --exclude-standard", {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter((caminho) => caminho.endsWith(".css") && caminho.startsWith("apps/frontend"));

const definidos = new Set();
for (const caminho of arquivos) {
  for (const achado of readFileSync(caminho, "utf8").matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    definidos.add(achado[1]);
  }
}

const faltando = [];
for (const caminho of arquivos) {
  const linhas = readFileSync(caminho, "utf8").split(/\r?\n/);

  linhas.forEach((linha, i) => {
    /* Só a forma SEM vírgula: com vírgula há valor de reserva. */
    for (const achado of linha.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)) {
      if (!definidos.has(achado[1])) {
        faltando.push({ caminho, linha: i + 1, token: achado[1], texto: linha.trim() });
      }
    }
  });
}

if (faltando.length === 0) {
  console.log(`${arquivos.length} folhas — toda variável usada sem reserva está definida.`);
  process.exit(0);
}

console.log(`${faltando.length} variável(is) usada(s) sem definição e sem valor de reserva:\n`);
for (const item of faltando) {
  console.log(`  FALHA  ${item.caminho}:${item.linha}  ${item.token}`);
  console.log(`         ${item.texto.slice(0, 88)}`);
}
process.exit(1);
