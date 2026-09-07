/**
 * Valida o contraste WCAG dos pares de tokens realmente usados na UI, em Light
 * e Dark. Exigência do Design System §26: qualquer ajuste
 * no pacote oficial ou na camada de override precisa passar por aqui.
 *
 * Uso: node tools/check-contrast.mjs   (exit 1 em caso de falha)
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Ordem de carga igual à do CSS: o override entra por último e vence. */
const SOURCES = [
  "src/styles/nerd-ds/tokens/colors.css",
  "src/styles/nerd-ds/tokens/elevation.css",
  "src/styles/tokens.css",
];

const light = new Map();
const dark = new Map();

for (const source of SOURCES) {
  const raw = await readFile(join(root, source), "utf8");
  // comentários e @import saem primeiro: senão o cabeçalho do arquivo vira "seletor"
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import[^;]+;/g, "");

  // separa cada bloco `seletor { ... }` e roteia para o tema correspondente
  for (const match of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    // o seletor é o último trecho antes da chave, já sem comentários
    const selector = match[1].split("}").pop().trim();
    const isDark = selector.includes('[data-theme="dark"]');
    const isLight = selector === ":root" || selector.startsWith(":root ");
    if (!isDark && !isLight) continue;

    for (const declaration of match[2].split(";")) {
      const pair = declaration.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
      if (!pair) continue;
      const [, name, value] = pair;
      if (isDark) dark.set(name, value);
      else light.set(name, value);
    }
  }
}

/** O tema escuro herda tudo o que não sobrescreve. */
const themes = { light, dark: new Map([...light, ...dark]) };

function resolve(theme, name, depth = 0) {
  if (depth > 12) throw new Error(`Referência circular em ${name}`);
  const raw = theme.get(name);
  if (!raw) throw new Error(`Token inexistente: ${name}`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(theme, ref[1], depth + 1) : raw;
}

function toRgb(color) {
  const hex = color.trim().replace("#", "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Cor não sólida: ${color}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(color) {
  const [r, g, b] = toRgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** [frente, fundo, mínimo, descrição] — 4.5 texto normal, 3.0 UI/texto grande. */
const PAIRS = [
  ["--text-body", "--surface-page", 4.5, "Texto corrido sobre a página"],
  ["--text-body", "--surface-card", 4.5, "Texto corrido sobre card"],
  ["--text-title", "--surface-card", 4.5, "Título sobre card"],
  ["--text-muted", "--surface-card", 4.5, "Texto secundário sobre card"],
  ["--text-muted", "--surface-page", 4.5, "Texto secundário sobre a página"],
  ["--text-brand", "--surface-card", 4.5, "Link sobre card"],
  ["--text-on-brand", "--brand", 4.5, "Texto do botão primário"],
  ["--text-on-brand", "--brand-hover", 4.5, "Botão primário em hover"],
  ["--text-on-brand", "--surface-brand", 4.5, "Texto sobre superfície de marca"],
  ["--brand", "--surface-card", 3.0, "Ícone/borda de marca sobre card"],
  ["--field-border", "--surface-card", 3.0, "Borda de campo sobre card"],
  ["--border-focus", "--surface-card", 3.0, "Anel de foco sobre card"],
  ["--danger-text", "--surface-card", 4.5, "Mensagem de erro"],
  ["--success-text", "--surface-card", 4.5, "Mensagem de sucesso"],
  /* `--text-faint` não era testado e passou meses reprovando no escuro (3.38:1
     sobre card): é a cor de `stat__label`, `comment__time` e do resumo do
     card de curso — texto de leitura, não decoração. */
  ["--text-faint", "--surface-card", 4.5, "Texto terciário sobre card"],
  ["--text-faint", "--surface-page", 4.5, "Texto terciário sobre a página"],
  /* A faixa de números da landing usa este fundo, mais escuro que a página:
     `--text-muted` dava 4.39:1 ali e derrubava a nota só naquela tela. */
  ["--text-muted", "--surface-brand-subtle", 4.5, "Texto secundário sobre faixa de marca"],
  ["--text-faint", "--surface-brand-subtle", 4.5, "Texto terciário sobre faixa de marca"],
  ["--success-text", "--surface-page", 4.5, "Sucesso sobre a página"],
  ["--success-text", "--success-surface", 4.5, "Selo de sucesso"],
  ["--danger-text", "--danger-surface", 4.5, "Selo de erro"],
  ["--fill", "--track", 3.0, "Preenchimento da barra de progresso"],
  ["--sidebar-text", "--sidebar-bg", 4.5, "Item de navegação na sidebar"],
  ["--sidebar-text", "--sidebar-bg-deep", 4.5, "Item de navegação no pé da sidebar"],
  ["--sidebar-text-strong", "--sidebar-active", 4.5, "Item ativo da sidebar"],
  ["--sidebar-section", "--sidebar-bg", 4.5, "Rótulo de seção da sidebar"],
];

let failures = 0;
for (const [name, theme] of Object.entries(themes)) {
  console.log(`\n${name.toUpperCase()}`);
  for (const [fg, bg, min, label] of PAIRS) {
    const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2).padStart(5)}:1 (min ${min.toFixed(1)})  ${label}`);
  }
}

console.log(failures === 0 ? "\nTodos os pares atendem ao WCAG AA." : `\n${failures} par(es) reprovado(s).`);
process.exit(failures === 0 ? 0 : 1);
