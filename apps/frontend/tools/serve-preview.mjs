/**
 * Servidor estático do protótipo — `preview/` no navegador.
 *
 * NÃO é necessário: as páginas são autocontidas e abrem por `file://` com tudo
 * funcionando — conferido por Playwright, incluindo o estado atravessando as
 * telas, o download do certificado e o menu da conta. (Uma versão anterior
 * deste comentário afirmava o contrário, alegando que `file://` isola o
 * armazenamento por arquivo; no Chromium isso não acontece para arquivos da
 * mesma pasta, e a afirmação foi escrita sem ter sido medida.)
 *
 * Serve para: URL para mandar a alguém, `content-type` correto no PDF do
 * certificado, e um ambiente igual ao de produção — onde o protótipo é servido
 * por HTTP, não aberto do disco.
 *
 * Uso: npm run serve   (ou: node tools/serve-preview.mjs [porta])
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "preview");
const porta = Number(process.argv[2] ?? 4173);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  const pedido = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const caminho = pedido === "/" ? "/landing.html" : pedido;

  /* Duas travas contra `../`: `normalize` resolve o caminho, e a comparação
     abaixo recusa qualquer resultado que tenha saído de `preview/`. Servir
     arquivo é onde um servidor de brinquedo costuma entregar o `.env`. */
  const alvo = join(raiz, normalize(caminho));
  if (alvo !== raiz && !alvo.startsWith(raiz + sep)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" }).end("fora de preview/");
    return;
  }

  try {
    const info = await stat(alvo);
    if (!info.isFile()) throw new Error("não é arquivo");
    res.writeHead(200, {
      "content-type": TIPOS[extname(alvo)] ?? "application/octet-stream",
      "content-length": info.size,
      "cache-control": "no-store",
    });
    createReadStream(alvo).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(`<meta charset="utf-8"><p>Não existe: ${caminho}. <a href="/">Voltar ao início</a>.`);
  }
}).listen(porta, () => {
  console.log(`Protótipo em http://localhost:${porta}/`);
});
