import "server-only";

/**
 * O formulário auto-submetido do LTI.
 *
 * É como o padrão define a entrega do token: um formulário que o navegador
 * envia sozinho. Não é GET porque o token vai no corpo — numa query string ele
 * apareceria no log do servidor da ferramenta, no histórico do navegador e no
 * cabeçalho `Referer`.
 *
 * Compartilhado entre o launch e a rota de autenticação. Eram duas cópias, e
 * duas cópias de um escape são duas chances de uma delas ficar para trás.
 *
 * O `<noscript>` com botão existe porque sem JavaScript o envio automático não
 * acontece: sem ele, a página travaria em branco no meio do launch.
 */

/** Escapa para atributo HTML. Nada entra no formulário sem passar por aqui. */
export function escapeHtmlAttribute(valor: string): string {
  return valor.replace(/[&<>"']/g, (char) => {
    const mapa: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return mapa[char]!;
  });
}

export function autoPostForm(params: {
  action: string;
  titulo: string;
  campos: Record<string, string>;
}): Response {
  const inputs = Object.entries(params.campos)
    .map(
      ([nome, valor]) =>
        `    <input type="hidden" name="${escapeHtmlAttribute(nome)}" value="${escapeHtmlAttribute(valor)}">`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${escapeHtmlAttribute(params.titulo)}</title></head>
<body onload="document.forms[0].submit()">
  <form method="post" action="${escapeHtmlAttribute(params.action)}">
${inputs}
    <noscript>
      <p>${escapeHtmlAttribute(params.titulo)}</p>
      <button type="submit">Continuar</button>
    </noscript>
  </form>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      /* O token vai neste HTML: cache seria guardar credencial em disco. */
      "cache-control": "no-store",
    },
  });
}
