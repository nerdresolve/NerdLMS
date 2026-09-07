# Fontes

## Satoshi

Family used by the platform's default theme. Self-hosted here as `.woff2`, one
file per weight — the browser downloads only the weights the page actually uses.

**Satoshi is NOT under an open-source font license.** It is published by
[Fontshare](https://www.fontshare.com/fonts/satoshi) (Indian Type Foundry) under
the *Fontshare Free License*, which permits free personal and commercial use of
the webfont but **does not permit redistribution of the font files themselves**.

### What this means for you

If you forked this repository to run your own instance, replace these files with
a font you have the right to serve, then point `src/styles/nerd-ds/tokens/fonts.css`
at it. The design system reads a single variable — `--font-sans` — so swapping
the family is one line, not a refactor.

A drop-in substitute under the SIL Open Font License, with a similar geometric
grotesque feel:

- [Inter](https://fonts.google.com/specimen/Inter) — closest match, OFL
- [Manrope](https://fonts.google.com/specimen/Manrope) — OFL
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — OFL

Download the `.woff2` files, drop them in this folder, and edit the `@font-face`
blocks in `fonts.css`. Nothing else in the codebase names a font.
