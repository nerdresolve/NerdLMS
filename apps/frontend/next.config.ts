import type { NextConfig } from "next";

/**
 * Headers de segurança — e §23.
 * A CSP começa restritiva; cada liberação futura (player de vídeo, CDN)
 * precisa ser justificada e registrada em progress.md.
 */
/*
 * A Content-Security-Policy NÃO mora mais aqui: ela precisa de um nonce novo a
 * cada requisição, e header estático não tem como gerar isso. Ver
 * `src/middleware.ts`.
 *
 * Uma CSP estática aqui, além de redundante, seria nociva: quando os dois
 * headers existem, o navegador aplica a interseção — a regra sem nonce voltaria
 * a bloquear os scripts do Next e a página branca voltaria junto.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* A imagem roda `node server.js`, sem npm e sem node_modules completo: o
     standalone traz só o que o app importa de fato. Sem isto, `.next/standalone`
     não é gerado e o Dockerfile não tem o que copiar. */
  output: "standalone",
  // Não expor a versão do framework (information disclosure — §23).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
