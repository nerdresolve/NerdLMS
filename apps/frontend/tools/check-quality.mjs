/**
 * Auditoria estática de qualidade.
 *
 * O Lighthouse precisa de navegador e de rede (BLOCK-001). Este script cobre,
 * sem sair do container, os pontos das categorias de Performance, Acessibilidade
 * e Boas Práticas que dá para verificar no HTML e no CSS gerados. Não substitui
 * o Lighthouse: é o portão que roda hoje, a cada build.
 *
 * Uso: node tools/check-quality.mjs   (exit 1 em caso de falha)
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Peso máximo por página, em kB. Acima disso o carregamento começa a doer. */
const PAGE_BUDGET_KB = 220;
/** Peso máximo de um asset servido em public/. */
const ASSET_BUDGET_KB = 120;

const failures = [];
const warnings = [];

function check(condition, page, message) {
  if (!condition) failures.push(`${page}: ${message}`);
}

function warn(condition, page, message) {
  if (!condition) warnings.push(`${page}: ${message}`);
}

const pages = (await readdir(join(root, "preview"))).filter(
  (name) => name.endsWith(".html") && !name.endsWith(".template.html"),
);

/* Um preview mais antigo que o código é pior que preview nenhum: passa nos
   testes exibindo uma versão que já não existe. */
async function newestSourceTime(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const times = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return newestSourceTime(path);
      return (await stat(path)).mtimeMs;
    }),
  );
  return Math.max(0, ...times);
}

const sourceTime = Math.max(
  await newestSourceTime(join(root, "src")),
  await newestSourceTime(join(root, "tools")),
);

if (pages.length === 0) failures.push("preview/: nenhuma página gerada — rode `npm run preview`");

