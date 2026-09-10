import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy da aplicação.
 *
 * Mora aqui, e não em `next.config.ts`, porque o nonce muda a cada requisição e
 * header estático não gera valor novo a cada resposta. Os dois lugares emitindo
 * CSP ao mesmo tempo fariam o navegador aplicar a interseção das duas, que é
 * como a página some da tela.
 *
 * Histórico do bug que trouxe este arquivo à existência: com `script-src
 * 'self'` puro, o navegador bloqueava os `<script>` inline que o Next usa para
 * mandar o payload de hidratação. O SSR pintava a tela, a hidratação falhava, o
 * React desmontava a árvore e sobrava uma página em branco com o `<body>` só de
 * `<script>`. O HTML do servidor estava perfeito o tempo todo; o defeito só
 * aparecia executando a página num navegador de verdade, e é por isso que
 * mexer nesta CSP pede teste em navegador, não em `curl`.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    // vídeo é hospedagem própria (DEC-009): servido pela mesma origem via proxy
    "media-src 'self' blob:",
    // a fonte é auto-hospedada (DEC-017): nenhuma origem externa
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    /*
     * Nonce por requisição, sem `'unsafe-inline'`.
     *
     * Isto já foi dívida registrada como ISSUE-012: em versões anteriores o
     * Next não carimbava `nonce=` nas tags que ele mesmo emite no `output:
     * "standalone"`, e sem o carimbo o `'strict-dynamic'` (que desliga o
     * `'self'`) bloqueava até os chunks da própria origem. A saída era
     * `'unsafe-inline'`, que deixa passar qualquer script injetado.
     *
     * No 15.5.25 o Next carimba. A única tag que continua sendo nossa é o
     * script de tema em `app/layout.tsx`, que lê o `x-nonce` abaixo e se
     * carimba sozinho. Se um dia voltar a página em branco, é aqui e lá que
     * se olha.
     *
     * Não existe meio-termo: pela especificação, a presença de nonce anula o
     * `'unsafe-inline'`, então não adianta emitir os dois por via das dúvidas.
     */
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "connect-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/*
 * Estáticos ficam de fora: `_next/static` e as imagens já são servidos como
 * arquivo, e passar cada um pelo middleware custa latência sem ganhar nada.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
