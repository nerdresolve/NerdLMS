import "server-only";

import { headers } from "next/headers";

/**
 * A URL pública desta instalação, com esquema e host.
 *
 * Existe por causa do Open Badges (F6-01): o padrão exige URLs ABSOLUTAS
 * dentro dos documentos — a `id` da assertion, o link do badge, o do emissor.
 * Um caminho relativo ali quebra a verificação, porque quem busca o documento
 * está em outro domínio e não tem como resolvê-lo.
 *
 * Vem do CABEÇALHO, não de variável de ambiente. O produto é multi-tenant por
 * domínio: cada cliente atende no endereço dele, e uma variável fixa faria todo
 * badge apontar para o domínio de um só — inclusive os dos outros clientes.
 *
 * `x-forwarded-*` antes de `host` pela mesma razão de `tenantOfRequest`: atrás
 * do proxy, `host` chega como o nome interno do serviço.
 */
export async function baseUrlOf(): Promise<string> {
  const store = await headers();

  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost";

  /* HTTPS por padrão. Em produção o proxy sempre manda `x-forwarded-proto`; o
     `http` só aparece em desenvolvimento, e supor `https` num link que é para
     ser clicado é o erro menos custoso. */
  const proto = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}
