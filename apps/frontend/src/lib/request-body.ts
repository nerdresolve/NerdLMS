/**
 * Leitura de corpo JSON e validação de identificador.
 *
 * Existe porque as rotas repetiam `await request.json()` dentro de um `try` e
 * liam os campos **fora** dele. Isso deixava dois buracos que devolviam 500:
 *
 *   - corpo `null`: `JSON.parse("null")` não lança, então o `catch` não roda e
 *     o `body.campo` seguinte estoura TypeError;
 *   - id fora do formato UUID: toda coluna de id é `uuid` no schema, e o
 *     Postgres rejeita texto inválido com 22P02 — o erro subia pelo pool e
 *     virava 500. Note que id inexistente, mas bem formado, já era tratado
 *     como 404: o problema era só o formato.
 *
 * Uma requisição malformada é erro de quem chama (4xx), nunca falha do
 * servidor.
 */

/** Corpo JSON como objeto. `null`, lista ou texto solto viram `null`. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Formato aceito pelas colunas `uuid` do Postgres.
 *
 * Deliberadamente permissivo quanto à versão: valida a forma, não a origem. O
 * seed usa UUIDv5 e a aplicação gera v4 — os dois passam.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` quando o valor é texto no formato UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
