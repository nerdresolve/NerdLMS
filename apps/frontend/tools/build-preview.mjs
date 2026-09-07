/**
 * Gera as páginas de validação visual em preview/.
 *
 * Regras que este script existe para garantir:
 *   1. o preview usa o CSS real do produto (tokens, base e o CSS da feature);
 *   2. os números exibidos vêm das funções de domínio reais sobre o seed real —
 *      nenhum percentual é digitado à mão em HTML;
 *   3. o grafismo vem de @nerdlms/core/brand/mosaic.ts, a mesma fonte do componente React.
 *
 * Uso: node --experimental-strip-types tools/build-preview.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { MOSAIC_SHAPES } from "@nerdlms/core/brand/mosaic.ts";
import { buildCertificate, certificateCode } from "@nerdlms/core/reports/certificate.ts";
import {
  admin,
  allCourses,
  manager,
  catalogOnly,
  comments,
  courses,
  enrollments,
  allEnrollments,
  allUsers,
  auditEvents,
  instructors,
  learners,
  materials,
  student,
  events,
  notifications,
  tracks,
} from "../src/mocks/data.ts";
import { courseOutline } from "@nerdlms/core/courses/outline.ts";
import { catalogCounts, normalizeForSearch, queryCatalog, toCatalogEntries } from "@nerdlms/core/courses/catalog.ts";
import { engagementSummary, learnerRows } from "@nerdlms/core/courses/engagement.ts";
import { activeByProject, activeUsers, lastDays } from "@nerdlms/core/courses/active-users.ts";
import { trackView } from "@nerdlms/core/courses/tracks.ts";
import { recommend } from "@nerdlms/core/courses/recommendations.ts";
import { WEEKLY_VOTE_BUDGET, highlights, relevantIds, sortByRelevance } from "@nerdlms/core/courses/social.ts";
import { REWARDS, badgesFor, balanceOf, earningsOf, levelOf } from "@nerdlms/core/courses/gamification.ts";
import { monthGrid, sortNotifications, unreadCount, upcoming } from "@nerdlms/core/courses/calendar.ts";
import { auditSummary, isSensitive, queryAudit, repeatedDenials } from "@nerdlms/core/courses/audit.ts";
import { formatClock, lessonView } from "@nerdlms/core/courses/lesson.ts";
import { LANDING_POINTS, landingStats } from "@nerdlms/core/landing.ts";
import {
  courseDurationSeconds,
  courseProgress,
  formatDuration,
  greeting,
  resumePoint,
} from "@nerdlms/core/courses/progress.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Páginas que este build precisa produzir.
 *
 * Existe porque uma refatoração apagou silenciosamente o bloco que gerava
 * `lesson.html`: o arquivo antigo continuou no disco, os portões seguiram
 * lendo a versão obsoleta e ninguém percebeu por dois ciclos. Agora, se um
 * bloco sumir, o build falha.
 */
const EXPECTED_PAGES = [
  "login.html",
  "landing.html",
  "dashboard.html",
  "catalog.html",
  "completed.html",
  "favorites.html",
  "course.html",
  "lesson.html",
  "profile.html",
  "library.html",
  "studio.html",
  "editor.html",
  "engagement.html",
  "admin.html",
  "users.html",
  "manager.html",
  "team.html",
  "tracks.html",
  "rewards.html",
  "agenda.html",
  "audit.html",
];
const generated = new Set();

/** Ícones do pacote usados pelas telas. Nome = arquivo em public/brand/icons. */
const ICON_NAMES = new Set([
  "house", "graduation-cap", "circle-check", "circle-check-big", "book-open", "star",
  "user", "settings", "log-out", "menu", "x", "bell", "search", "panel-left",
  "play", "clock", "arrow-right", "layers", "award", "chevron-right",
  "check", "bookmark", "list-video", "inbox", "award", "calendar", "plus", "lock", "chevron-left",
  "circle-alert", "list-filter",
  "pause", "volume-2", "maximize", "captions", "file-text", "arrow-left",
  "mail", "trending-up", "users", "moon", "sun", "send", "message-circle", "thumbs-up",
]);
const read = (path) => readFile(join(root, path), "utf8");

/**
 * Lê um CSS resolvendo os @import relativos recursivamente.
 *
 * Sem isso o preview inlineava apenas a folha de topo e perdia todos os tokens
 * do pacote oficial — a página abria sem cor nenhuma. Imports remotos (a fonte
 * do Google) são descartados: o template já carrega a fonte por <link>.
 */
async function readCss(path, seen = new Set()) {
  if (seen.has(path)) return "";
  seen.add(path);

  const css = await readFile(join(root, path), "utf8");
  const dir = dirname(path);
  let out = "";
  let rest = css;

  const IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/g;
  let match;
  while ((match = IMPORT.exec(css)) !== null) {
    const target = match[1];
    if (/^https?:/.test(target)) continue;

    /* `@/` é o alias de `src/` — o mesmo que o tsconfig dá ao TypeScript e o
       bundler resolve no CSS. Sem tratá-lo aqui, `join()` montava um caminho
       com um diretório literal `@` e o preview morria num ENOENT, acusando de
       quebrado um arquivo que o produto carrega sem problema. */
    const resolvido = target.startsWith("@/")
      ? join("src", target.slice("@/".length))
      : join(dir, target);

    out += await readCss(resolvido.replace(/\\/g, "/"), seen);
  }

  rest = rest.replace(IMPORT, "");
  return `${out}\n${rest}`;
}
const readBase64 = async (path) => (await readFile(join(root, path))).toString("base64");

/** Escapa texto para HTML. Nenhum dado entra no template sem passar por aqui. */
function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

/**
 * Reescreve as rotas do produto para os arquivos do preview, tornando as cinco
 * telas um protótipo navegável. Vale só para o preview: o app usa as rotas
 * reais do Next. Rotas ainda não construídas viram âncoras inertes, para o
 * cliente não cair num 404 durante a demonstração.
 */
const PREVIEW_ROUTES = [
  [/href="\/dashboard"/g, 'href="dashboard.html"'],
  [/href="\/meus-cursos"/g, 'href="catalog.html"'],
  [/href="\/cursos\/[^"]*"/g, 'href="course.html"'],
  [/href="\/cursos"/g, 'href="library.html"'],
  [/href="\/concluidos"/g, 'href="completed.html"'],
  [/href="\/favoritos"/g, 'href="favorites.html"'],
  [/href="\/instrutor\/cursos\/[^"]*"/g, 'href="editor.html"'],
  [/href="\/agenda"/g, 'href="agenda.html"'],
  [/href="\/conquistas"/g, 'href="rewards.html"'],
  [/href="\/trilhas"/g, 'href="tracks.html"'],
  [/href="\/gestor\/equipe"/g, 'href="team.html"'],
  [/href="\/gestor"/g, 'href="manager.html"'],
  [/href="\/admin\/auditoria"/g, 'href="audit.html"'],
  [/href="\/admin\/usuarios"/g, 'href="users.html"'],
  [/href="\/admin"/g, 'href="admin.html"'],
  [/href="\/instrutor\/engajamento"/g, 'href="engagement.html"'],
  [/href="\/instrutor"/g, 'href="studio.html"'],
  [/href="\/perfil"/g, 'href="profile.html"'],
  [/href="\/aulas\/[^"]*"/g, 'href="lesson.html"'],
  [/href="\/sair"/g, 'href="login.html"'],
  [/href="\/login"/g, 'href="login.html"'],
];

function linkPreviews(html) {
  let out = html;
  for (const [pattern, replacement] of PREVIEW_ROUTES) out = out.replace(pattern, replacement);
  // o que sobrou aponta para tela não construída: fica inerte e anunciada como tal
  return out.replace(
    /href="\/[^"]*"/g,
    'href="#" aria-disabled="true" title="Tela ainda não construída" data-preview="pendente"',
  );
}

/**
 * Embute a fonte no CSS do preview.
 *
 * No app a fonte é servida de /fonts; o preview é um arquivo solto que precisa
 * funcionar aberto do disco, então o `src:` vira data URI.
 *
 * Só Regular e Bold entram. A família tem oito arquivos, e embutir todos
 * somaria ~215 kB a CADA uma das 21 páginas — o orçamento de peso
 * (check-quality.mjs) é 220 kB para a página inteira. Os dois pesos cobrem
 * texto e título; os demais o navegador sintetiza, e no protótipo isso basta.
 *
 * Os @font-face dos pesos NÃO embutidos são removidos: um `src:` apontando
 * para `/fonts/` não resolve num arquivo aberto do disco, e o navegador
 * registraria a família com uma fonte que nunca chega.
 */
const PESOS_NO_PREVIEW = new Set(["Satoshi-Regular", "Satoshi-Bold"]);

