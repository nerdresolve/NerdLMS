import { activeKeyOf, allKeysOf, toJwk } from "@nerdlms/backend/lti/lti-keys.ts";

import { tenantOfRequest } from "@/lib/tenant-request.ts";

/**
 * GET /api/lti/jwks — as chaves PÚBLICAS desta plataforma (F6-04).
 *
 * É o documento que uma ferramenta busca para conferir o que assinamos. Público
 * e sem sessão por definição: chave pública é pública, e exigir autenticação
 * aqui impediria a ferramenta de verificar o launch.
 *
 * Publica TODAS as chaves do cliente, não só a ativa. É isso que torna a
 * rotação possível: a ferramenta encontra pelo `kid` a chave que assinou o
 * token que ela tem em mãos, mesmo que já tenha sido aposentada.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const tenant = await tenantOfRequest();

  if (!tenant) {
    /* Sem cliente identificado não há chave: devolver um JWKS vazio é melhor
       que 404, porque o formato continua válido e a ferramenta reporta "chave
       não encontrada" em vez de "endereço quebrado". */
    return Response.json({ keys: [] }, { headers: { "access-control-allow-origin": "*" } });
  }

  /* Garante que existe chave ANTES de publicar.

     Sem isto o JWKS sai vazio até o primeiro launch — e uma ferramenta que
     busca o documento na hora de ser configurada, que é o momento natural,
     encontraria `{"keys": []}` e concluiria que a plataforma não assina nada. */
  await activeKeyOf(tenant.id);

  const chaves = await allKeysOf(tenant.id);

  return Response.json(
    { keys: chaves.map((chave) => toJwk(chave.publicKey, chave.kid)) },
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        /* Cacheável: a chave muda só na rotação, e uma ferramenta busca este
           documento a cada launch. Uma hora é o equilíbrio entre carga e o
           tempo até uma chave nova ser vista. */
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
