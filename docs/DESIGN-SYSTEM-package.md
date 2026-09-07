# NerdResolve LMS — Design System

NERDRESOLVE is a corporate digital learning platform (LMS). Students sign in, browse a course catalog, watch
video lessons, track their progress module by module, move between lessons and discuss each lesson in
the comments. The product is Portuguese-language (pt-BR) and enterprise-facing: accounts are provisioned
by an administrator, not self-serve.

The design system exists so every NERDRESOLVE surface — login, access page, catalog, course, lesson — is built
from the same tokens and components rather than one-off page styling.

## Sources this system was built from

| Source | What came from it |
| --- | --- |
| `uploads/designfinal.png` (copied to `assets/reference-designfinal.png`) | **Primary visual target.** Brand palette hexes, Plus Jakarta Sans, type scale, radius + shadow scale, wave signature, login / access / course layouts, desktop and mobile composition |
| `uploads/logo.png` (copied to `assets/nerdlms-logo.png`) | The official NERDRESOLVE wordmark |
| <https://github.com/mariathdev/nerdlms> — `contexts/design.md` | The written ALDS spec: spacing scale, breakpoints, layout dimensions (280px sidebar, 72px topbar, 1440 max width, 720 reading width), component inventory, motion durations, accessibility bar, Lucide as the icon set |
| <https://github.com/mariathdev/nerdlms-pilot> | **Empty repository at the time of writing** (GitHub returned no tree). Nothing could be read from it |
| <https://github.com/lucide-icons/lucide> | The 50 icon SVGs in `assets/icons/` (ISC licence) |

Explore those repositories yourself for deeper context — `mariathdev/nerdlms` also carries
the engineering standards the product is built to. Note that the repo's `design.md` names **Inter** and a different blue ramp; where the spec and
the approved visual reference disagree, **the reference wins** (Plus Jakarta Sans, `#0A33CC`). The
spec's non-visual rules (spacing, layout dimensions, a11y, component inventory) are adopted as-is.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The single entry point consumers link. Imports everything below |
| `tokens/` | `fonts` · `colors` · `typography` · `spacing` · `radius` · `elevation` · `motion` · `layout` · `base` |
| `components/` | React primitives, grouped by concern (see below) |
| `ui_kits/lms-platform/` | Click-through recreation of the platform — 5 screens, light + dark, 3 viewports |
| `templates/login/` | Starting template: the split brand-panel login screen |
| `templates/lesson-page/` | Starting template: the video lesson screen with rail, pager and comments |
| `guidelines/` | Foundation specimen cards (colors, type, spacing, brand) |
| `assets/` | Logo (blue + white), Lucide icon SVGs, the reference image |
| `SKILL.md` | Agent-Skills entry point |
| `github.md` | Upstream repository association + sync record |

## Components

Grouped by concern. Every component has a `.d.ts` props contract and a `.prompt.md` usage note beside it.