async function embedFont(css) {
  if (!/url\("\/fonts\/Satoshi-/.test(css)) return css;

  const embutidos = new Map();
  for (const nome of PESOS_NO_PREVIEW) {
    embutidos.set(nome, await readBase64(`public/fonts/${nome}.woff2`));
  }

  return css.replace(/@font-face\{[^}]*\}/g, (bloco) => {
    const nome = bloco.match(/url\("\/fonts\/([A-Za-z-]+)\.woff2"\)/)?.[1];
    if (!nome) return bloco;
    const b64 = embutidos.get(nome);
    if (!b64) return "";
    return bloco.replace(/src:[^;]+;/, `src:url("data:font/woff2;base64,${b64}") format("woff2");`);
  });
}

/**
 * Injeta no protótipo a MESMA store que o app React usa.
 *
 * O arquivo é JavaScript puro justamente para poder ser servido ao navegador
 * sem passo de build. O `export` é removido porque o protótipo carrega tudo
 * num <script> clássico, não como módulo — assim funciona aberto do disco,
 * sem servidor.
 */
async function buildRuntime(seedJson, courseJson = "null") {
  // A store mora em `@nerdlms/core`, e aqui ela é lida como TEXTO (não importada)
  // para ser injetada no <script> do protótipo. `import.meta.resolve` acha o
  // arquivo pelo nome do pacote, sem depender de quantos `..` separam os dois.
  const store = (await readFile(fileURLToPath(import.meta.resolve("@nerdlms/core/store/learner-store.js")), "utf8"))
    .replace(/^export /gm, "")
    .replace(/\bexport const learnerStore[^;]+;/, "");
  const binding = await read("preview/prototype.js");

  return `<script>
${store}
window.NERD_STORE = createStore();
window.NERD_PERCENT = percentOf;
window.NERD_SEED = ${seedJson};
/* O catálogo que o navegador precisa para RECONTAR: por curso, os ids das
   aulas e a duração de cada uma. Sem isto o protótipo sabe que uma aula foi
   concluída, mas não sabe de quantas o curso é feito — e os agregados do
   dashboard e do perfil ficam congelados no build. */
window.NERD_CATALOG = ${catalogJson};
window.NERD_COURSE = ${courseJson};
window.NERD_USER = ${JSON.stringify({
    id: student.id,
    name: student.fullName,
    initials: student.fullName.split(" ").map((p) => p[0]).slice(0, 2).join(""),
  })};
</script>
<script>
${binding}
</script>`;
}

function icon(name, className = "") {
  if (!ICON_NAMES.has(name)) throw new Error(`Ícone fora do conjunto Lucide do pacote: ${name}`);
  return `<svg class="icon${className ? ` ${className}` : ""}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}

/**
 * Monta o sprite a partir dos SVGs Lucide que vêm no pacote oficial.
 * Nenhuma tela desenha path à mão — regra do README do Design System.
 */
async function buildIconSprite(names) {
  const symbols = await Promise.all(
    [...names].map(async (name) => {
      const svg = await read(`public/brand/icons/${name}.svg`);
      const inner = svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
      return `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`;
    }),
  );
  return `<svg class="icon-sprite" width="0" height="0" aria-hidden="true" focusable="false">${symbols.join("")}</svg>`;
}

/* `fill-rule="evenodd"` não é decoração: sem ele o anel fecha e vira disco. */
function mosaico(variant, className, tone = "cor") {
  const shape = MOSAIC_SHAPES[variant];
  const paths = shape.paths
    .map((path) => `<path d="${path.d}" fill="${tone === "silhueta" ? "var(--tile-ghost)" : path.fill}" />`)
    .join("");
  return `<svg class="${className}" viewBox="${shape.viewBox}" preserveAspectRatio="${shape.preserveAspectRatio}" fill-rule="evenodd" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** Estado vazio na versão do pacote: onda suave, ícone, título, texto, ação. */
function emptyState({ icon: iconName, title, text, action, level = 3 }) {
  return `<div class="empty">
            <span class="empty__rule" aria-hidden="true"></span>
            <div class="empty__inner">
              <span class="empty__icon">${icon(iconName)}</span>
              <h${level} class="empty__title">${esc(title)}</h${level}>
              <p class="empty__text">${esc(text)}</p>
              ${action ? `<div class="empty__actions">${action}</div>` : ""}
            </div>
          </div>`;
}

function progressBar(percent, { onBrand = false, attribute = "" } = {}) {
  return `<div class="progress-bar${onBrand ? " progress-bar--on-brand" : ""}"${attribute ? ` ${attribute}` : ""} role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso do curso" style="--value:${percent}%">
        <div class="progress-bar__fill"></div>
      </div>`;
}

/**
 * @param {string} templateName
 * @param {string} outputName
 * @param {Array<{ marker: string, path: string }>} styles
 * @param {Record<string, string>} replacements
 */
/**
 * Persistência do tema no protótipo — a mesma chave do produto
 * (`src/lib/theme.ts`, `nerd-theme`), para as duas superfícies concordarem.
 *
 * `sessionStorage`, e não `localStorage`: é o que a store do protótipo já usa
 * (`packages/core/src/store/learner-store.js`) porque o ambiente de artefato
 * onde estas páginas rodam não tem `localStorage`. No produto é `localStorage`
 * — lá a escolha deve sobreviver a fechar a aba.
 *
 * Vai no `<head>` de toda página, e não num template: precisa rodar antes da
 * primeira pintura, senão a tela aparece clara e escurece em seguida. Injetado
 * aqui porque é idêntico nas 21 páginas — deixá-lo nos templates seria a mesma
 * linha copiada onze vezes, e foi assim que a persistência acabou não
 * existindo em nenhuma delas.
 *
 * Guarda a escolha e ressincroniza os controles: o botão da topbar troca de
 * ícone e de rótulo, e o "Dark" da barra de QA vira "Light". Sem isso a página
 * abriria escura com o botão dizendo que está clara.
 */
const THEME_BOOT = `(function () {
  var KEY = "nerd-theme";

  function lido() {
    try { return sessionStorage.getItem(KEY) === "dark" ? "dark" : "light"; } catch (e) { return "light"; }
  }

  function aplicar(tema) {
    var escuro = tema === "dark";
    document.documentElement.setAttribute("data-theme", tema);

    var qa = document.getElementById("qa-theme");
    if (qa) {
      qa.setAttribute("aria-pressed", String(escuro));
      qa.textContent = escuro ? "Light" : "Dark";
    }

    var topo = document.getElementById("theme-toggle");
    if (topo) {
      topo.setAttribute("aria-pressed", String(escuro));
      topo.setAttribute("aria-label", escuro ? "Ativar modo claro" : "Ativar modo escuro");
      var uso = topo.querySelector("use");
      if (uso) uso.setAttribute("href", escuro ? "#i-sun" : "#i-moon");
    }
  }

  window.NERD_THEME = {
    atual: lido,
    alternar: function () {
      var proximo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try { sessionStorage.setItem(KEY, proximo); } catch (e) {}
      aplicar(proximo);
    }
  };

  /* Duas passadas: agora, para o atributo valer antes da pintura; e no
     DOMContentLoaded, quando os botões já existem para serem sincronizados. */
  aplicar(lido());
  document.addEventListener("DOMContentLoaded", function () { aplicar(lido()); });
})();`;

async function render(templateName, outputName, styles, replacements) {
  const seen = new Set();
  const template = await read(`preview/${templateName}`);
  const css = [];
  for (const { path } of styles) css.push(await embedFont(await readCss(path, seen)));

  const parts = {
    ...Object.fromEntries(styles.map(({ marker }, index) => [marker, css[index].trim()])),
    ...replacements,
  };

  /* @@SEED@@ não é marcador de template: alimenta o runtime injetado. */
  const { "@@SEED@@": seed = "{}", "@@COURSE_JSON@@": courseJson = "null", ...markers } = { ...parts };
  markers["@@RUNTIME@@"] = await buildRuntime(seed, courseJson);

  let html = template;
  for (const [marker, content] of Object.entries(markers)) {
    if (!html.includes(marker)) throw new Error(`${templateName}: marcador ausente → ${marker}`);
    html = html.replaceAll(marker, content);
  }

  const leftover = html.match(/@@[A-Z_]+@@/);
  if (leftover) throw new Error(`${templateName}: marcador não substituído → ${leftover[0]}`);

  html = linkPreviews(html);

  /* Antes de qualquer <style> ou <link>: o atributo precisa estar no <html>
     quando o CSS for aplicado, senão a página pisca clara. */
  html = html.replace("<head>", `<head>
<script>${THEME_BOOT}</script>`);

  await writeFile(join(root, `preview/${outputName}`), html, "utf8");
  generated.add(outputName);
  console.log(`preview/${outputName} (${(html.length / 1024).toFixed(1)} kB)`);
}

/* Estado inicial do aluno, a partir dos dados fictícios. É o que `hydrate`
   receberá do servidor quando a API existir. */
const seedState = JSON.stringify({
  progress: Object.fromEntries(
    enrollments
      .filter((enrollment) => enrollment.learnerId === student.id)
      .flatMap((enrollment) => Object.values(enrollment.progress).map((item) => [item.lessonId, item.watchedSeconds])),
  ),
  saved: Object.fromEntries(
    enrollments.filter((enrollment) => enrollment.saved).map((enrollment) => [enrollment.courseId, true]),
  ),
  enrolled: Object.fromEntries(enrollments.map((enrollment) => [enrollment.courseId, true])),
  comments: comments,
});

/* webp, e não png: o logotipo da Exemplo S.A. tem degradê no sol, e em PNG
   ficaria 5x maior — multiplicado pelas 21 páginas que o embutem. */
/* Só id e duração: o navegador não precisa de título nem de resumo para
   contar, e cada campo a mais é peso em 21 páginas. */
const catalogJson = JSON.stringify(
  allCourses.map((course) => ({
    id: course.id,
    lessons: course.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({ id: lesson.id, duration: lesson.durationSeconds })),
    ),
  })),
);

const wordmark = `data:image/png;base64,${await readBase64("public/brand/nerdresolve-wordmark.png")}`;
const markWhite = `data:image/png;base64,${await readBase64("public/brand/nerdresolve-mark.png")}`;
const wordmarkWhite = `data:image/png;base64,${await readBase64("public/brand/nerdresolve-wordmark-white.png")}`;

/* ------------------------------------------------------------------ login */
await render(
  "login.template.html",
  "login.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@LOGIN@@ */", path: "src/features/auth/login.css" },
  ],
  {
    "@@MOSAIC@@": mosaico("vertical", "brand__waves", "silhueta"),
    "@@LOGO@@": wordmarkWhite,
  },
);

/* -------------------------------------------------------------- dashboard */

// Todos os números abaixo são calculados, nunca digitados.
const rows = courses.map((course) => {
  const enrollment = enrollments.find((item) => item.courseId === course.id);
  if (!enrollment) throw new Error(`Seed inconsistente: sem matrícula para ${course.id}`);
  return {
    course,
    enrollment,
    summary: courseProgress(course, enrollment),
    resume: resumePoint(course, enrollment),
    duration: courseDurationSeconds(course),
  };
});

const totals = rows.reduce(
  (acc, row) => ({
    lessons: acc.lessons + row.summary.total,
    completed: acc.completed + row.summary.completed,
    finished: acc.finished + (row.summary.status === "completed" ? 1 : 0),
    watchedSeconds:
      acc.watchedSeconds +
      Object.values(row.enrollment.progress).reduce((sum, item) => sum + item.watchedSeconds, 0),
  }),
  { lessons: 0, completed: 0, finished: 0, watchedSeconds: 0 },
);

const overallPercent = totals.lessons === 0 ? 0 : Math.round((totals.completed / totals.lessons) * 100);

// Curso em destaque: o mais avançado entre os que ainda não terminaram.
const featured = rows
  .filter((row) => row.resume !== null && row.summary.completed > 0)
  .sort((a, b) => b.summary.percent - a.summary.percent)[0];
if (!featured?.resume) throw new Error("Seed sem curso em andamento para o hero.");

const continueBlock = `<article class="continue">
          ${mosaico("layered", "continue__waves", "silhueta")}
          <div class="continue__body">
            <span class="eyebrow">${icon("play")} Continue aprendendo</span>
            <h2 class="continue__title">${esc(featured.course.title)}</h2>
            <p class="continue__lesson">${esc(featured.resume.module.title)} · ${esc(featured.resume.lesson.title)}</p>
            <p class="continue__meta">${icon("clock")} ${
              featured.resume.resumeAtSeconds >= 60
                ? `Retoma em ${esc(formatDuration(featured.resume.resumeAtSeconds))} de ${esc(formatDuration(featured.resume.lesson.durationSeconds))}`
                : `Aula de ${esc(formatDuration(featured.resume.lesson.durationSeconds))}`
            }</p>

            <div class="continue__progress">
              <div class="progress-legend">
                <span>Seu progresso no curso</span>
                <span class="progress-legend__value">${featured.summary.percent}%</span>
              </div>
              ${progressBar(featured.summary.percent, { onBrand: true })}
            </div>

            <a class="btn btn--primary btn--on-brand" href="/cursos/${esc(featured.course.slug)}">
              Continuar aula ${icon("arrow-right")}
            </a>
          </div>
        </article>`;

const summaryBlock = (() => {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - overallPercent / 100);

  return `<aside class="card" aria-labelledby="seu-progresso">
          <h2 class="card__title" id="seu-progresso">Seu progresso</h2>

          <div class="ring">
            <svg class="ring__svg" viewBox="0 0 148 148" role="img" aria-label="${overallPercent}% das aulas concluídas">
              <circle class="ring__track" cx="74" cy="74" r="${radius}" />
              <circle class="ring__value" cx="74" cy="74" r="${radius}"
                      stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" />
            </svg>
            <span class="ring__label" aria-hidden="true">
              <span class="ring__percent" data-agg="percent">${overallPercent}%</span>
              <span class="ring__caption">concluído</span>
            </span>
          </div>

          <dl class="stat-list">
            <div class="stat">
              <dt class="stat__label">${icon("circle-check")} Aulas concluídas</dt>
              <dd class="stat__value" data-agg="lessons">${totals.completed} de ${totals.lessons}</dd>
            </div>
            <div class="stat">
              <dt class="stat__label">${icon("award")} Cursos concluídos</dt>
              <dd class="stat__value" data-agg="courses">${totals.finished} de ${rows.length}</dd>
            </div>
            <div class="stat">
              <dt class="stat__label">${icon("clock")} Tempo assistido</dt>
              <dd class="stat__value">${esc(formatDuration(totals.watchedSeconds))}</dd>
            </div>
          </dl>
        </aside>`;
})();

const artClass = ["", " course-card__art--b", " course-card__art--c", " course-card__art--d"];
const artTile = ["art1", "art2", "art3", "art4"];

/** Card de curso — usado pelo dashboard e pelo catálogo, para não divergirem. */
/* O nível do título muda com o contexto: no dashboard os cards ficam sob a
   seção "Meus cursos" (h2), então são h3; no catálogo são o primeiro nível
   abaixo do h1 da página. */
function courseCard({ course, summary, duration, available }, extraAttributes = "", level = 3) {
    const done = summary.status === "completed";
    const chip = done
      ? `<span class="course-card__chip course-card__chip--done">${icon("circle-check-big")} Concluído</span>`
      : available
        ? `<span class="course-card__chip course-card__chip--available">${summary.total} aulas</span>`
        : `<span class="course-card__chip" data-card-percent>${summary.percent}%</span>`;

    return `<${available ? "div" : "a"} class="course-card${available ? " course-card--available" : ""}"${available ? "" : ` href="/cursos/${esc(course.slug)}"`} data-card-course="${esc(course.id)}"${extraAttributes ? ` ${extraAttributes}` : ""}>
            <div class="course-card__art${artClass[course.artwork]}">
              ${mosaico(artTile[course.artwork], "", "silhueta")}
              ${chip}
            </div>
            <div class="course-card__body">
              <h${level} class="course-card__title">${esc(course.title)}</h${level}>
              <p class="course-card__summary">${esc(course.summary)}</p>
              <div class="course-card__foot">
                ${
                  available
                    ? `<span class="course-card__count">
                  ${icon("layers")} ${summary.total} aulas · ${esc(formatDuration(duration))}
                </span>
                <span class="course-card__enroll">
                  ${
                    course.enrollmentMode === "open"
                      ? `<button type="button" class="btn btn--primary" data-enroll="${esc(course.id)}">Inscrever-se</button>`
                      : `<span class="badge badge--neutral">${icon("lock")} Matrícula pelo gestor</span>`
                  }
                </span>`
                    : `${progressBar(summary.percent, { attribute: "data-card-bar" })}
                <span class="course-card__count">
                  ${icon("layers")} <span data-card-count>${summary.completed} de ${summary.total}</span> aulas · ${esc(formatDuration(duration))}
                </span>`
                }
              </div>
            </div>
          </${available ? "div" : "a"}>`;
}

