/**
 * Sinal de vida do container — é este o endereço que o healthcheck do
 * docker-compose consulta.
 *
 * Responde apenas se o processo consegue atender uma requisição. NÃO verifica
 * banco nem storage de propósito: um healthcheck que depende do banco derruba a
 * aplicação inteira quando o banco pisca, e o container é reiniciado sem que o
 * problema esteja nele. Prontidão de dependência é outra pergunta, e merece
 * outro endereço quando existir.
 *
 * Não revela versão, host nem ambiente: é uma resposta pública (§23).
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
