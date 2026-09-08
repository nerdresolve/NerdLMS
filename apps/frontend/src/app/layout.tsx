import { NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";
import type { Metadata, Viewport } from "next";

import { tenantOfRequest } from "@/lib/tenant-request.ts";
import localFont from "next/font/local";

import { THEME_INIT_SCRIPT } from "@/lib/theme.ts";

/* A ordem importa e é a mesma que o protótipo monta em `build-preview.mjs`:
   tokens (via base) → base → componentes.

   `components.css` faltava aqui, e era só isto: os primitivos `.btn`, `.field`,
   `.input`, `.badge` — 17 kB de estilo — nunca entravam no bundle do app. As
   telas renderizavam com a estrutura certa e sem aparência nenhuma (botão sem
   cor, campo sem borda), enquanto o protótipo, que injeta os três arquivos,
   aparecia correto. Comparar as duas era o único jeito de ver a diferença. */
import "@/styles/base.css";
import "@/styles/components.css";

/**
 * Manrope, servida do próprio domínio. `next/font/local` cuida do preload e
 * evita layout shift na troca da fonte de sistema para a da marca.
 *
 * Arquivo único e VARIÁVEL: o eixo `wght` vai de 200 a 800, então um download
 * de 24 kB cobre todos os pesos. Uma família estática equivalente seriam oito
 * arquivos e ~215 kB.
 *
 * Sem entrada de itálico porque a Manrope não publica um desenho itálico
 * próprio — o navegador inclina o romano. Ver `styles/fonts.css`.
 */
const manrope = localFont({
  src: [{ path: "../../public/fonts/manrope.woff2", weight: "200 800", style: "normal" }],
  display: "swap",
  variable: "--font-manrope",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

/**
 * Título e favicon saem do cliente que atende esta requisição.
 *
 * `generateMetadata` em vez de `metadata` estático: num white-label o nome na
 * aba do navegador é do cliente, e um valor fixo faria a plataforma da ACME se
 * anunciar como a organização. O tenant vem do domínio — não há sessão no layout raiz,
 * que também serve a página pública.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await tenantOfRequest();
  const nome = tenant?.name ?? NOME_PADRAO;
  const favicon = tenant?.branding.faviconUrl;

  return {
    title: { default: nome, template: `%s · ${nome}` },
    description: `Plataforma de ensino da ${nome}.`,
    ...(favicon ? { icons: { icon: favicon } } : {}),
  };
}

export const viewport: Viewport = {
  /* O escuro primeiro: é o padrão da plataforma, e a barra do navegador no
     celular deve nascer da cor que a página realmente vai ter. */
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08060d" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura. Num efeito do React
            só correria depois da hidratação, e a tela piscaria clara antes de
            clarear. O `data-theme` acima é o padrão do servidor, que este
            script sobrescreve quando há escolha salva — daí o
            `suppressHydrationWarning`. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
