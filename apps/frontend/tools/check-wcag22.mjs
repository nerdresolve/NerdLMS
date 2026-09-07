/**
 * Critérios novos da WCAG 2.2 — F0-13.
 *
 * A verificação existente cobre contraste e estrutura, que são 2.1. A 2.2
 * acrescentou critérios que não existiam, e o guia (§34) os coloca como
 * requisito de produto:
 *
 *   2.4.11 Focus Not Obscured  — o elemento com foco não pode ficar escondido
 *                                atrás de barra fixa
 *   2.4.13 Focus Appearance    — o indicador de foco precisa de área e
 *                                contraste mínimos
 *   2.5.7  Dragging Movements  — toda ação de arrastar precisa de alternativa
 *   2.5.8  Target Size         — alvo de 24x24 CSS, com exceções
 *   3.3.8  Accessible Auth     — sem exigir memorizar ou transcrever
 *
 * Nem tudo se verifica sem navegador: `2.4.11` depende de layout real e é
 * coberto pelo E2E. O que este script faz é olhar o CSS e o HTML gerados e
 * reprovar o que já dá para reprovar sem abrir uma página.
 *
 * Uso: node tools/check-wcag22.mjs   (exit 1 em caso de falha)
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

let falhas = 0;

function check(condicao, criterio, mensagem) {
  if (condicao) return;
  falhas += 1;
  console.log(`  FALHA  ${criterio}: ${mensagem}`);
}

async function lerCss() {
  const dir = join(RAIZ, "src", "styles");
  const partes = [];

  async function walk(atual) {
    for (const entrada of await readdir(atual, { withFileTypes: true })) {
      const full = join(atual, entrada.name);
      if (entrada.isDirectory()) {
        await walk(full);
        continue;
      }
      if (entrada.name.endsWith(".css")) partes.push(await readFile(full, "utf8"));
    }
  }

  await walk(dir);

  /* O CSS de feature vive junto do componente, não em `styles/`. */
  async function walkFeatures(atual) {
    for (const entrada of await readdir(atual, { withFileTypes: true })) {
      const full = join(atual, entrada.name);
      if (entrada.isDirectory()) {
        await walkFeatures(full);
        continue;
      }
      if (entrada.name.endsWith(".css")) partes.push(await readFile(full, "utf8"));
    }
  }

  await walkFeatures(join(RAIZ, "src", "features"));

  return partes.join("\n");
}

async function arquivosTsx(dir, saida = []) {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      await arquivosTsx(full, saida);
      continue;
    }
    if (entrada.name.endsWith(".tsx") && !entrada.name.includes(".test.")) saida.push(full);
  }
  return saida;
}

console.log("WCAG 2.2 — critérios novos\n");

const css = await lerCss();
const arquivos = await arquivosTsx(join(RAIZ, "src"));

/* Por arquivo E concatenado: alguns critérios valem para o produto inteiro
   (não há CAPTCHA em lugar nenhum), outros só fazem sentido dentro do arquivo
   onde o gesto acontece — ver 2.5.7 abaixo. */
const conteudosTsx = await Promise.all(arquivos.map((f) => readFile(f, "utf8")));
const jsx = conteudosTsx.join("\n");

/* ---------------------------------------------------------------- 2.5.8
   Alvo de toque de 24x24 CSS.

   O produto já adota 44px (`--touch-target`), que é mais folgado que o
   mínimo. O que se verifica aqui é que o token continua existindo e sendo
   usado — se alguém o remover, os alvos encolhem sem que nada mais reclame. */
check(
  /--touch-target\s*:/.test(css),
  "2.5.8 Target Size",
  "o token `--touch-target` sumiu — sem ele os alvos de toque não têm piso",
);

check(
  /min-height:\s*var\(--touch-target\)|min-block-size:\s*var\(--touch-target\)/.test(css),
  "2.5.8 Target Size",
  "`--touch-target` não é aplicado a nenhum controle",
);

/* ---------------------------------------------------------------- 2.4.13
   Aparência do foco.

   A 2.2 pede indicador com pelo menos 2px de espessura e 3:1 de contraste.
   `outline: none` sem substituto é a forma clássica de reprovar — e é o que
   se procura aqui. */
const outlineNone = [...css.matchAll(/outline\s*:\s*(none|0)\b/gi)];
const temFocusVisible = /:focus-visible/.test(css);

check(
  outlineNone.length === 0 || temFocusVisible,
  "2.4.13 Focus Appearance",
  "há `outline: none` sem nenhum `:focus-visible` que devolva o indicador",
);

check(
  /--focus-ring|--shadow-focus/.test(css),
  "2.4.13 Focus Appearance",
  "não há token de anel de foco",
);

/* ---------------------------------------------------------------- 2.5.7
   Movimentos de arrastar.

   Toda ação que depende de arrastar precisa de alternativa por ponteiro único.

   A verificação é POR ARQUIVO, e essa é a correção que importa: a primeira
   versão procurava a alternativa no código inteiro concatenado, e como dezenas
   de arquivos têm `onKeyDown`, a condição era sempre verdadeira. Ela passou no
   primeiro drag-and-drop de verdade do produto MESMO com os botões removidos —
   um verificador que nunca reprova não verifica nada.

   `onKeyDown` sozinho também não vale mais como prova: ele aparece em qualquer
   componente que trate Escape ou Enter. O que conta é um controle que MOVE o
   item — botão rotulado para isso, ou a semântica ARIA de lista reordenável. */
const ALTERNATIVA = /Mover .*para (cima|baixo)|aria-roledescription|aria-grabbed/;

for (const [caminho, conteudo] of arquivos.map((f, i) => [f, conteudosTsx[i]])) {
  if (!/onDragStart|onDrop\s*=|draggable\s*=/.test(conteudo)) continue;

  check(
    ALTERNATIVA.test(conteudo),
    "2.5.7 Dragging Movements",
    `${caminho.split(/[\\/]/).pop()}: arrastar sem alternativa por clique — ` +
      "todo arrasto precisa de um controle que faça o mesmo sem arrastar",
  );
}

/* ---------------------------------------------------------------- 3.3.8
   Autenticação acessível.

   Não pode exigir teste cognitivo — resolver enigma, transcrever caractere,
   memorizar. Na prática: o campo de senha precisa aceitar colar (de gerenciador
   de senhas), e não pode haver CAPTCHA de transcrição. */
check(
  !/onPaste\s*=\s*\{[^}]*preventDefault/.test(jsx),
  "3.3.8 Accessible Authentication",
  "algum campo bloqueia colar — impede gerenciador de senhas",
);

check(
  !/captcha/i.test(jsx),
  "3.3.8 Accessible Authentication",
  "há CAPTCHA, que é teste cognitivo sem alternativa",
);

/* ---------------------------------------------------------------- 2.4.11
   Foco não obscurecido.

   Depende de layout real e é verificado no E2E. O que dá para checar aqui é o
   `scroll-padding-top`: sem ele, uma âncora ou um `Tab` levam o elemento para
   debaixo da barra fixa. */
check(
  /scroll-padding-top\s*:/.test(css),
  "2.4.11 Focus Not Obscured",
  "sem `scroll-padding-top`, o foco some atrás da barra fixa ao navegar por teclado",
);

console.log(
  falhas === 0
    ? "\nOs critérios novos da 2.2 verificáveis estaticamente passaram."
    : `\n${falhas} critério(s) reprovado(s).`,
);

process.exit(falhas === 0 ? 0 : 1);
