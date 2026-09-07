import "server-only";

/**
 * A URL de retorno do SSO.
 *
 * Precisa ser IDÊNTICA na ida e na volta, e idêntica ao que está cadastrado no
 * provedor: o Google e a Microsoft comparam a string inteira e recusam qualquer
 * diferença, inclusive uma barra final a mais. Montá-la em dois lugares seria
 * garantir que um dia divergiriam.
 *
 * Sai dos cabeçalhos porque a mesma imagem serve vários domínios — é o ponto do
 * white-label. Uma variável de ambiente com o endereço fixo daria a URL de um
 * cliente para todos os outros.
 */

const CAMINHO = "/api/sso/retorno";

/**
 * O endereço público desta requisição.
 *
 * `request.url` NÃO serve: atrás do Caddy ele traz o endereço interno do
 * contêiner — `https://0.0.0.0:3000` —, e um redirecionamento para lá leva o
 * navegador da pessoa a um host que não existe. Foi o que aconteceu no
 * primeiro teste do retorno, e a mensagem de erro do SSO ia toda para o vazio.
 */
export function publicOrigin(requestHeaders: Headers): string {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";

  /* `x-forwarded-proto` porque atrás do proxy a aplicação recebe HTTP, e usar
     o protocolo visto aqui geraria `http://` numa URL que o provedor conhece
     como `https://` — e ele recusaria por não bater exatamente. */
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";

  return `${proto}://${host}`;
}

export function ssoRedirectUri(requestHeaders: Headers): string {
  return `${publicOrigin(requestHeaders)}${CAMINHO}`;
}
