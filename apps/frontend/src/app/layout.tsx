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
 * Satoshi, servida do próprio domínio. `next/font/local` cuida do preload e
 * evita layout shift na troca da fonte de sistema para a da marca.
 *
 * Um arquivo por peso (a família não tem versão variável): o Next só embute no
 * HTML o preload dos que a página usa. O itálico é declarado à parte porque na
 * Satoshi ele é um desenho próprio; sem isso o navegador inclinaria o romano
 * por conta e a letra sairia deformada.
 */
const satoshi = localFont({
  src: [
    { path: "../../public/fonts/Satoshi-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Satoshi-Italic.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Satoshi-MediumItalic.woff2", weight: "500", style: "italic" },
    { path: "../../public/fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Satoshi-BoldItalic.woff2", weight: "700", style: "italic" },
    { path: "../../public/fonts/Satoshi-Black.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  variable: "--font-satoshi",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#08060d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={satoshi.variable} data-theme="light" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura. Num efeito do React
            só correria depois da hidratação, e a tela piscaria clara antes de
            escurecer. O `data-theme` acima é o padrão do servidor, que este
            script sobrescreve quando há escolha salva — daí o
            `suppressHydrationWarning`. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
