import "server-only";

import { headers } from "next/headers";

/**
 * O endereço que o navegador usou para chegar até aqui.
 *
 * Existe por causa das URLs assinadas do storage. A assinatura do S3 cobre o
 * host, então ela precisa ser feita contra o endereço que o navegador vai
 * pedir — e esse endereço mudava conforme o ambiente enquanto a configuração
 * era um valor fixo. O padrão apontava para uma porta que ninguém publicava, e
 * o efeito era total e silencioso: nenhum vídeo carregava, em nenhum ambiente,
 * sem mensagem de erro em lugar nenhum.
 *
 * `x-forwarded-proto` e `x-forwarded-host` vêm do proxy reverso; `host` é o
 * que o navegador enviou. Atrás do túnel o TLS termina antes do Caddy, então
 * `host` sozinho diria `http` para um site que atende em `https`.
 *
 * Devolve `null` quando não dá para determinar. Quem chama cai na variável de
 * ambiente — errar o endereço é pior que não passar nenhum, porque uma URL
 * assinada contra o host errado o MinIO recusa com `SignatureDoesNotMatch`.
 */
export async function origemDaRequisicao(): Promise<string | null> {
  const cabecalhos = await headers();

  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  if (!host) return null;

  /* `x-forwarded-proto` pode chegar como lista quando há mais de um salto:
     "https, http". O primeiro é o que o navegador falou. */
  const protocolo = (cabecalhos.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();

  /* Sem cabeçalho do proxy, o esquema se deduz do host: `localhost` e
     `127.0.0.1` são desenvolvimento e atendem em texto claro; qualquer outro
     nome atende em HTTPS, e presumir o contrário geraria uma URL que o
     `upgrade-insecure-requests` da CSP reescreveria depois de assinada. */
  const esquema =
    protocolo || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");

  return `${esquema}://${host}`;
}
