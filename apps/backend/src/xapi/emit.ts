import { buildStatement, validateStatement, type VerbKey } from "@nerdlms/core/xapi/statement.ts";

import { storeStatement } from "./lrs-repository.ts";
import { query } from "../db/pool.ts";

/**
 * A plataforma registrando as próprias ações no LRS — F6-03.
 *
 * É o outro lado do §26: além de RECEBER statements de fora, o produto emite os
 * seus. Sem isso, um relatório de xAPI teria só metade da história — e a
 * metade que falta é justamente a que a plataforma conhece melhor.
 *
 * **Nunca lança.** Um statement que falha não pode impedir a aula que o gerou —
 * mesma regra de `notify`, `recordAudit`, `dispatchWebhook`, `evaluateBadges` e
 * `grantCompetenciesForCourse`.
 */
export async function emitStatement(input: {
  tenantId: string;
  userId: string;
  verb: VerbKey;
  objectPath: string;
  objectName: string;
  courseId?: string | null;
  lessonId?: string | null;
  result?: { completion?: boolean; success?: boolean; duration?: string; score?: { scaled?: number } };
}): Promise<void> {
  try {
    /* A URL da instalação: o IRI do objeto precisa ser absoluto, e é ele que
       distingue a aula 5 daqui da aula 5 de outro cliente. Vem do banco porque
       o backend não tem cabeçalho de requisição — e do TENANT, não de uma
       variável fixa, porque cada cliente atende no domínio dele. */
    const dados = await query<{ domain: string | null; email: string | null; full_name: string }>(
      `SELECT t.domain, u.email::text AS email, u.full_name
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = $1 AND u.tenant_id = $2
        LIMIT 1`,
      [input.userId, input.tenantId],
    );

    const pessoa = dados[0];
    if (!pessoa) return;

    const baseUrl = pessoa.domain ? `https://${pessoa.domain}` : "https://ead.local";

    const statement = buildStatement({
      baseUrl,
      actorEmail: pessoa.email,
      actorName: pessoa.full_name,
      verb: input.verb,
      objectPath: input.objectPath,
      objectName: input.objectName,
      ...(input.result ? { result: input.result } : {}),
    });

    const conferido = validateStatement(statement);

    /* O que a plataforma gera tem de passar na MESMA validação do que vem de
       fora. Se não passa, é defeito nosso — e gravar assim mesmo colocaria no
       LRS um statement que a consulta não sabe devolver. */
    if (!conferido.ok) {
      console.error("[xapi] statement gerado é inválido:", conferido.error);
      return;
    }

    await storeStatement({
      tenantId: input.tenantId,
      statement: conferido.statement,
      raw: statement,
      actorId: input.userId,
      courseId: input.courseId ?? null,
      lessonId: input.lessonId ?? null,
      /* Nulo: não veio por chave de API, veio de dentro. */
      apiKeyId: null,
    });
  } catch (erro) {
    console.error("[xapi] falha ao emitir statement:", erro);
  }
}
