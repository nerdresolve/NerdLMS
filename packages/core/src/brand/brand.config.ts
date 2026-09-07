/**
 * =============================================================================
 * A MARCA DO PRODUTO — o arquivo que um fork edita primeiro.
 * =============================================================================
 *
 * Este é o único lugar do código que nomeia e colore o produto. Trocar os
 * valores abaixo, substituir quatro imagens e rodar `npm run preview` deixa a
 * plataforma inteira com a sua marca — sem procurar string em componente.
 *
 * NÃO confunda com a marca do CLIENTE. São duas camadas:
 *
 *   PRODUTO   este arquivo. A marca de quem opera a plataforma. Aparece
 *             enquanto o domínio da requisição não identificar nenhum cliente:
 *             acesso inicial, login, recuperação de senha, validação pública
 *             de certificado.
 *
 *   CLIENTE   a tabela `tenants`, editável pela tela Administração →
 *             Plataforma. Cada cliente informa UMA cor e as logos dele, e as
 *             demais cores são derivadas em `tenancy/branding.ts` de modo a
 *             nunca reprovar em contraste. Cliente cadastrado NUNCA vê a marca
 *             daqui.
 *
 * -----------------------------------------------------------------------------
 * COMO TROCAR A MARCA DO PRODUTO
 * -----------------------------------------------------------------------------
 *
 * 1. Edite `NOME` e `COR` abaixo.
 *
 * 2. Substitua os quatro arquivos em `apps/frontend/public/brand/`, mantendo
 *    os nomes e as proporções (o `next/image` recebe width/height fixos):
 *
 *      nerdresolve-wordmark.png         600x165  logo + nome, sobre claro
 *      nerdresolve-wordmark-white.png   600x165  a mesma, sobre escuro
 *      nerdresolve-mark.png             228x117  só o símbolo, sobre claro
 *      nerdresolve-mark-white.png       228x117  só o símbolo, sobre escuro
 *
 *    Prefere outros nomes? Troque também os caminhos em `ARQUIVOS`.
 *
 * 3. Ícone da aba e do celular: `apps/frontend/src/app/icon.png` (512x512),
 *    `apple-icon.png` (180x180) e `apps/frontend/public/favicon.ico`.
 *
 * 4. Rampa de cor da interface: `apps/frontend/src/styles/nerd-ds/tokens/colors.css`.
 *    A `COR` daqui NÃO gera a rampa do produto — ela é o padrão para tenant sem
 *    cor própria. Para repintar a interface inteira, é aquele arquivo.
 *
 * 5. Cabeçalho dos e-mails: `apps/backend/src/notifications/brand-logo.ts`.
 *    A imagem é base64 embutido, porque cliente de e-mail bloqueia imagem
 *    remota. Regere a sua e cole no lugar.
 *
 * 6. Fonte: `apps/frontend/public/fonts/` + os três lugares que a nomeiam,
 *    listados em `public/fonts/LEIA-ME.md`. A Manrope que vem aqui é SIL Open
 *    Font License — pode ser redistribuída, inclusive num fork comercial.
 *
 * 7. `npm run preview && npm run test:a11y` — o segundo reprova se a cor nova
 *    não passar em contraste. É de propósito: WCAG AA é régua do produto.
 *
 * Depois disso, `grep -ri nerdresolve` deve achar apenas caminhos de arquivo.
 */

/** Nome do produto. Aba do navegador, títulos e telas públicas. */
export const NOME = "NerdResolve LMS";

/**
 * Cor da marca, em hexadecimal de seis dígitos.
 *
 * É o padrão para cliente que não escolheu a própria. `paletteFrom()` deriva
 * hover, ativo, superfície e cor de texto a partir dela, sempre verificando
 * contraste — por isso o cliente informa UMA cor e não seis.
 */
export const COR = "#7C3AED";

/** Onde as imagens da marca moram, a partir da raiz pública do frontend. */
export const ARQUIVOS = {
  /** Logo com o nome, para fundo claro. 600x165. */
  logoClaro: "/brand/nerdresolve-wordmark.png",
  /** A mesma, para fundo escuro. 600x165. */
  logoEscuro: "/brand/nerdresolve-wordmark-white.png",
  /** Só o símbolo, para a sidebar recolhida. 228x117. */
  simbolo: "/brand/nerdresolve-mark.png",
  /** O símbolo para fundo escuro. 228x117. */
  simboloEscuro: "/brand/nerdresolve-mark-white.png",
  /** Ícone da aba. Servido pelo Next a partir de `src/app/icon.png`. */
  favicon: "/icon.png",
} as const;