const courseCards = rows.map((row) => courseCard(row)).join("\n          ");

const skeletons = Array.from(
  { length: 3 },
  () => `<div class="course-card">
            <div class="skeleton skeleton--art"></div>
            <div class="course-card__body">
              <div class="skeleton skeleton--title"></div>
              <div class="skeleton skeleton--line"></div>
              <div class="course-card__foot"><div class="skeleton skeleton--line"></div></div>
            </div>
          </div>`,
).join("\n          ");

const NAV = [
  { section: null, items: [
    { label: "Dashboard", icon: "house", href: "/dashboard", current: true },
    { label: "Trilhas", icon: "layers", href: "/trilhas" },
    { label: "Meus cursos", icon: "graduation-cap", href: "/meus-cursos", badge: String(rows.filter((row) => row.summary.status === "in_progress").length) },
    { label: "Concluídos", icon: "circle-check", href: "/concluidos" },
    { label: "Conquistas", icon: "star", href: "/conquistas" },
    { label: "Agenda", icon: "calendar", href: "/agenda" },
  ] },
  { section: "Biblioteca", items: [
    { label: "Todos os cursos", icon: "book-open", href: "/cursos" },
    { label: "Favoritos", icon: "star", href: "/favoritos" },
  ] },
  { section: "Conta", items: [
    { label: "Perfil", icon: "user", href: "/perfil" },
    { label: "Configurações", icon: "settings", href: "/configuracoes" },
    { label: "Sair", icon: "log-out", href: "/sair" },
  ] },
];

const navMarkup = NAV.map(({ section, items }) => {
  const heading = section ? `<p class="sidebar__section">${esc(section)}</p>` : "";
  const links = items
    .map((item) => `<a class="nav-item" href="${item.href}"${item.current ? ' aria-current="page"' : ""}>
          ${icon(item.icon)}
          <span class="nav-item__label">${esc(item.label)}</span>
          ${item.badge ? `<span class="nav-item__badge">${esc(item.badge)}</span>` : ""}
        </a>`)
    .join("\n        ");
  return `${heading}\n        ${links}`;
}).join("\n        ");

const initials = student.fullName
  .split(" ")
  .map((part) => part[0])
  .slice(0, 2)
  .join("");

// Hora fixa para o preview ser determinístico entre builds.
const PREVIEW_HOUR = 9;

await render(
  "dashboard.template.html",
  "dashboard.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": navMarkup,
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@GREETING@@": `${greeting(PREVIEW_HOUR)}, ${esc(student.firstName)}`,
    "@@SUBTITLE@@": "Continue de onde parou. Você está a poucas aulas do próximo certificado.",
    "@@CONTINUE@@": continueBlock,
    "@@SUMMARY@@": summaryBlock,
    "@@COURSES@@": courseCards,
    "@@SKELETONS@@": skeletons,
    "@@EMPTY@@": emptyState({
      icon: "graduation-cap",
      title: "Você ainda não tem cursos",
      text: "Assim que você for matriculado em um curso, ele aparece nesta lista. Fale com seu gestor para solicitar acesso.",
      action: '<a class="btn btn--secondary" href="/cursos">Ver catálogo</a>',
    }).replace('class="empty"', 'class="empty state-empty"'),
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": await buildIconSprite(ICON_NAMES),
  },
);


/* ----------------------------------------------------------- página de curso */

const featuredRow = featured;
const outline = courseOutline(featuredRow.course, featuredRow.enrollment);

const heroBlock = `<section class="course-hero">
          <div class="course-hero__body">
            <h1 class="course-hero__title">${esc(featuredRow.course.title)}</h1>
            <p class="course-hero__summary">${esc(featuredRow.course.summary)}</p>

            <div class="course-hero__meta">
              <span class="badge badge--on-brand">${icon("layers")} ${outline.modules.length} módulos</span>
              <span class="badge badge--on-brand">${icon("list-video")} ${outline.lessonCount} aulas</span>
              <span class="badge badge--on-brand">${icon("clock")} ${esc(outline.duration)}</span>
            </div>

            <div class="course-hero__progress">
              <div class="progress-legend">
                <span>Seu progresso</span>
                <span class="progress-legend__value" data-course-percent>${outline.progress.percent}%</span>
              </div>
              ${progressBar(outline.progress.percent, { onBrand: true, attribute: "data-course-bar" })}
            </div>

            <div class="course-hero__actions">
              <a class="btn btn--primary btn--on-brand" href="/aulas/${esc(outline.currentLessonId ?? "")}">
                ${icon("play")} Continuar curso
              </a>
              <button type="button" class="icon-button icon-button--on-brand"
                      data-save-course="${esc(featuredRow.course.id)}" aria-pressed="false"
                      aria-label="Salvar nos favoritos">${icon("bookmark")}</button>
            </div>
            <p class="status-text" id="curso-status" role="status"></p>
          </div>

          <div class="course-hero__art" aria-hidden="true">${mosaico("layered", "", "silhueta")}</div>
        </section>`;

const modulesBlock = outline.modules
  .map((module, moduleIndex) => {
    const open = module.id === outline.defaultOpenModuleId;
    const panelId = `modulo-${moduleIndex + 1}`;
    const lessons = module.lessons
      .map((lesson) => {
        const marker =
          lesson.state === "done" ? icon("check") : lesson.state === "current" ? icon("play") : String(lesson.index);
        const label =
          lesson.state === "done" ? "Aula concluída" : lesson.state === "current" ? "Aula atual" : "Aula não iniciada";
        return `<a class="lesson" href="/aulas/${esc(lesson.id)}" data-lesson-id="${esc(lesson.id)}"
                  data-duration="${lesson.durationSeconds}" data-state="${lesson.state}"${lesson.state === "current" ? ' aria-current="true"' : ""}>
                  <span class="lesson__marker">${marker}</span>
                  <span class="lesson__title">${esc(lesson.title)}</span>
                  <span class="sr-only">${label}</span>
                  <span class="lesson__duration">${esc(lesson.duration)}</span>
                </a>`;
      })
      .join("\n                ");

    return `<div class="module" data-module="${esc(module.id)}">
              <button type="button" class="module__head" aria-expanded="${open}" aria-controls="${panelId}">
                ${icon("chevron-right", "module__chevron")}
                <span class="module__title">Módulo ${moduleIndex + 1} — ${esc(module.title)}</span>
                <span class="module__count">${module.lessonCount} aulas</span>
                <span class="module__bar">${progressBar(module.progress.percent, { attribute: "data-module-bar" })}</span>
                <span class="module__percent" data-module-percent data-complete="${module.progress.percent === 100}">${module.progress.percent}%</span>
              </button>
              <div class="module__panel" id="${panelId}"${open ? "" : " hidden"}>
                ${lessons}
              </div>
            </div>`;
  })
  .join("\n            ");

await render(
  "course.template.html",
  "course.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@COURSE@@ */", path: "src/features/course/course.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    // na página de curso a sidebar marca a seção (location), não a página (page):
    // dois aria-current="page" no mesmo documento são anunciados como dois "atual"
    "@@NAV@@": navMarkup
      .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
      .replace('href="/meus-cursos"', 'href="/meus-cursos" aria-current="location"'),
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@COURSE_TITLE@@": esc(featuredRow.course.title),
    "@@COURSE_ABOUT@@": esc(featuredRow.course.summary),
    "@@COURSE_DURATION@@": esc(outline.duration),
    "@@MODULE_COUNT@@": String(outline.modules.length),
    "@@HERO@@": heroBlock,
    "@@MODULES@@": modulesBlock,
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": await buildIconSprite(ICON_NAMES),
  },
);


/* ---------------------------------------------------------------- catálogo */

const catalogEntries = toCatalogEntries(courses, enrollments);
const counts = catalogCounts(catalogEntries);

const TABS = [
  { id: "all", label: "Todos", count: counts.all },
  { id: "in_progress", label: "Em andamento", count: counts.in_progress },
  { id: "completed", label: "Concluídos", count: counts.completed },
  { id: "saved", label: "Salvos", count: counts.saved },
];

/** Card com os atributos que o filtro do preview consulta. */
function catalogCard(entry) {
  const { course, summary, saved } = entry;
  const row = rows.find((item) => item.course.id === course.id);
  if (!row) throw new Error(`Curso do catálogo sem linha de progresso: ${course.id}`);
  const data = [
    `data-course-id="${esc(course.id)}"`,
    `data-status="${summary.status}"`,
    `data-saved="${saved}"`,
    `data-percent="${summary.percent}"`,
    `data-title="${esc(course.title)}"`,
    `data-search="${esc(normalizeForSearch(`${course.title} ${course.summary}`))}"`,
  ].join(" ");

  return courseCard(row, data, 2);
}

/**
 * "Meus cursos", "Concluídos" e "Favoritos" são a mesma tela com outro recorte:
 * uma função, três saídas. É assim no produto também (`CatalogView`).
 */