for (const page of pages) {
  const html = await readFile(join(root, "preview", page), "utf8");

  /* A fonte e o vídeo entram como data URI **só no protótipo**, para o arquivo
     abrir do disco sem servidor. Em produção a fonte é servida uma vez e
     cacheada, e o vídeo vem do armazenamento. Medir o peso com eles dentro faz
     o portão vigiar um número que não existe no produto — e eu já havia
     recomprimido o vídeo três vezes por causa disso. O orçamento agora mede o
     conteúdo da página. */
  const embedded = [...html.matchAll(/data:(?:font|video)\/[^;]+;base64,[A-Za-z0-9+/=]+/g)]
    .reduce((total, match) => total + match[0].length, 0);

  const sizeKb = (Buffer.byteLength(html) - embedded) / 1024;

  const { mtimeMs } = await stat(join(root, "preview", page));
  check(mtimeMs >= sourceTime, page, "gerado antes da última alteração de código — rode `npm run preview`");

  /* As checagens de marcação olham só o corpo: dentro de <style> existe CSS que
     fala *sobre* HTML (comentários, seletores) e gerava falso positivo. */
  const markup = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");

  /* ---------------------------------------------------------- performance */
  check(
    sizeKb <= PAGE_BUDGET_KB,
    page,
    `${sizeKb.toFixed(0)} kB de conteúdo excede o orçamento de ${PAGE_BUDGET_KB} kB (sem contar fonte e vídeo embutidos)`,
  );

  // Toda imagem precisa de width/height: sem isso o layout salta (CLS).
  const images = markup.match(/<img[^>]*>/g) ?? [];
  const semDimensao = images.filter((tag) => !/\bwidth=/.test(tag) || !/\bheight=/.test(tag));
  check(semDimensao.length === 0, page, `${semDimensao.length} <img> sem width/height (causa layout shift)`);

  // A fonte é auto-hospedada. Nenhuma origem externa deve reaparecer,
  // e o carregamento nunca pode bloquear o texto.
  check(!html.includes("fonts.googleapis.com"), page, "voltou a depender do Google Fonts");
  check(!html.includes("fonts.gstatic.com"), page, "voltou a depender do Google Fonts");
  if (html.includes("@font-face")) {
    check(html.includes("font-display: swap"), page, "@font-face sem font-display: swap");
  }

  // Script síncrono no <head> bloqueia a primeira pintura.
  const headEnd = html.indexOf("</head>");
  const head = headEnd === -1 ? "" : html.slice(0, headEnd);
  check(!/<script(?![^>]*(?:defer|async|type="application\/ld\+json"))/.test(head), page, "script bloqueante no <head>");

  /* -------------------------------------------------------- acessibilidade */
  check(/<html[^>]*\slang="pt-BR"/.test(html), page, 'falta lang="pt-BR" no <html>');
  check(/<meta[^>]*name="viewport"/.test(html), page, "falta meta viewport");
  check(/user-scalable=no|maximum-scale=1/.test(html) === false, page, "viewport impede o zoom do usuário");
  check(/<title>[^<]+<\/title>/.test(html), page, "falta <title>");

  const h1 = markup.match(/<h1\b/g) ?? [];
  check(h1.length === 1, page, `deve existir exatamente um <h1> (encontrados ${h1.length})`);

  // Ordem de headings não pode pular nível.
  const levels = [...markup.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
  const pulo = levels.findIndex((level, index) => index > 0 && level - levels[index - 1] > 1);
  check(pulo === -1, page, `hierarquia de headings pula de h${levels[pulo - 1]} para h${levels[pulo]}`);

  check((markup.match(/<img(?![^>]*\salt=)/g) ?? []).length === 0, page, "<img> sem alt");
  check((markup.match(/<label(?![^>]*\bfor=)/g) ?? []).length === 0, page, "<label> sem for");
  check(
    (markup.match(/<svg(?![^>]*aria-hidden)(?![^>]*role="img")/g) ?? []).length === 0,
    page,
    "<svg> sem aria-hidden nem role=img",
  );

  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicados = ids.filter((id, index) => ids.indexOf(id) !== index);
  check(duplicados.length === 0, page, `id duplicado: ${[...new Set(duplicados)].join(", ")}`);

  const referencias = [...markup.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)]
    .flatMap((match) => match[1].split(" "))
    .filter((id) => !ids.includes(id));
  check(referencias.length === 0, page, `referência ARIA sem alvo: ${referencias.join(", ")}`);

  // o drawer duplica a navegação, mas fica `hidden` — não conta duas vezes
  const semDrawer = markup.replace(/<div class="drawer"[\s\S]*?<\/div>\s*<script/, "<script");
  const paginaAtual = (semDrawer.match(/aria-current="page"/g) ?? []).length;
  warn(paginaAtual <= 1, page, `${paginaAtual} elementos com aria-current="page" (deveria ser no máximo um)`);

  check(html.includes("prefers-reduced-motion"), page, "não respeita prefers-reduced-motion");
  // só faz sentido exigir "pular para o conteúdo" onde existe navegação a pular
  check(!html.includes("<nav") || html.includes("skip-link"), page, "falta link para pular ao conteúdo");

  /* -------------------------------------------------------- boas práticas */
  check(!/\bstyle="[^"]*(?:width|height|margin|padding):/.test(markup), page, "estilo de layout inline no HTML");
  /* ------------------------------------------------- CSS faltando ------
     Cinco vezes um estilo nasceu numa feature, foi reusado em outra tela e a
     regra não foi junto — botão sem cor, campo com largura errada, lacuna de
     32px. A verificação abaixo compara as classes que a página usa com as que
     ela realmente carrega. */
  const styleBlock = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  const definidas = new Set([...styleBlock.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));

  const usadas = new Set(
    [...markup.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)).filter(Boolean),
  );

  // Classes que existem só para o JS ou para a barra de QA encontrar elementos.
  const semEstilo = new Set(["state-data", "state-loading", "state-empty", "qa", "qa-state", "sr-only"]);

  const semRegra = [...usadas].filter((cls) => !definidas.has(cls) && !semEstilo.has(cls));
  check(
    semRegra.length === 0,
    page,
    `classe sem regra CSS nesta página: ${semRegra.join(", ")} — o estilo mora numa feature que a página não carrega`,
  );

  check(!html.includes("localStorage"), page, "uso de localStorage (não suportado no ambiente de artefato)");
}

/* ------------------------------------------------------------ assets */
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return files.flat();
}

for (const path of await walk(join(root, "public"))) {
  const { size } = await stat(path);
  const kb = size / 1024;
  const relative = path.replace(`${root}/`, "");
  check(kb <= ASSET_BUDGET_KB, relative, `${kb.toFixed(0)} kB excede o orçamento de ${ASSET_BUDGET_KB} kB`);
}

/* ------------------------------------------------------------ relatório */
console.log(`Páginas auditadas: ${pages.join(", ")}`);
for (const message of warnings.filter(Boolean)) console.log(`  AVISO  ${message}`);
for (const message of failures) console.log(`  FALHA  ${message}`);

console.log(
  failures.length === 0
    ? "\nTodas as verificações estáticas passaram."
    : `\n${failures.length} verificação(ões) reprovada(s).`,
);
process.exit(failures.length === 0 ? 0 : 1);
