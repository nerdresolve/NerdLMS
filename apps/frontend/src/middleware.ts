import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy da aplicação.
 *
 * Mora aqui, e não em `next.config.ts`, porque o plano era emitir um nonce por
 * requisição — e header estático não gera valor novo a cada resposta. O nonce
 * não vingou (ver a nota em `script-src`), mas o middleware fica: é daqui que
 * ele volta quando o Next cooperar, e ter os dois lugares emitindo CSP faria o
 * navegador aplicar a interseção das duas, que é como a página some da tela.
 *
 * Histórico do bug que trouxe este arquivo à existência: com `script-src
 * 'self'` puro, o navegador bloqueava os `<script>` inline que o Next usa para
 * mandar o payload de hidratação. O SSR pintava a tela, a hidratação falhava, o
 * React desmontava a árvore — e sobrava uma página em branco com o `<body>` só
 * de `<script>`. O HTML do servidor estava perfeito o tempo todo; o defeito só
 * aparecia executando a página num navegador de verdade.
 */
export function middleware(_request: NextRequest) {
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
     * `'unsafe-inline'` é dívida consciente, registrada como ISSUE-012.
     *
     * O certo é nonce. Foi tentado três vezes — com `x-nonce`, com a CSP também
     * no header da requisição, com e sem `'strict-dynamic'` — e no `output:
     * "standalone"` o Next não carimbou `nonce=` em nenhuma das 15 tags. Sem o
     * carimbo, `'strict-dynamic'` (que desliga o `'self'`) bloqueia até os
     * chunks da própria origem.
     *
     * E não adianta emitir o nonce "por via das dúvidas" junto com
     * `'unsafe-inline'`: pela especificação, a presença de nonce **anula** o
     * `'unsafe-inline'`. Foi o navegador que disse isso, em texto:
     * "'unsafe-inline' is ignored if either a hash or nonce value is present".
     *
     * O que continua de pé: `'self'` segue lá e não há allowlist de terceiros,
     * então nenhuma origem externa executa script. O que se perde é a proteção
     * contra script inline injetado — que é justamente o que o nonce daria.
     */
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const response = NextResponse.next();
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