async function renderCatalog({ output, filter, navHref, title, subtitle, tabs, emptyTitle, emptyText }) {
  const visible = queryCatalog(catalogEntries, { filter, sort: "continue" });

  const tabsMarkup = tabs
    ? TABS.map(
        (tab, index) => `<button type="button" class="tabs__tab" role="tab" id="tab-${tab.id}"
            data-filter="${tab.id}" aria-controls="resultados"
            aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">
            ${esc(tab.label)}<span class="tabs__count">${tab.count}</span>
          </button>`,
      ).join("\n          ")
    : "";

  await render(
    "catalog.template.html",
    output,
    [
      { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
      { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
      { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
      { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
      { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
      { marker: "/* @@CATALOG@@ */", path: "src/features/catalog/catalog.css" },
    ],
    {
      "@@LOGO@@": wordmarkWhite,
      "@@LOGO_BRAND@@": wordmark,
      "@@MARK@@": markWhite,
      "@@NAV@@": navMarkup
        .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
        .replace(`href="${navHref}"`, `href="${navHref}" aria-current="page"`),
      "@@INITIALS@@": esc(initials),
      "@@FULLNAME@@": esc(student.fullName),
      "@@ROLE_LABEL@@": "Aluno",
      "@@TITLE@@": esc(title),
      "@@SUBTITLE@@": esc(subtitle),
      "@@TABS@@": tabsMarkup,
      "@@TABS_HIDDEN@@": tabs ? "" : " hidden",
      "@@FILTER@@": filter,
      "@@STATUS@@": `${visible.length} ${visible.length === 1 ? "curso encontrado" : "cursos encontrados"}`,
      "@@COURSES@@": visible.map(catalogCard).join("\n          "),
      "@@EMPTY@@": emptyState({ icon: "inbox", title: emptyTitle, text: emptyText, level: 2 }),
      "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": await buildIconSprite(ICON_NAMES),
    },
  );
}

await renderCatalog({
  output: "catalog.html",
  filter: "all",
  navHref: "/meus-cursos",
  tabs: true,
  title: "Meus cursos",
  subtitle: "Continue de onde parou ou explore novas trilhas da biblioteca.",
  emptyTitle: "Nenhum curso encontrado",
  emptyText: "Ajuste a busca ou volte para a aba Todos para ver a lista completa.",
});

await renderCatalog({
  output: "completed.html",
  filter: "completed",
  navHref: "/concluidos",
  tabs: false,
  title: "Concluídos",
  subtitle: "Os cursos que você terminou. O certificado fica disponível assim que a última aula é concluída.",
  emptyTitle: "Você ainda não concluiu nenhum curso",
  emptyText: "Assim que terminar a última aula de um curso, ele aparece aqui com o certificado.",
});

/* "Todos os cursos": catálogo completo, com o que já é do aluno e o que ele
   pode se inscrever. É a única tela onde os dois estados convivem. */
const libraryCards = [
  ...rows.map((row) => catalogCard(catalogEntries.find((entry) => entry.course.id === row.course.id))),
  ...catalogOnly.map((course) => {
    const total = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
    const duration = course.modules
      .flatMap((module) => module.lessons)
      .reduce((sum, lesson) => sum + lesson.durationSeconds, 0);
    const data = [
      `data-course-id="${esc(course.id)}"`,
      `data-status="available"`,
      `data-saved="false"`,
      `data-percent="0"`,
      `data-title="${esc(course.title)}"`,
      `data-search="${esc(normalizeForSearch(`${course.title} ${course.summary}`))}"`,
    ].join(" ");
    return courseCard(
      { course, summary: { total, completed: 0, percent: 0, status: "not_started" }, duration, available: true },
      data,
      2,
    );
  }),
].join("\n          ");

await render(
  "catalog.template.html",
  "library.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
    { marker: "/* @@CATALOG@@ */", path: "src/features/catalog/catalog.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": navMarkup
      .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
      .replace('href="/cursos"', 'href="/cursos" aria-current="page"'),
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@TITLE@@": "Todos os cursos",
    "@@SUBTITLE@@": "A biblioteca completa da Exemplo S.A.. Inscreva-se no que interessa à sua área.",
    "@@TABS@@": "",
    "@@TABS_HIDDEN@@": " hidden",
    "@@FILTER@@": "all",
    "@@STATUS@@": `${allCourses.length} cursos disponíveis`,
    "@@COURSES@@": libraryCards,
    "@@EMPTY@@": emptyState({
      icon: "inbox",
      title: "Nenhum curso encontrado",
      text: "Ajuste a busca para ver os demais cursos da biblioteca.",
      level: 2,
    }),
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": await buildIconSprite(ICON_NAMES),
  },
);

await renderCatalog({
  output: "favorites.html",
  filter: "saved",
  navHref: "/favoritos",
  tabs: false,
  title: "Favoritos",
  subtitle: "Os cursos que você salvou para assistir depois.",
  emptyTitle: "Nenhum curso salvo ainda",
  emptyText: "Use o marcador na página do curso para guardar o que quiser ver mais tarde.",
});

/* ------------------------------------------------- tela de acesso inicial */

const pointsMarkup = LANDING_POINTS.map(
  (point) => `<article class="landing__point">
        <span class="landing__point-icon">${icon(point.icon)}</span>
        <h3 class="landing__point-title">${esc(point.title)}</h3>
        <p class="landing__point-text">${esc(point.text)}</p>
      </article>`,
).join("\n      ");

/* O protótipo é estático e não fala com o banco: usa a contagem do próprio
   mock, que é a mesma que o seed carrega. Assim a apresentação mostra os
   números que a instalação de homologação realmente tem. */
const PREVIEW_NUMBERS = {
  learners: allUsers.filter((user) => user.role === "learner").length,
  courses: allCourses.length,
  lessons: allCourses.reduce(
    (total, course) =>
      total + course.modules.reduce((sum, module) => sum + module.lessons.length, 0),
    0,
  ),
  completedLessons: 0,
};

const statsMarkup = landingStats(PREVIEW_NUMBERS).map(
  (stat) => `<div class="landing__stat">
          <dt class="landing__stat-label">${esc(stat.label)}</dt>
          <dd class="landing__stat-value">${esc(stat.value)}</dd>
        </div>`,
).join("\n        ");

await render(
  "landing.template.html",
  "landing.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@LANDING@@ */", path: "src/features/landing/landing.css" },
  ],
  {
    "@@LOGO_BRAND@@": wordmark,
    /* A variante BRANCA também: no tema escuro o logotipo azul-marinho fica
       sobre fundo azul-marinho e some. O CSS escolhe qual das duas aparece. */
    "@@LOGO@@": wordmarkWhite,
    "@@BLOB@@": mosaico("layered", "", "silhueta"),
    "@@TILE@@": "",
    "@@STATS@@": statsMarkup,
    "@@POINTS@@": pointsMarkup,
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": await buildIconSprite(ICON_NAMES),
  },
);


/* ------------------------------------------------------------ página de aula */

const lessonTarget = featuredRow.resume?.lesson.id ?? outline.modules[0]?.lessons[0]?.id;
if (!lessonTarget) throw new Error("Seed sem aula para a página de aula.");

const view = lessonView(featuredRow.course, featuredRow.enrollment, lessonTarget);
if (!view) throw new Error(`Aula não encontrada no curso: ${lessonTarget}`);

const playerBlock = `<div class="player" id="player" data-playing="false" data-resume="${view.resumeAtSeconds}" tabindex="-1">
            <video class="player__video" id="video" preload="metadata" playsinline
                   src="@@MEDIA@@" aria-label="${esc(view.lesson.title)}"></video>
            <div class="player__scrim"></div>

            <button type="button" class="player__big-play" data-play aria-label="Reproduzir">
              ${icon("play")}
            </button>

            <div class="player__controls">
              <span class="player__label">Aula ${view.index} — ${esc(view.lesson.title)}</span>

              <label class="sr-only" for="seek">Posição do vídeo</label>
              <input class="player__seek" id="seek" type="range" min="0" max="${view.durationSeconds}"
                     step="1" value="${view.resumeAtSeconds}" />

              <div class="player__row">
                <button type="button" class="player__button" data-play aria-label="Reproduzir">${icon("play")}</button>
                <button type="button" class="player__button" id="mute" aria-pressed="false" aria-label="Silenciar">${icon("volume-2")}</button>
                <label class="sr-only" for="volume">Volume</label>
                <input class="player__volume" id="volume" type="range" min="0" max="1" step="0.05" value="1" />
                <span class="player__time" id="time">${formatClock(view.resumeAtSeconds)} / ${formatClock(view.durationSeconds)}</span>
                <span class="player__spacer"></span>
                <button type="button" class="player__button player__button--wide" id="rate" aria-label="Velocidade: 1 vez">1×</button>
                <button type="button" class="player__button" id="captions" aria-pressed="false" aria-label="Legendas">${icon("captions")}</button>
                <button type="button" class="player__button" id="fullscreen" aria-label="Tela cheia">${icon("maximize")}</button>
              </div>
            </div>
          </div>`;

const railBlock = view.outline.modules
  .map((module, moduleIndex) => {
    const lessons = module.lessons
      .map((lesson) => {
        const marker =
          lesson.state === "done" ? icon("check") : lesson.state === "current" ? icon("play") : String(lesson.index);
        const label =
          lesson.state === "done" ? "Aula concluída" : lesson.state === "current" ? "Aula atual" : "Aula não iniciada";
        return `<a class="lesson" href="/aulas/${esc(lesson.id)}" data-lesson-id="${esc(lesson.id)}"
                  data-duration="${lesson.durationSeconds}" data-state="${lesson.state}"${lesson.state === "current" ? ' aria-current="true"' : ""}>
                  <span class="lesson__marker">${marker}</span>
                  <span class="lesson__title">${esc(lesson.title)}</span>
                  <span class="sr-only">${label}</span>
                  <span class="lesson__duration">${esc(lesson.duration)}</span>
                </a>`;
      })
      .join("\n                ");

    return `<div class="rail__module" data-module="${esc(module.id)}">
              <div class="rail__module-head">
                <span class="rail__module-title">Módulo ${moduleIndex + 1} — ${esc(module.title)}</span>
                <span class="rail__module-percent" data-module-percent data-complete="${module.progress.percent === 100}">${module.progress.percent}%</span>
              </div>
              ${lessons}
            </div>`;
  })
  .join("\n            ");

function pagerButton(neighbour, direction) {
  if (!neighbour) return "<span></span>";
  const isNext = direction === "next";
  return `<a class="btn ${isNext ? "btn--primary" : "btn--secondary"}" href="/aulas/${esc(neighbour.id)}">
              ${isNext ? "" : icon("arrow-left")}
              <span class="lesson-pager__stack${isNext ? " lesson-pager__next" : ""}">
                <span class="lesson-pager__eyebrow">${isNext ? "Próxima aula" : "Aula anterior"}</span>
                <span class="lesson-pager__title">${esc(neighbour.title)}</span>
              </span>
              ${isNext ? icon("arrow-right") : ""}
            </a>`;
}

const lessonMaterials = materials[view.lesson.id] ?? [];

const materialsBlock = lessonMaterials.length
  ? lessonMaterials
      .map(
        (item) => `<button type="button" class="material" data-material>
                <span class="material__icon">${icon("file-text")}</span>
                <span class="material__name">${esc(item.name)}</span>
                <span class="material__meta">${esc(item.sizeLabel)}</span>
                <span class="material__download">${icon("arrow-right")}</span>
              </button>`,
      )
      .join("\n              ")
  : emptyState({
      icon: "file-text",
      title: "Nenhum material nesta aula",
      text: "Quando o instrutor anexar PDFs ou planilhas, eles aparecem aqui para download.",
    });

function initialsOf(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/** "há 2 dias", "ontem" — data absoluta não ajuda numa discussão de aula. */
function relativeTime(iso, now) {
  const diff = (now - new Date(iso).getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return format.format(-Math.round(diff / seconds), unit);
  }
  return "agora";
}

// Data fixa para o preview ser determinístico entre builds.
const PREVIEW_NOW = new Date("2026-08-06T10:00:00-03:00").getTime();

const lessonComments = comments.filter((item) => item.lessonId === view.lesson.id);
const destaques = new Set(relevantIds(lessonComments));
const roots = sortByRelevance(lessonComments.filter((item) => !item.parentId));

function commentMarkup(comment) {
  const replies = lessonComments.filter((item) => item.parentId === comment.id);
  const repliesMarkup = replies.length
    ? `<div class="comment__replies">${replies.map((reply) => commentMarkup(reply)).join("")}</div>`
    : "";

  const relevante = destaques.has(comment.id);

  return `<article class="comment${comment.highlighted ? " comment--highlighted" : ""}${relevante ? " comment--relevant" : ""}" data-comment-id="${esc(comment.id)}">
                <span class="avatar avatar--sm" aria-hidden="true">${esc(initialsOf(comment.authorName))}</span>
                <div class="comment__body">
                  <div class="comment__head">
                    <span class="comment__author">${esc(comment.authorName)}</span>
                    ${comment.highlighted ? `<span class="badge">${icon("graduation-cap")} Professor</span>` : ""}
                    ${relevante ? `<span class="comment__relevance">${icon("star")} Relevante</span>` : ""}
                    <span class="comment__time">${esc(relativeTime(comment.createdAt, PREVIEW_NOW))}</span>
                  </div>
                  <p class="comment__text">${esc(comment.body)}</p>
                  <div class="comment__actions">
                    <button type="button" class="upvote" data-upvote="${esc(comment.id)}"
                            data-author="${esc(comment.authorId)}" aria-pressed="false"
                            aria-label="Votar neste comentário">
                      ${icon("thumbs-up")}<span data-upvote-count>${comment.upvotes}</span>
                    </button>
                    <button type="button" class="comment__action" data-reply>Responder</button>
                  </div>
                  ${repliesMarkup}
                </div>
              </article>`;
}

const commentsBlock = `<section class="comments" aria-labelledby="comentarios">
            <div class="comments__head">
              <h2 class="course-section__title" id="comentarios">Comentários</h2>
              <span class="comments__count">${lessonComments.length}</span>
              <span class="lesson-topline__spacer"></span>
              <span class="vote-budget">
                ${icon("thumbs-up")} <strong data-votes-left>${WEEKLY_VOTE_BUDGET}</strong> votos nesta semana
              </span>
            </div>

            <form class="composer" id="composer">
              <span class="avatar avatar--sm" aria-hidden="true">${esc(initials)}</span>
              <div class="composer__body">
                <label class="sr-only" for="novo-comentario">Novo comentário</label>
                <textarea class="textarea" id="novo-comentario" rows="2"
                          placeholder="Escreva um comentário sobre esta aula…"></textarea>
                <div class="composer__actions">
                  <button type="submit" class="btn btn--primary" id="publicar" disabled>
                    Publicar ${icon("send")}
                  </button>
                </div>
              </div>
            </form>

            <p class="status-text" id="comentario-status" role="status"></p>

            <div class="comment-list">
              ${roots.map((comment) => commentMarkup(comment)).join("\n              ")}
            </div>
          </section>`;

await render(
  "lesson.template.html",
  "lesson.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@COURSE@@ */", path: "src/features/course/course.css" },
    { marker: "/* @@LESSON@@ */", path: "src/features/lesson/lesson.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": navMarkup
      .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
      .replace('href="/meus-cursos"', 'href="/meus-cursos" aria-current="location"'),
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@COURSE_SLUG@@": esc(featuredRow.course.slug),
    "@@COURSE_TITLE@@": esc(featuredRow.course.title),
    "@@COURSE_PERCENT@@": String(view.outline.progress.percent),
    "@@COURSE_PROGRESS@@": progressBar(view.outline.progress.percent, { attribute: "data-course-bar" }),
    "@@MODULE_TITLE@@": esc(view.module.title),
    "@@LESSON_TITLE@@": esc(view.lesson.title),
    "@@LESSON_INDEX@@": String(view.index),
    "@@LESSON_COUNT@@": String(view.outline.lessonCount),
    "@@LESSON_DURATION@@": esc(view.duration),
    "@@LESSON_ID@@": esc(view.lesson.id),
    "@@LESSON_SECONDS@@": String(view.durationSeconds),
    "@@PLAYER@@": playerBlock,
    "@@RAIL@@": railBlock,
    "@@PAGER@@": `${pagerButton(view.previous, "previous")}\n            ${pagerButton(view.next, "next")}`,
    "@@MATERIALS@@": materialsBlock,
    "@@COMMENTS@@": commentsBlock,
    "@@MEDIA@@": `data:video/mp4;base64,${await readBase64("public/media/aula-demo.mp4")}`,
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": await buildIconSprite(ICON_NAMES),
  },
);


/* --------------------------------------------------------------- perfil */

const concluidos = rows.filter((row) => row.summary.status === "completed");

/* `agg` liga o cartão ao recálculo do navegador: número e rótulo mudam quando
   o aluno conclui uma aula, como mudam no produto. Ver `refreshAggregates` em
   `preview/prototype.js`. "Tempo assistido" fica de fora — depende dos
   segundos vistos, e o protótipo não cronometra reprodução. */
const profileStats = [
  { icon: "circle-check", value: `${totals.completed}`, label: `de ${totals.lessons} aulas concluídas`, agg: "lessons" },
  { icon: "award", value: `${totals.finished}`, label: `de ${rows.length} cursos concluídos`, agg: "courses" },
  { icon: "clock", value: formatDuration(totals.watchedSeconds), label: "de conteúdo assistido" },
  { icon: "trending-up", value: `${overallPercent}%`, label: "do seu plano concluído", agg: "percent" },
]
  .map(
    (stat) => `<article class="stat-card"${stat.agg ? ` data-card-agg="${stat.agg}"` : ""}>
              <span class="stat-card__icon">${icon(stat.icon)}</span>
              <span class="stat-card__value">${esc(stat.value)}</span>
              <span class="stat-card__label">${esc(stat.label)}</span>
            </article>`,
  )
  .join("\n            ");

/* O PDF é gerado DE VERDADE, um arquivo por curso concluído, ao lado das
   páginas — e não embutido em base64 no HTML.

   Era um `<button>` sem handler nenhum: clicar não fazia nada, e o protótipo
   prometia um download que não existia. No produto isso é um link para
   `/api/certificado`, então a versão honesta aqui também é um LINK.

   Arquivo à parte, e não data URI, porque o certificado tem ~90 kB: embutido,
   entraria no peso da página do perfil mesmo para quem nunca clica. Assim só
   viaja quando alguém pede. */
const certificados = await Promise.all(
  concluidos.map(async (row) => {
    const arquivo = `certificado-${row.course.slug}.pdf`;
    await writeFile(
      join(root, `preview/${arquivo}`),
      buildCertificate({
        learnerName: student.fullName,
        courseTitle: row.course.title,
        lessons: row.summary.total,
        durationSeconds: row.duration,
        /* Data fixa: o protótipo é conferido por captura, e um certificado
           que muda de data a cada build vira diferença de imagem toda vez. */
        completedAt: "2026-08-12T12:00:00-03:00",
        code: certificateCode(row.course.id),
      }),
    );
    console.log(`preview/${arquivo}`);
    return { row, arquivo };
  }),
);

const certificatesBlock = concluidos.length
  ? `<div class="certificates">
            ${certificados
              .map(
                ({ row, arquivo }) => `<article class="certificate">
              <span class="certificate__seal">${icon("award")}</span>
              <span class="certificate__body">
                <h3 class="certificate__title">${esc(row.course.title)}</h3>
                <span class="certificate__meta">${row.summary.total} aulas · ${esc(formatDuration(row.duration))}</span>
              </span>
              <a class="btn btn--secondary" href="${arquivo}" download>
                ${icon("file-text")} Baixar PDF
              </a>
            </article>`,
              )
              .join("\n            ")}
          </div>`
  : emptyState({
      icon: "award",
      title: "Nenhum certificado ainda",
      text: "Conclua a última aula de um curso e o certificado aparece aqui para download.",
    });

await render(
  "profile.template.html",
  "profile.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
    { marker: "/* @@PROFILE@@ */", path: "src/features/profile/profile.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": navMarkup
      .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
      .replace('href="/perfil"', 'href="/perfil" aria-current="page"'),
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@HERO_WAVE@@": mosaico("blob", "profile-hero__wave", "silhueta"),
    "@@PROFILE_BADGES@@": [
      `<span class="badge badge--on-brand">${icon("graduation-cap")} Aluno</span>`,
      `<span class="badge badge--on-brand">${icon("users")} Aguilhada</span>`,
      `<span class="badge badge--on-brand">${icon("calendar")} Desde março de 2026</span>`,
    ].join("\n              "),
    "@@PROFILE_STATS@@": profileStats,
    "@@CERTIFICATES@@": certificatesBlock,
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": await buildIconSprite(ICON_NAMES),
  },
);


/* ------------------------------------------------ backoffice do instrutor */

/** Navegação do instrutor: outro conjunto de itens, o mesmo shell. */
const studioNav = [
  { section: null, items: [
    { label: "Meus cursos", icon: "graduation-cap", href: "/instrutor" },
    { label: "Engajamento", icon: "trending-up", href: "/instrutor/engajamento" },
  ] },
  { section: "Conta", items: [
    { label: "Ver como aluno", icon: "house", href: "/dashboard" },
    { label: "Perfil", icon: "user", href: "/perfil" },
    { label: "Sair", icon: "log-out", href: "/sair" },
  ] },
]
  .map(({ section, items }) => {
    const heading = section ? `<p class="sidebar__section">${esc(section)}</p>` : "";
    const links = items
      .map(
        (item) => `<a class="nav-item" href="${item.href}">
          ${icon(item.icon)}
          <span class="nav-item__label">${esc(item.label)}</span>
        </a>`,
      )
      .join("\n        ");
    return `${heading}\n        ${links}`;
  })
  .join("\n        ");

const instructor = instructors[0];
const authored = allCourses.filter((course) => course.authorId === instructor.id);

const STUDIO_STYLES = [
  { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
  { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
  { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
  { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
  { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
  { marker: "/* @@STUDIO@@ */", path: "src/features/studio/studio.css" },
];

const studioInitials = instructor.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("");

const spriteHtml = await buildIconSprite(ICON_NAMES);

function studioCommon(currentHref) {
  return {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": studioNav.replace(`href="${currentHref}"`, `href="${currentHref}" aria-current="page"`),
    "@@INITIALS@@": esc(studioInitials),
    "@@FULLNAME@@": esc(instructor.fullName),
    "@@ROLE_LABEL@@": "Instrutor",
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": spriteHtml,
  };
}

/* ---- lista de cursos do instrutor ---- */

const studioList = authored
  .map((course) => {
    const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
    const publicado = course.status === "published";
    return `<article class="studio-course">
              <span class="studio-course__seal">${icon("graduation-cap")}</span>
              <span class="studio-course__body">
                <h2 class="studio-course__title">${esc(course.title)}</h2>
                <span class="studio-course__meta">${course.modules.length} módulos · ${lessons} aulas</span>
              </span>
              <span class="badge ${publicado ? "badge--success" : "badge--neutral"}">
                ${publicado ? "Publicado" : "Rascunho"}
              </span>
              <span class="studio-course__actions">
                <a class="btn btn--secondary" href="/instrutor/cursos/${esc(course.id)}">Editar</a>
              </span>
            </article>`;
  })
  .join("\n            ");

await render("studio.template.html", "studio.html", STUDIO_STYLES, {
  ...studioCommon("/instrutor"),
  "@@TITLE@@": "Meus cursos",
  "@@SUBTITLE@@": `Cursos de sua autoria. Você edita e publica os seus; os de outros instrutores não aparecem aqui.`,
  "@@HEAD_ACTION@@": `<a class="btn btn--primary" href="/instrutor/cursos/${esc(authored[0].id)}">${icon("plus")} Novo curso</a>`,
  "@@STUDIO_BODY@@": `<div class="studio-list">
            ${studioList}
          </div>`,
});

/* ---- editor de curso ---- */

const editing = authored.find((course) => course.status === "published") ?? authored[0];
const editingLessons = editing.modules.reduce((total, module) => total + module.lessons.length, 0);
const editingSeconds = editing.modules
  .flatMap((module) => module.lessons)
  .reduce((total, lesson) => total + lesson.durationSeconds, 0);

const editorBody = `<div class="editor" id="editor" data-course-id="${esc(editing.id)}">
            <div class="editor__main">

              <section class="editor__panel">
                <h2 class="editor__panel-title">Dados do curso</h2>

                <div class="field">
                  <label class="field__label" for="curso-titulo">Título</label>
                  <input class="input" id="curso-titulo" type="text" value="${esc(editing.title)}" />
                </div>

                <div class="field">
                  <label class="field__label" for="curso-resumo">Resumo</label>
                  <textarea class="textarea" id="curso-resumo" rows="2">${esc(editing.summary)}</textarea>
                </div>
              </section>

              <section class="editor__panel">
                <h2 class="editor__panel-title">Conteúdo</h2>
                <div class="editor-modules" id="modulos"></div>

                <form class="editor-add" id="novo-modulo">
                  <label class="sr-only" for="modulo-titulo">Título do módulo</label>
                  <input class="input" id="modulo-titulo" type="text" placeholder="Nome do novo módulo" />
                  <button type="submit" class="btn btn--secondary">${icon("plus")} Adicionar módulo</button>
                </form>
              </section>

              <section class="editor__panel">
                <h2 class="editor__panel-title">Materiais e vídeo</h2>
                <div class="dropzone" id="dropzone" role="button" tabindex="0"
                     aria-label="Enviar vídeo, PDF ou material">
                  <span class="dropzone__icon">${icon("file-text")}</span>
                  <span class="dropzone__title">Arraste um arquivo ou clique para selecionar</span>
                  <span class="dropzone__hint">Vídeo MP4, PDF, planilha ou slide. O envio real depende da TASK-046.</span>
                </div>
                <p class="status-text" id="upload-status" role="status"></p>
              </section>
            </div>

            <aside class="editor__panel editor__aside">
              <h2 class="editor__panel-title">Publicação</h2>

              <div class="editor__summary">
                <div class="editor__summary-row">
                  <span class="editor__summary-label">Situação</span>
                  <span class="badge ${editing.status === "published" ? "badge--success" : "badge--neutral"}" id="situacao">
                    ${editing.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                </div>
                <div class="editor__summary-row">
                  <span class="editor__summary-label">Módulos</span>
                  <span class="editor__summary-value" id="total-modulos">${editing.modules.length}</span>
                </div>
                <div class="editor__summary-row">
                  <span class="editor__summary-label">Aulas</span>
                  <span class="editor__summary-value" id="total-aulas">${editingLessons}</span>
                </div>
                <div class="editor__summary-row">
                  <span class="editor__summary-label">Duração</span>
                  <span class="editor__summary-value" id="total-duracao">${esc(formatDuration(editingSeconds))}</span>
                </div>
              </div>

              <div class="editor__publish">
                <button type="button" class="btn btn--primary btn--block" id="publicar-curso">Publicar curso</button>
                <p class="status-text" id="publicar-status" role="status"></p>
              </div>
            </aside>
          </div>`;

await render("studio.template.html", "editor.html", STUDIO_STYLES, {
  ...studioCommon("/instrutor"),
  "@@TITLE@@": "Editar curso",
  "@@SUBTITLE@@": "Cadastre módulos, aulas e materiais. Nada fica visível para o aluno até você publicar.",
  "@@HEAD_ACTION@@": `<a class="btn btn--secondary" href="/instrutor">Voltar</a>`,
  "@@STUDIO_BODY@@": editorBody,
  "@@COURSE_JSON@@": JSON.stringify(editing),
});

/* ---- engajamento do instrutor ---- */

const engagement = engagementSummary(authored, allEnrollments);
const nameById = new Map([student, ...learners].map((person) => [person.id, person.fullName]));
const courseNameById = new Map(authored.map((course) => [course.id, course.title]));

const engagementStats = [
  { icon: "users", value: String(engagement.learners), label: "alunos nos seus cursos" },
  { icon: "layers", value: String(engagement.enrollments), label: "matrículas ativas" },
  { icon: "trending-up", value: `${engagement.averagePercent}%`, label: "conclusão média" },
  { icon: "award", value: String(engagement.completions), label: "cursos concluídos" },
]
  .map(
    (stat) => `<article class="stat-card">
                <span class="stat-card__icon">${icon(stat.icon)}</span>
                <span class="stat-card__value">${esc(stat.value)}</span>
                <span class="stat-card__label">${esc(stat.label)}</span>
              </article>`,
  )
  .join("\n              ");

const byCourseRows = engagement.courses
  .map(
    (item) => `<tr>
                  <td data-label="Curso"><span class="table__name">${esc(item.course.title)}</span></td>
                  <td data-label="Alunos">${item.learners}</td>
                  <td data-label="Concluíram">${item.completed}</td>
                  <td data-label="Não iniciaram">${item.notStarted}</td>
                  <td data-label="Conclusão média">
                    <span class="table__bar">${progressBar(item.averagePercent)}</span>
                  </td>
                  <td data-label="" class="table__percent">${item.averagePercent}%</td>
                </tr>`,
  )
  .join("\n                ");

const SITUACAO = { completed: "Concluído", in_progress: "Em andamento", not_started: "Não iniciado" };

const peopleRows = learnerRows(authored, allEnrollments)
  .sort((a, b) => b.percent - a.percent)
  .slice(0, 12)
  .map(
    (row) => `<tr>
                  <td data-label="Aluno"><span class="table__name">${esc(nameById.get(row.learnerId) ?? row.learnerId)}</span></td>
                  <td data-label="Curso">${esc(courseNameById.get(row.courseId) ?? row.courseId)}</td>
                  <td data-label="Situação">
                    <span class="badge ${row.status === "completed" ? "badge--success" : "badge--neutral"}">${SITUACAO[row.status]}</span>
                  </td>
                  <td data-label="Progresso"><span class="table__bar">${progressBar(row.percent)}</span></td>
                  <td data-label="" class="table__percent">${row.percent}%</td>
                </tr>`,
  )
  .join("\n                ");

const engagementBody = `<div class="engagement">
            <div class="engagement__stats">
              ${engagementStats}
            </div>

            <section class="course-section">
              <h2 class="course-section__title">Por curso</h2>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col">Curso</th>
                      <th scope="col">Alunos</th>
                      <th scope="col">Concluíram</th>
                      <th scope="col">Não iniciaram</th>
                      <th scope="col">Conclusão média</th>
                      <th scope="col"><span class="sr-only">Percentual</span></th>
                    </tr>
                  </thead>
                  <tbody>
                ${byCourseRows}
                  </tbody>
                </table>
              </div>
            </section>

            <section class="course-section">
              <h2 class="course-section__title">Alunos</h2>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col">Aluno</th>
                      <th scope="col">Curso</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Progresso</th>
                      <th scope="col"><span class="sr-only">Percentual</span></th>
                    </tr>
                  </thead>
                  <tbody>
                ${peopleRows}
                  </tbody>
                </table>
              </div>
            </section>
          </div>`;

await render("studio.template.html", "engagement.html", STUDIO_STYLES, {
  ...studioCommon("/instrutor/engajamento"),
  "@@TITLE@@": "Engajamento",
  "@@SUBTITLE@@": "Alunos matriculados nos seus cursos. Turmas de outros instrutores não aparecem aqui.",
  "@@HEAD_ACTION@@": "",
  "@@STUDIO_BODY@@": engagementBody,
});

/* ------------------------------------------------------------------ admin */

const adminNav = [
  { section: null, items: [
    { label: "Painel", icon: "house", href: "/admin" },
    { label: "Usuários", icon: "users", href: "/admin/usuarios" },
    { label: "Cursos", icon: "graduation-cap", href: "/admin/cursos" },
    { label: "Auditoria", icon: "lock", href: "/admin/auditoria" },
  ] },
  { section: "Conta", items: [
    { label: "Perfil", icon: "user", href: "/perfil" },
    { label: "Sair", icon: "log-out", href: "/sair" },
  ] },
]
  .map(({ section, items }) => {
    const heading = section ? `<p class="sidebar__section">${esc(section)}</p>` : "";
    const links = items
      .map(
        (item) => `<a class="nav-item" href="${item.href}">
          ${icon(item.icon)}
          <span class="nav-item__label">${esc(item.label)}</span>
        </a>`,
      )
      .join("\n        ");
    return `${heading}\n        ${links}`;
  })
  .join("\n        ");

const adminInitials = admin.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("");

function adminCommon(currentHref) {
  return {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": adminNav.replace(`href="${currentHref}"`, `href="${currentHref}" aria-current="page"`),
    "@@INITIALS@@": esc(adminInitials),
    "@@FULLNAME@@": esc(admin.fullName),
    "@@ROLE_LABEL@@": "Administrador",
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": spriteHtml,
  };
}

/* ---- painel do admin: a mesma função do instrutor, sem o filtro de autoria - */

const platform = engagementSummary(allCourses, allEnrollments);
const pendentes = allUsers.filter((user) => user.status === "pending").length;

// Data fixa: o preview precisa ser igual entre execuções.
const REFERENCIA = new Date("2026-08-12T12:00:00-03:00");
const periodo = lastDays(30, REFERENCIA);
const ativos = activeUsers(allUsers, periodo);

const adminStats = [
  { icon: "users", value: `${ativos.active}`, label: "usuários ativos em 30 dias" },
  { icon: "graduation-cap", value: String(allUsers.length), label: "pessoas cadastradas" },
  { icon: "trending-up", value: `${platform.averagePercent}%`, label: "conclusão média" },
  { icon: "award", value: String(platform.completions), label: "cursos concluídos" },
]
  .map(
    (stat) => `<article class="stat-card">
                <span class="stat-card__icon">${icon(stat.icon)}</span>
                <span class="stat-card__value">${esc(stat.value)}</span>
                <span class="stat-card__label">${esc(stat.label)}</span>
              </article>`,
  )
  .join("\n              ");

/* Distribuição por campo — a dimensão que a plataforma atual não oferece
   ("gestão cega", na proposta). Depende de `project` no usuário: ISSUE-023. */
const porProjeto = [...new Set(allUsers.map((user) => user.project).filter(Boolean))]
  .map((projeto) => ({
    projeto,
    pessoas: allUsers.filter((user) => user.project === projeto).length,
  }))
  .sort((a, b) => b.pessoas - a.pessoas);

const breakdown = porProjeto
  .map(
    (item) => `<div class="breakdown__row">
                  <div class="breakdown__head">
                    <span class="breakdown__label">${esc(item.projeto)}</span>
                    <span class="breakdown__value">${item.pessoas} ${item.pessoas === 1 ? "pessoa" : "pessoas"}</span>
                  </div>
                  ${progressBar(Math.round((item.pessoas / allUsers.length) * 100))}
                </div>`,
  )
  .join("\n                ");

const adminCourseRows = platform.courses
  .map(
    (item) => `<tr>
                  <td data-label="Curso"><span class="table__name">${esc(item.course.title)}</span></td>
                  <td data-label="Alunos">${item.learners}</td>
                  <td data-label="Concluíram">${item.completed}</td>
                  <td data-label="Conclusão média"><span class="table__bar">${progressBar(item.averagePercent)}</span></td>
                  <td data-label="" class="table__percent">${item.averagePercent}%</td>
                </tr>`,
  )
  .join("\n                ");

const adminBody = `<div class="engagement">
            <div class="engagement__stats">
              ${adminStats}
            </div>

            <section class="course-section">
              <div class="section-head">
                <h2 class="course-section__title">Relatórios</h2>
              </div>
              <div class="admin-toolbar">
                <button type="button" class="btn btn--secondary" data-export="pdf">${icon("file-text")} Exportar PDF</button>
                <button type="button" class="btn btn--secondary" data-export="excel">${icon("file-text")} Exportar Excel</button>
                <span class="admin-toolbar__spacer"></span>
                <span class="badge badge--pending">${pendentes} convites nunca acessados</span>
              </div>
              <p class="status-text" id="export-status" role="status"></p>
            </section>

            <section class="course-section">
              <h2 class="course-section__title">Usuários ativos por campo</h2>
              <p class="status-text">
                Ativo é quem acessou a plataforma nos últimos 30 dias. É a métrica que a
                licença atual limita a 500 para todos os campos somados.
              </p>
              <div class="breakdown">
                ${activeByProject(allUsers, periodo)
                  .map(
                    (item) => `<div class="breakdown__row">
                  <div class="breakdown__head">
                    <span class="breakdown__label">${esc(item.project)}</span>
                    <span class="breakdown__value">${item.active} de ${item.total} ativos</span>
                  </div>
                  ${progressBar(item.total === 0 ? 0 : Math.round((item.active / item.total) * 100))}
                </div>`,
                  )
                  .join("\n                ")}
              </div>
            </section>

            <section class="course-section">
              <h2 class="course-section__title">Pessoas por campo</h2>
              <div class="breakdown">
                ${breakdown}
              </div>
            </section>

            <section class="course-section">
              <h2 class="course-section__title">Desempenho por curso</h2>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col">Curso</th>
                      <th scope="col">Alunos</th>
                      <th scope="col">Concluíram</th>
                      <th scope="col">Conclusão média</th>
                      <th scope="col"><span class="sr-only">Percentual</span></th>
                    </tr>
                  </thead>
                  <tbody>
                ${adminCourseRows}
                  </tbody>
                </table>
              </div>
            </section>
          </div>`;

await render("studio.template.html", "admin.html", STUDIO_STYLES, {
  ...adminCommon("/admin"),
  "@@TITLE@@": "Painel",
  "@@SUBTITLE@@": "Engajamento de toda a plataforma, com recorte por campo.",
  "@@HEAD_ACTION@@": "",
  "@@STUDIO_BODY@@": adminBody,
});

/* ---- gestão de usuários ---- */

const PAPEL = { admin: "Administrador", manager: "Gestor", instructor: "Instrutor", learner: "Aluno" };
const SITUACAO_USUARIO = {
  active: { label: "Ativo", cls: "badge--success" },
  pending: { label: "Pendente", cls: "badge--pending" },
  inactive: { label: "Inativo", cls: "badge--inactive" },
};

const userRows = allUsers
  .map((user) => {
    const situacao = SITUACAO_USUARIO[user.status ?? "active"];
    return `<tr>
                  <td data-label="Nome">
                    <span class="table__name">${esc(user.fullName)}</span><br />
                    <span class="user-email">${esc(user.email ?? "—")}</span>
                  </td>
                  <td data-label="Perfil">${esc(PAPEL[user.role])}</td>
                  <td data-label="Campo">${esc(user.project ?? "—")}</td>
                  <td data-label="Região">${esc(user.region ?? "—")}</td>
                  <td data-label="Situação"><span class="badge ${situacao.cls}">${situacao.label}</span></td>
                  <td data-label="">
                    <span class="table__actions">
                      <button type="button" class="comment__action" data-user-action="editar">Editar</button>
                      <button type="button" class="comment__action" data-user-action="desativar">Desativar</button>
                    </span>
                  </td>
                </tr>`;
  })
  .join("\n                ");

const usersBody = `<div class="engagement">
            <div class="admin-toolbar">
              <div class="search">
                ${icon("search")}
                <label class="sr-only" for="busca-usuario">Buscar usuário</label>
                <input class="input" id="busca-usuario" type="search" placeholder="Buscar por nome ou email" autocomplete="off" />
              </div>
              <span class="admin-toolbar__spacer"></span>
              <button type="button" class="btn btn--primary" id="novo-usuario">${icon("plus")} Convidar usuário</button>
            </div>
            <p class="status-text" id="usuario-status" role="status"></p>

            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Perfil</th>
                    <th scope="col">Campo</th>
                    <th scope="col">Região</th>
                    <th scope="col">Situação</th>
                    <th scope="col"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody id="usuarios">
                ${userRows}
                </tbody>
              </table>
            </div>
          </div>`;

await render("studio.template.html", "users.html", STUDIO_STYLES, {
  ...adminCommon("/admin/usuarios"),
  "@@TITLE@@": "Usuários",
  "@@SUBTITLE@@": `${allUsers.length} pessoas cadastradas. Convite, edição e desativação em poucos cliques.`,
  "@@HEAD_ACTION@@": "",
  "@@STUDIO_BODY@@": usersBody,
});

/* ------------------------------------------------------------ gestor ---- */

/**
 * O Gestor enxerga apenas o próprio campo. O recorte é aplicado aqui, na
 * origem dos dados — não escondendo linhas na tela. Esconder na interface
 * deixaria os números do agregado errados e a API aberta.
 */
const projetoDoGestor = manager.project;
const equipe = allUsers.filter(
  (user) => user.project === projetoDoGestor && user.role === "learner",
);
const idsDaEquipe = new Set(equipe.map((user) => user.id));
const matriculasDaEquipe = allEnrollments.filter((item) => idsDaEquipe.has(item.learnerId));
const engajamentoDoProjeto = engagementSummary(allCourses, matriculasDaEquipe);
const ativosDoProjeto = activeUsers(equipe, periodo);

const managerNav = [
  { section: null, items: [
    { label: "Painel do campo", icon: "house", href: "/gestor" },
    { label: "Minha equipe", icon: "users", href: "/gestor/equipe" },
  ] },
  { section: "Conta", items: [
    { label: "Perfil", icon: "user", href: "/perfil" },
    { label: "Sair", icon: "log-out", href: "/sair" },
  ] },
]
  .map(({ section, items }) => {
    const heading = section ? `<p class="sidebar__section">${esc(section)}</p>` : "";
    const links = items
      .map(
        (item) => `<a class="nav-item" href="${item.href}">
          ${icon(item.icon)}
          <span class="nav-item__label">${esc(item.label)}</span>
        </a>`,
      )
      .join("\n        ");
    return `${heading}\n        ${links}`;
  })
  .join("\n        ");

const managerInitials = manager.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("");

function managerCommon(currentHref) {
  return {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": managerNav.replace(`href="${currentHref}"`, `href="${currentHref}" aria-current="page"`),
    "@@INITIALS@@": esc(managerInitials),
    "@@FULLNAME@@": esc(manager.fullName),
    "@@ROLE_LABEL@@": "Gestor",
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": spriteHtml,
  };
}

const managerStats = [
  { icon: "users", value: String(equipe.length), label: `pessoas em ${projetoDoGestor}` },
  { icon: "trending-up", value: `${ativosDoProjeto.active}`, label: "ativos em 30 dias" },
  { icon: "layers", value: String(matriculasDaEquipe.length), label: "matrículas da equipe" },
  { icon: "award", value: String(engajamentoDoProjeto.completions), label: "cursos concluídos" },
]
  .map(
    (stat) => `<article class="stat-card">
                <span class="stat-card__icon">${icon(stat.icon)}</span>
                <span class="stat-card__value">${esc(stat.value)}</span>
                <span class="stat-card__label">${esc(stat.label)}</span>
              </article>`,
  )
  .join("\n              ");

const managerCourseRows = engajamentoDoProjeto.courses
  .filter((item) => item.learners > 0)
  .map(
    (item) => `<tr>
                  <td data-label="Curso"><span class="table__name">${esc(item.course.title)}</span></td>
                  <td data-label="Da equipe">${item.learners}</td>
                  <td data-label="Concluíram">${item.completed}</td>
                  <td data-label="Conclusão média"><span class="table__bar">${progressBar(item.averagePercent)}</span></td>
                  <td data-label="" class="table__percent">${item.averagePercent}%</td>
                </tr>`,
  )
  .join("\n                ");

const managerBody = `<div class="engagement">
            <div class="engagement__stats">
              ${managerStats}
            </div>

            <section class="course-section">
              <h2 class="course-section__title">Desempenho da equipe por curso</h2>
              <p class="status-text">
                Somente cursos em que alguém de ${esc(projetoDoGestor)} está matriculado.
              </p>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col">Curso</th>
                      <th scope="col">Da equipe</th>
                      <th scope="col">Concluíram</th>
                      <th scope="col">Conclusão média</th>
                      <th scope="col"><span class="sr-only">Percentual</span></th>
                    </tr>
                  </thead>
                  <tbody>
                ${managerCourseRows}
                  </tbody>
                </table>
              </div>
            </section>
          </div>`;

await render("studio.template.html", "manager.html", STUDIO_STYLES, {
  ...managerCommon("/gestor"),
  "@@TITLE@@": `Painel · ${projetoDoGestor}`,
  "@@SUBTITLE@@": "Engajamento da sua equipe. Outros campos não aparecem aqui.",
  "@@HEAD_ACTION@@": "",
  "@@STUDIO_BODY@@": managerBody,
});

/* ---- equipe do gestor, com matrícula em treinamento obrigatório ---- */

const obrigatorios = allCourses.filter((course) => course.enrollmentMode === "assigned");

const teamRows = equipe
  .map((person) => {
    const doAluno = matriculasDaEquipe.filter((item) => item.learnerId === person.id);
    const concluidos = learnerRows(allCourses, doAluno).filter((row) => row.status === "completed").length;
    const situacao = person.status === "pending" ? SITUACAO_USUARIO.pending : SITUACAO_USUARIO.active;

    return `<tr>
                  <td data-label="Pessoa">
                    <span class="table__name">${esc(person.fullName)}</span><br />
                    <span class="user-email">${esc(person.email ?? "—")}</span>
                  </td>
                  <td data-label="Região">${esc(person.region ?? "—")}</td>
                  <td data-label="Matrículas">${doAluno.length}</td>
                  <td data-label="Concluídos">${concluidos}</td>
                  <td data-label="Situação"><span class="badge ${situacao.cls}">${situacao.label}</span></td>
                  <td data-label="">
                    <span class="table__actions">
                      <button type="button" class="comment__action" data-assign="${esc(person.id)}">Matricular</button>
                    </span>
                  </td>
                </tr>`;
  })
  .join("\n                ");

const teamBody = `<div class="engagement">
            <div class="admin-toolbar">
              <div class="search">
                ${icon("search")}
                <label class="sr-only" for="busca-equipe">Buscar pessoa</label>
                <input class="input" id="busca-equipe" type="search" placeholder="Buscar por nome ou email" autocomplete="off" />
              </div>
              <span class="admin-toolbar__spacer"></span>
              <span class="badge badge--neutral">${obrigatorios.length} treinamentos obrigatórios</span>
            </div>
            <p class="status-text" id="equipe-status" role="status"></p>

            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Região</th>
                    <th scope="col">Matrículas</th>
                    <th scope="col">Concluídos</th>
                    <th scope="col">Situação</th>
                    <th scope="col"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody id="equipe">
                ${teamRows}
                </tbody>
              </table>
            </div>
          </div>`;

await render("studio.template.html", "team.html", STUDIO_STYLES, {
  ...managerCommon("/gestor/equipe"),
  "@@TITLE@@": "Minha equipe",
  "@@SUBTITLE@@": `${equipe.length} pessoas em ${projetoDoGestor}. Matricule a equipe nos treinamentos obrigatórios.`,
  "@@HEAD_ACTION@@": "",
  "@@STUDIO_BODY@@": teamBody,
});

/* ------------------------------------------------------------- trilhas --- */

const ESTADO_ETAPA = {
  completed: "Concluído",
  current: "Continue aqui",
  available: "Disponível",
  locked: "Conclua o curso anterior",
};

const tracksBody = tracks
  .map((track) => {
    const view = trackView(track, allCourses, enrollments);

    const steps = view.steps
      .map((step) => {
        const marker =
          step.state === "completed"
            ? icon("check")
            : step.state === "locked"
              ? icon("lock")
              : String(step.position);

        const titulo =
          step.state === "locked"
            ? `<span class="step__title">${esc(step.course.title)}</span>`
            : `<a class="step__title link" href="/cursos/${esc(step.course.slug)}">${esc(step.course.title)}</a>`;

        return `<li class="step" data-state="${step.state}">
                  <span class="step__marker">${marker}</span>
                  <span class="step__body">
                    ${titulo}
                    <span class="step__hint">Etapa ${step.position} · ${ESTADO_ETAPA[step.state]}</span>
                    ${step.state === "locked" ? "" : `<span class="step__bar">${progressBar(step.percent)}</span>`}
                  </span>
                </li>`;
      })
      .join("\n                ");

    return `<section class="track" aria-labelledby="trilha-${esc(track.id)}">
            <div class="track__head">
              <div class="track__text">
                <h2 class="track__title" id="trilha-${esc(track.id)}">${esc(track.title)}</h2>
                <p class="track__summary">${esc(track.summary)}</p>
              </div>
              <span class="badge ${track.mode === "sequential" ? "badge--neutral" : ""}">
                ${track.mode === "sequential" ? "Sequencial" : "Ordem livre"}
              </span>
            </div>

            <div class="track__meta">
              <span class="track__progress">
                <span class="progress-legend">
                  <span>${view.completedCourses} de ${view.totalCourses} cursos concluídos</span>
                  <span class="progress-legend__value">${view.percent}%</span>
                </span>
                ${progressBar(view.percent)}
              </span>
            </div>

            <ol class="journey">
                ${steps}
            </ol>
          </section>`;
  })
  .join("\n          ");

/* Recomendados: entram na mesma tela das trilhas, como na proposta
   ("Jornada / Mapa de Metrô" + "Recomendado para o seu perfil"). */
const recomendados = recommend({
  user: student,
  courses: allCourses,
  enrollments,
  allEnrollments,
  tracks,
});

const ICONE_MOTIVO = (reason) =>
  reason.startsWith("Treinamento obrigatório")
    ? "lock"
    : reason.includes("trilha")
      ? "layers"
      : reason.startsWith("Popular")
        ? "users"
        : "star";

const recomendadosBody = `<section class="course-section" aria-labelledby="recomendados">
            <h2 class="course-section__title" id="recomendados">Recomendado para você</h2>
            <div class="recommendations">
              ${recomendados
                .map((item) => {
                  const aulas = item.course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
                  const segundos = item.course.modules
                    .flatMap((module) => module.lessons)
                    .reduce((sum, lesson) => sum + lesson.durationSeconds, 0);
                  return `<article class="recommendation">
                <span class="recommendation__reason">${icon(ICONE_MOTIVO(item.reason))} ${esc(item.reason)}</span>
                <h3 class="recommendation__title">${esc(item.course.title)}</h3>
                <p class="recommendation__summary">${esc(item.course.summary)}</p>
                <span class="recommendation__foot">
                  <span class="recommendation__meta">${aulas} aulas · ${esc(formatDuration(segundos))}</span>
                  <a class="btn btn--secondary" href="/cursos/${esc(item.course.slug)}">Ver curso</a>
                </span>
              </article>`;
                })
                .join("\n              ")}
            </div>
          </section>`;

await render(
  "tracks.template.html",
  "tracks.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
    { marker: "/* @@TRACKS@@ */", path: "src/features/tracks/tracks.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": navMarkup
      .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
      .replace('href="/trilhas"', 'href="/trilhas" aria-current="page"'),
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@TRACKS@@": `${tracksBody}\n\n          ${recomendadosBody}`,
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": spriteHtml,
  },
);

/* ---------------------------------------------------------- conquistas --- */

const ganho = earningsOf(allCourses, enrollments);
// Gasto é evento e viria do servidor. Fixo em 100 no protótipo para que
// "disponíveis" e "acumuladas" apareçam diferentes — é a distinção que faz o
// nível não cair quando alguém resgata algo.
const GASTO = 100;
const saldo = balanceOf(ganho.coins, GASTO);
const nivel = levelOf(ganho.coins);

const badgesMarkup = badgesFor(ganho)
  .map(
    (badge) => `<article class="badge-card" data-earned="${badge.earned}">
                <span class="badge-card__icon">${icon(badge.icon)}</span>
                <h3 class="badge-card__title">${esc(badge.title)}</h3>
                <p class="badge-card__text">${esc(badge.description)}</p>
                <span class="badge-card__state">${badge.earned ? "Conquistado" : "Ainda não"}</span>
              </article>`,
  )
  .join("\n              ");

const rewardsMarkup = REWARDS.map((reward) => {
  const alcanca = reward.cost <= saldo;
  return `<article class="reward">
                <span class="reward__body">
                  <h3 class="reward__title">${esc(reward.title)}</h3>
                  <p class="reward__text">${esc(reward.description)}</p>
                </span>
                <span class="reward__cost">${icon("star")} ${reward.cost.toLocaleString("pt-BR")}</span>
                <button type="button" class="btn ${alcanca ? "btn--primary" : "btn--secondary"}"
                        data-reward="${esc(reward.id)}"${alcanca ? "" : " disabled"}>
                  ${alcanca ? "Resgatar" : `Faltam ${(reward.cost - saldo).toLocaleString("pt-BR")}`}
                </button>
              </article>`;
}).join("\n              ");

const rewardsBody = `<section class="level-card">
            <div class="level-card__body">
              <h2 class="level-card__title">Nível ${nivel.level}</h2>
              <span class="level-card__hint">
                ${
                  nivel.next === null
                    ? "Você chegou ao último nível."
                    : `Faltam ${(nivel.next - ganho.coins).toLocaleString("pt-BR")} moedas para o nível ${nivel.level + 1}.`
                }
              </span>
              <span class="level-card__bar">${progressBar(nivel.percent, { onBrand: true })}</span>
            </div>

            <div class="coins">
              <span class="coins__icon">${icon("star")}</span>
              <span>
                <span class="coins__value">${saldo.toLocaleString("pt-BR")}</span>
                <span class="coins__label">moedas disponíveis · ${ganho.coins.toLocaleString("pt-BR")} acumuladas</span>
              </span>
            </div>
          </section>

          <section class="course-section" aria-labelledby="distintivos">
            <h2 class="course-section__title" id="distintivos">Distintivos</h2>
            <div class="badges">
              ${badgesMarkup}
            </div>
          </section>

          <section class="course-section" aria-labelledby="destaques">
            <h2 class="course-section__title" id="destaques">Destaques do mês</h2>
            <p class="status-text">
              Reconhecimento por contribuição: quem ajudou colegas nos comentários e recebeu votos.
              Não é ranking de conclusão de treinamento.
            </p>
            <div class="highlights">
              ${highlights(comments, new Map([student, ...learners, ...instructors].map((p) => [p.id, p.fullName])))
                .map(
                  (item, index) => `<article class="highlight">
                <span class="highlight__position">${index + 1}</span>
                <span class="highlight__body">
                  <span class="highlight__name">${esc(item.userName)}</span>
                  <span class="highlight__meta">${item.upvotesReceived} votos recebidos · ${item.comments} ${item.comments === 1 ? "comentário" : "comentários"}</span>
                </span>
                <span class="badge">${icon("star")} ${item.upvotesReceived * 5} moedas</span>
              </article>`,
                )
                .join("\n              ")}
            </div>
          </section>

          <section class="course-section" aria-labelledby="loja">
            <h2 class="course-section__title" id="loja">Loja de recompensas</h2>
            <p class="status-text">
              O catálogo de recompensas é definido pelo RH. Estes itens são exemplo.
            </p>
            <div class="rewards-grid">
              ${rewardsMarkup}
            </div>
            <p class="status-text" id="resgate-status" role="status"></p>
          </section>`;

await render(
  "rewards.template.html",
  "rewards.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
    { marker: "/* @@REWARDS@@ */", path: "src/features/rewards/rewards.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": navMarkup
      .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
      .replace('href="/conquistas"', 'href="/conquistas" aria-current="page"'),
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@REWARDS@@": rewardsBody,
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": spriteHtml,
  },
);

/* -------------------------------------------------------------- agenda --- */

const HOJE_CIVIL = "2026-08-12";
const [ANO, MES] = [2026, 8];
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const ICONE_EVENTO = { training: "calendar", deadline: "clock", announcement: "mail" };
const ICONE_NOTIFICACAO = { announcement: "mail", reminder: "clock", achievement: "award" };

const grade = monthGrid(ANO, MES, events)
  .map(
    (cell) => `<div class="calendar__day" data-outside="${!cell.inMonth}" data-today="${cell.date === HOJE_CIVIL}">
                  <span class="calendar__number">${cell.day}</span>
                  ${cell.events
                    .map(
                      (event) => `<span class="calendar__event" data-kind="${event.kind}">
                    ${icon(ICONE_EVENTO[event.kind])}<span>${esc(event.title)}</span>
                  </span>`,
                    )
                    .join("")}
                </div>`,
  )
  .join("\n                ");

const proximos = upcoming(events, HOJE_CIVIL, 4)
  .map((event) => {
    const [, mes, dia] = event.date.split("-");
    return `<article class="event">
                  <span class="event__date">
                    <span class="event__day">${dia}</span>
                    <span class="event__month">${MESES[Number(mes) - 1].slice(0, 3)}</span>
                  </span>
                  <span class="event__body">
                    <h3 class="event__title">${esc(event.title)}</h3>
                    <span class="event__meta">
                      ${[event.time, event.location].filter(Boolean).map(esc).join(" · ") || "Dia inteiro"}
                    </span>
                  </span>
                </article>`;
  })
  .join("\n                ");

const naoLidas = unreadCount(notifications);

const listaNotificacoes = sortNotifications(notifications)
  .map((item) => {
    const [, mes, dia] = item.date.split("-");
    return `<article class="notification" data-read="${item.read}">
                  <span class="notification__icon">${icon(ICONE_NOTIFICACAO[item.kind])}</span>
                  <span class="notification__body">
                    <h3 class="notification__title">${esc(item.title)}</h3>
                    <p class="notification__text">${esc(item.body)}</p>
                    <span class="notification__time">${dia}/${mes}${item.read ? "" : " · não lida"}</span>
                  </span>
                </article>`;
  })
  .join("\n                ");

const agendaBody = `<div class="agenda__main">
              <section class="calendar" aria-label="Calendário de ${MESES[MES - 1]} de ${ANO}">
                <div class="calendar__head">
                  <h2 class="calendar__month">${MESES[MES - 1][0].toUpperCase()}${MESES[MES - 1].slice(1)} de ${ANO}</h2>
                  <button type="button" class="icon-button" aria-label="Mês anterior" data-month>${icon("chevron-left")}</button>
                  <button type="button" class="icon-button" aria-label="Próximo mês" data-month>${icon("chevron-right")}</button>
                </div>
                <p class="status-text" id="mes-status" role="status"></p>
                <div class="calendar__grid">
                  ${SEMANA.map((dia) => `<span class="calendar__weekday">${dia}</span>`).join("")}
                ${grade}
                </div>
              </section>

              <section class="course-section" aria-labelledby="proximos">
                <h2 class="course-section__title" id="proximos">Próximos eventos</h2>
                <div class="event-list">
                ${proximos}
                </div>
              </section>
            </div>

            <aside class="agenda__aside">
              <section class="course-section" aria-labelledby="comunicados">
                <div class="section-head">
                  <h2 class="course-section__title" id="comunicados">Comunicados</h2>
                  <span class="badge ${naoLidas > 0 ? "" : "badge--neutral"}">${naoLidas} não lidas</span>
                </div>
                <div class="notifications">
                ${listaNotificacoes}
                </div>
              </section>
            </aside>`;

await render(
  "agenda.template.html",
  "agenda.html",
  [
    { marker: "/* @@TOKENS@@ */", path: "src/styles/tokens.css" },
    { marker: "/* @@BASE@@ */", path: "src/styles/base.css" },
    { marker: "/* @@COMPONENTS@@ */", path: "src/styles/components.css" },
    { marker: "/* @@SHELL@@ */", path: "src/features/app-shell/app-shell.css" },
    { marker: "/* @@DASHBOARD@@ */", path: "src/features/dashboard/dashboard.css" },
    { marker: "/* @@AGENDA@@ */", path: "src/features/agenda/agenda.css" },
  ],
  {
    "@@LOGO@@": wordmarkWhite,
    "@@LOGO_BRAND@@": wordmark,
    "@@MARK@@": markWhite,
    "@@NAV@@": navMarkup
      .replace('href="/dashboard" aria-current="page"', 'href="/dashboard"')
      .replace('href="/agenda"', 'href="/agenda" aria-current="page"'),
    "@@INITIALS@@": esc(initials),
    "@@FULLNAME@@": esc(student.fullName),
    "@@ROLE_LABEL@@": "Aluno",
    "@@AGENDA@@": agendaBody,
    "@@SEED@@": seedState,
    "@@ICON_SPRITE@@": spriteHtml,
  },
);

/* ----------------------------------------------------------- auditoria --- */

const ACAO = {
  login: "Entrou na plataforma",
  login_failed: "Falha de login",
  course_created: "Criou curso",
  course_published: "Publicou curso",
  course_deleted: "Excluiu curso",
  user_invited: "Convidou usuário",
  user_deactivated: "Desativou usuário",
  role_changed: "Alterou perfil de acesso",
  report_exported: "Exportou relatório",
  enrollment_created: "Matriculou aluno",
  access_denied: "Acesso negado",
};

const resumoAuditoria = auditSummary(auditEvents);
const alertas = repeatedDenials(auditEvents);

const auditStats = [
  { icon: "list-filter", value: String(resumoAuditoria.total), label: "eventos registrados" },
  { icon: "circle-alert", value: String(resumoAuditoria.denied), label: "tentativas negadas" },
  { icon: "lock", value: String(resumoAuditoria.sensitive), label: "ações sensíveis" },
  { icon: "users", value: String(resumoAuditoria.actors), label: "autores distintos" },
]
  .map(
    (stat) => `<article class="stat-card">
                <span class="stat-card__icon">${icon(stat.icon)}</span>
                <span class="stat-card__value">${esc(stat.value)}</span>
                <span class="stat-card__label">${esc(stat.label)}</span>
              </article>`,
  )
  .join("\n              ");

const alertaMarkup = alertas.length
  ? alertas
      .map(
        (alerta) => `<div class="audit-alert">
                <span class="audit-alert__icon">${icon("circle-alert")}</span>
                <span class="audit-alert__body">
                  <h2 class="audit-alert__title">${esc(alerta.actorName)}: ${alerta.denials} tentativas negadas</h2>
                  <p class="audit-alert__text">
                    Pode ser permissão mal configurada ou tentativa de acesso indevido. Vale conferir
                    as linhas negadas abaixo antes de concluir.
                  </p>
                </span>
              </div>`,
      )
      .join("\n              ")
  : "";

const auditRows = queryAudit(auditEvents)
  .map((event) => {
    const data = new Date(event.at);
    const quando = `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")} ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
    const negado = event.outcome === "denied";

    return `<tr data-outcome="${event.outcome}" data-sensitive="${isSensitive(event)}">
                  <td data-label="Quando"><span class="audit-time">${quando}</span></td>
                  <td data-label="Quem"><span class="table__name">${esc(event.actorName)}</span></td>
                  <td data-label="Ação">
                    ${esc(ACAO[event.action])}
                    ${isSensitive(event) ? `<span class="badge badge--neutral">${icon("lock")} Sensível</span>` : ""}
                  </td>
                  <td data-label="Alvo"><span class="audit-target">${esc(event.target)}</span></td>
                  <td data-label="Origem"><span class="audit-ip">${esc(event.ip ?? "—")}</span></td>
                  <td data-label="Resultado">
                    <span class="badge ${negado ? "badge--denied" : "badge--success"}">
                      ${negado ? "Negado" : "Permitido"}
                    </span>
                  </td>
                </tr>`;
  })
  .join("\n                ");

const auditBody = `<div class="engagement">
            <div class="engagement__stats">
              ${auditStats}
            </div>

            ${alertaMarkup}

            <section class="course-section">
              <div class="admin-toolbar">
                <div class="search">
                  ${icon("search")}
                  <label class="sr-only" for="busca-auditoria">Buscar no registro</label>
                  <input class="input" id="busca-auditoria" type="search" placeholder="Buscar por pessoa ou alvo" autocomplete="off" />
                </div>
                <label class="checkbox" for="so-negadas">
                  <input type="checkbox" id="so-negadas" />
                  <span class="checkbox__box" aria-hidden="true">${icon("check")}</span>
                  <span>Só negadas</span>
                </label>
                <label class="checkbox" for="so-sensiveis">
                  <input type="checkbox" id="so-sensiveis" />
                  <span class="checkbox__box" aria-hidden="true">${icon("check")}</span>
                  <span>Só sensíveis</span>
                </label>
              </div>
              <p class="status-text" id="auditoria-status" role="status"></p>

              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col">Quando</th>
                      <th scope="col">Quem</th>
                      <th scope="col">Ação</th>
                      <th scope="col">Alvo</th>
                      <th scope="col">Origem</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody id="auditoria">
                ${auditRows}
                  </tbody>
                </table>
              </div>
            </section>
          </div>`;

await render("studio.template.html", "audit.html", STUDIO_STYLES, {
  ...adminCommon("/admin/auditoria"),
  "@@TITLE@@": "Auditoria",
  "@@SUBTITLE@@": "Quem fez o quê, quando, e se foi permitido. O registro só é escrito — nunca alterado.",
  "@@HEAD_ACTION@@": "",
  "@@STUDIO_BODY@@": auditBody,
});

/* ------------------------------------------------------------- verificação */

const faltando = EXPECTED_PAGES.filter((page) => !generated.has(page));
if (faltando.length > 0) {
  throw new Error(
    `O build não gerou ${faltando.join(", ")}. ` +
      "Algum bloco de render sumiu — o arquivo antigo no disco não conta.",
  );
}

const extras = [...generated].filter((page) => !EXPECTED_PAGES.includes(page));
if (extras.length > 0) {
  throw new Error(`Página gerada sem estar declarada em EXPECTED_PAGES: ${extras.join(", ")}`);
}

console.log(`\n${generated.size} páginas geradas e conferidas.`);
