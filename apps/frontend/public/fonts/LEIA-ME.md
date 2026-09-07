# Fontes

## Manrope

Família usada pelo tema padrão da plataforma. Auto-hospedada aqui como um único
`.woff2` **variável**: o eixo `wght` cobre 200–800, então os cinco pesos que o
design system usa saem de 24 kB. Uma família estática equivalente seriam oito
arquivos e cerca de 215 kB.

**Licença: SIL Open Font License 1.1** — ver [OFL.txt](OFL.txt). Pode ser usada,
modificada e **redistribuída**, inclusive comercialmente. É por isso que ela
acompanha o repositório: um fork pode publicá-la sem tomar nenhuma providência.

### Itálico

A Manrope não publica um desenho itálico próprio; o navegador inclina o romano.
Isso é aceitável aqui porque o itálico aparece em pouca coisa — citação,
legenda, ênfase curta. Se ele virar tipografia de corpo em algum lugar, troque
por uma família com itálico verdadeiro.

### Trocar a família

O design system lê uma variável só, `--font-sans`, então trocar a fonte é
mexer em três arquivos e nada mais:

1. `apps/frontend/public/fonts/` — ponha o `.woff2` e a licença dele
2. `apps/frontend/src/styles/fonts.css` — o `@font-face` e o `--font-sans`
3. `apps/frontend/src/app/layout.tsx` — o `localFont`

Também sob OFL, com caráter parecido (grotesca geométrica):

- [Inter](https://fonts.google.com/specimen/Inter) — a mais neutra, variável
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — variável, com itálico próprio
- [Figtree](https://fonts.google.com/specimen/Figtree) — variável, com itálico próprio

Depois de trocar, rode `npm run preview` e `npm run test:a11y`.

> **Fonte com licença restritiva não entra aqui.** Muita família comercial
> permite usar como webfont mas **não redistribuir** — e um repositório público
> redistribui. Confira a licença antes de versionar o arquivo.