* **brand/** — `Logo`, `Wave`
* **icon/** — `Icon`
* **forms/** — `Button`, `IconButton`, `Input`, `PasswordInput`, `Checkbox`, `Switch`, `Select`, `FormField`
* **data/** — `Card`, `Badge`, `Progress`, `Avatar`, `StatBlock`
* **navigation/** — `Sidebar`, `SidebarItem`, `Breadcrumb`, `Tabs`, `ModuleAccordion`, `LessonNav`, `MobileNav`
* **overlays/** — `Dialog`, `Tooltip`, `DropdownMenu`
* **learning/** — `CourseCard`, `LessonListItem`, `VideoPlayer`, `CommentThread`
* **feedback/** — `EmptyState`, `ErrorState`, `Skeleton`, `Spinner`

### Intentional additions

The reference and the spec between them define the inventory. Three components are additions with a reason:

* `Icon` — a wrapper over the bundled Lucide glyphs, so no screen hand-rolls SVG.
* `Wave` — the reference's signature shapes needed to be a real component rather than a background image.
* `MediaPlaceholder` (inside the UI kit, not a shipped primitive) — stands in for photography that was not supplied.

### Not built

The repo's `design.md` lists an aspirational library that reaches far past the product surfaces the
reference defines — `Table`, `DataGrid`, `Pagination`, `Combobox`, `Calendar`, `Charts`, `Timeline`,
`TreeView`, `FileUpload`, `PermissionMatrix`, `PDFViewer`, `MarkdownViewer`, `Toast`, `Drawer`,
`Popover`. None of them appear in the approved reference, so none were invented here. Ask for them and
they can be designed against the same tokens.

---

# Content fundamentals

**Language.** Portuguese (pt-BR), always. Interface strings are never mixed with English.

**Person.** Second person singular, `você` — warm but not familiar. The product speaks *to* the student:
"Acesse sua conta para continuar.", "Seu progresso", "Você ainda não tem cursos". The platform never
speaks in the first person ("nós", "criamos") outside marketing copy on the access page.

**Casing.** Sentence case everywhere — headings, buttons, labels, empty states. The only uppercase is the
11px overline used for sidebar section labels and category tags (`BIBLIOTECA`, `CONTA`,
`DESENVOLVIMENTO`). Never title-case a sentence.

**Punctuation.** Full stops on sentences and descriptions ("Acesse sua conta para continuar."), none on
labels, buttons, badges or metadata. Use `—` (em dash) for lesson prefixes ("Módulo 1 — Fundamentos") and
`·` (middle dot) to separate metadata ("16 aulas · 8h 30min").

**Buttons.** Imperative verb first, two or three words max: *Entrar*, *Começar agora*, *Continuar curso*,
*Concluir aula*, *Ver catálogo*, *Tentar novamente*. Never "Clique aqui", never a bare noun.

**Headings.** Short, concrete, no marketing padding inside the app: "Meus cursos", "Conteúdo do curso",
"Comentários". The access page is the one place the voice lifts: "Conhecimento que transforma realidades".

**Empty and error states.** Calm and forward-looking, never apologetic and never blaming. Structure is:
what is missing → one line of context → the action.
"Você ainda não tem cursos. / Explore o catálogo e comece sua primeira trilha. / **Ver catálogo**".
Errors are human first, code second: "Verifique sua conexão e tente novamente." then `AEG-503`. Stack
traces never surface.

**Numbers.** Portuguese conventions and abbreviated at scale: `+10 mil`, `+200`, `94%`, `8h 30min`,
`12:40`. Durations are always pre-formatted strings, never raw minutes.

**Emoji.** Never — not in UI copy, not in empty states, not in comments UI. Meaning is carried by Lucide
icons and colour.

**Tone in one line:** a calm, competent colleague who respects your time — clear, specific, unhurried,
never chatty and never corporate-stiff.

---

# Visual foundations

## Colour

The palette is deliberately narrow: one blue, one neutral ramp, four status colours.

* **Primária `#0A33CC`** (`--blue-700`, `--brand`) — primary buttons, active nav, links, progress fill,
  the sidebar family, the login brand panel. This is the colour the product is remembered by.
* **Secundária `#2D5BFF`** (`--blue-500`, `--brand-accent`) — the lighter half of every wave gradient,
  focus rings, the active sidebar block, the video scrubber.
* **Fundo `#F2F5FF`** (`--blue-50`) — the app background. White is reserved for cards and fields, so
  surfaces separate without borders doing all the work.
* **Profunda `#07123A`** (`--blue-950`) — headings, the video surface, tooltips, the modal scrim.
* **Neutro `#64748B`** (`--neutral-500`) — metadata and secondary text.

Blue is used *strategically*, not everywhere: one primary action per view, one blue surface per screen.
Status colours never decorate — red exists only for destructive actions and errors.

**Always reach for the semantic aliases** (`--surface-card`, `--text-muted`, `--border-subtle`), never
the raw ramp. That is what makes dark mode work.

## Dark mode

A first-class theme on `[data-theme="dark"]`, not an inversion. Surfaces are deep navy
(`#060E26` page → `#0D1836` card → `#132048` raised) — blue-tinted, never neutral black. The brand token
shifts *up* the ramp to `--blue-500` so actions keep contrast against dark surfaces. Borders become
`#243566` navy hairlines. Hierarchy, spacing and component geometry are identical between themes.

## Typography

**Plus Jakarta Sans** throughout, from Google Fonts (no licensed binaries were supplied — flagged below).
JetBrains Mono appears only for timecodes and error codes.

Scale: Display 48/56 · H1 32/40 · H2 24/32 · H3 20/28 · Body-lg 18/28 · Body 16/24 · Small 14/20 ·
Caption 12/16 · Overline 11/14 at `.09em` uppercase.

Weights are limited to five in practice: 400 body, 500 medium labels, 600 headings and buttons, 700 page
titles, 800 display and statistics. Negative tracking tightens as size grows (−0.01em at H3 → −0.03em at
Display). Body text never goes below 14px; nothing is italic; nothing is underlined except links on hover.

## Spacing and layout

4px base unit, scale `4 8 12 16 20 24 32 40 48 64 80 96 128`. No arbitrary values.

Fixed dimensions: sidebar 280px (collapsed 72px), topbar 72px, mobile bottom nav 64px, content max
1440px, reading width 720px. Controls are 36 / 44 / 52px tall. Page gutters are 40px desktop, 20px mobile.
Card grids use `minmax(280px, 1fr)` with a 24px gap.

Layouts are balanced, not stretched: the lesson page is a flexible content column plus a fixed 340px
lesson rail; the login is a fixed-max 980px panel centred in the viewport. Mobile is designed, not
collapsed — the sidebar becomes a bottom tab bar, the lesson rail becomes a right-edge sheet, the login
brand panel becomes a short header with the form on a rounded white sheet riding over it.

## Backgrounds and the wave signature

No photography-as-background, no textures, no noise, no full-bleed gradients behind text. Backgrounds are
flat token colours plus **the wave** — the one decorative element NERDRESOLVE allows.

Waves are real SVG paths (`Wave`), never flattened images, in four shapes: `panel` (tall login edge),
`band` (wide footer/hero base), `blob` (accent behind imagery), `ripple` (small flourish under brand
copy). They are filled with a `--wave-from` → `--wave-to` gradient, absolutely positioned inside an
`overflow:hidden` parent, and always `pointer-events:none`. One wave per surface; at most two layered,
and the back one at reduced opacity. Waves never sit behind body text at full strength.

## Corners, borders, shadows

Radius: inputs and buttons **12px**, cards **16px**, large panels and sheets **24px**, chips and avatars
full. Small internal chips use 8px, the check inside a checkbox 4px.

Cards are white, 16px radius, a **1px `--border-subtle` hairline**, and `--shadow-sm`. The hairline does
the separating; the shadow only hints at depth. Interactive cards lift 2px and tint their border blue on
hover — they do not scale, glow or change background.

Four elevations only: `sm` for resting cards, `md` for hovered cards and dropdowns, `lg` for dialogs and
the login panel, `brand` (a blue-tinted glow) reserved for the rare floating brand element. Use the
smallest that reads. No inner shadows anywhere; no coloured drop shadows on ordinary UI.

## Interaction states

* **Hover** — buttons darken one step down the ramp (`--brand` → `--brand-hover`); secondary and ghost
  buttons pick up the pale `--surface-brand-subtle` tint; nav rows lighten toward white; cards lift 2px.
  Opacity is never used to express hover.
* **Press** — a 1px downward translate. No scale, no ripple.
* **Focus** — a 3px `rgba(45,91,255,.35)` ring plus a `--border-focus` border on fields; a 2px outline with
  2px offset globally via `:focus-visible`. Focus is never removed.
* **Disabled** — 50% opacity and `not-allowed`; fields switch to `--field-bg-disabled`.
* **Selected/active** — a solid filled block (sidebar), a 2px underline (tabs), or a tinted row
  (lesson list). Never bold text alone.

## Motion

Short and purposeful. 150ms for hover/focus/colour, 200ms for menus, accordions and switches, 280ms for
dialogs, progress fills and sheets. One easing curve for everything: `cubic-bezier(.2,.8,.3,1)`.
Entrances are an 8px rise plus fade (`nerd-rise`); there are no bounces, springs, parallax or looping
ambient animation. Loading uses a 1.4s shimmer skeleton or a small ring spinner. Every duration token
collapses to 0ms under `prefers-reduced-motion`.

## Transparency and blur

Sparingly and only over media or brand colour: the modal scrim is `rgba(7,18,58,.45)` with a 2px blur;
controls over the video player and blue panels use white at 12–22% alpha; the video chrome sits under a
top-and-bottom protection gradient rather than a solid bar. UI on white never uses transparency or
glass effects.

## Imagery

Cool-toned, natural corporate photography — real people working and studying, no heavy filters, no
duotone, no grain. Images are always clipped to a token radius (12 / 16 / 24) or masked by a wave blob,
and sit at 16:9 (course covers, video) or 4:3 (floating accent tiles). Photography is never laid behind
body copy without the navy protection gradient.

**No photography was supplied with this brand**, so every image slot in the UI kit renders a branded blue
`MediaPlaceholder` instead of stock imagery.

---

# Iconography

* **Set:** [Lucide](https://lucide.dev) — named by `contexts/design.md` as the product's icon library.
  50 glyphs are bundled as SVG in `assets/icons/` (ISC licence) and compiled into `components/icon/iconPaths.js`.
  Nothing is hand-drawn.
* **Rendering:** always through `<Icon name="…" />`, which emits a 24×24 stroke SVG using `currentColor`.
  Never inline raw SVG in a screen; never use an `<img>` for a UI icon (it can't inherit colour).
* **Sizes:** 16 (inside chips and dense rows), 20 (default, buttons and nav), 24 (section headers),
  32 and 48 (empty states, feature marks). Stroke width 2 everywhere; 2.3 for an active mobile-nav item.
* **Colour:** icons inherit text colour. Brand blue for active/interactive, `--text-muted` for resting
  metadata, white over blue surfaces.
* **Labels:** icons never replace a label where the meaning is not obvious. Icon-only controls are
  `IconButton`, which requires an accessible label and usually carries a `Tooltip`.
* **Emoji:** never used. **Unicode symbols:** only `·` and `—` as typographic separators, never as icons.
* **Brand mark:** the NERDRESOLVE wordmark is a bitmap asset (`assets/nerdlms-logo.png` / `-white.png`) rendered
  by `<Logo />`. It is never retyped, recoloured beyond the two supplied tones, or reconstructed.

---

# Known substitutions & gaps — please review

1. **Font files.** No licensed NERDRESOLVE webfont binaries were supplied. Plus Jakarta Sans is loaded from
   Google Fonts. If NERDRESOLVE licenses its own cut, drop the files in `assets/fonts/` and replace the
   `@import` in `tokens/fonts.css` with `@font-face` rules.
2. **Logo format.** Only a PNG was provided. An SVG wordmark would render sharper at every size; the
   white variant here is generated from the PNG's alpha channel.
3. **Photography.** None supplied — see `MediaPlaceholder` above.
4. **`nerdlms-pilot`** was empty, so no product code informed the recreation; screens are built from the
   approved reference image plus the written spec.

---

<sub>**NerdResolve LMS** · Documentação de produto · © 2026 Matheus Mariath (mariathdev) — NerdResolve.<br>Uso comercial requer licença: ver [LICENSE.md](../LICENSE.md).</sub>
