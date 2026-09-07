import type { MetadataRoute } from "next";

/**
 * robots.txt da aplicação.
 *
 * Existe porque, sem ele, quem respondia era o "Managed Content" da Cloudflare
 * — que injeta a diretiva não-padrão `Content-Signal:`. O Lighthouse a lê como
 * sintaxe inválida e reprova a auditoria `robots-txt`. Servindo o nosso, a
 * origem tem precedência e o arquivo volta a ser só o que a especificação
 * prevê.
 *
 * Só a API é bloqueada aqui. As telas internas ficam de fora da lista de
 * propósito: já estão protegidas por sessão — o robô que as visita recebe o
 * redirecionamento para o login, nunca o conteúdo —, então listá-las não
 * acrescentaria proteção e ainda publicaria o mapa das rotas internas. As duas
 * telas que realmente não devem ser indexadas (`/login`, `/redefinir-senha`)
 * dizem isso por conta própria, com `robots: { index: false }` no metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
       * Só a API fica de fora. O resto NÃO é listado como `Disallow`, e a
       * razão é contraintuitiva: as telas internas já estão protegidas por
       * sessão — o robô que as visita recebe o redirecionamento para o login,
       * nunca o conteúdo. Listá-las aqui não acrescenta proteção, e ainda
       * publica num arquivo aberto o mapa exato das rotas internas.
       */
      disallow: "/api/",
    },
  };
}
