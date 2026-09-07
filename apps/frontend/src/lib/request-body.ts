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

/**
 * Teto do corpo JSON, em bytes.
 *
 * O Caddy já recusa acima de 10 MB (`max_size` do `handle` geral), e mesmo
 * assim o teto se repete aqui: a aplicação não pode depender de quem está na
 * frente dela. Um `next start` sem proxy, um teste de integração, um ambiente
 * novo mal configurado — em qualquer um desses o limite do Caddy simplesmente
 * não existe, e a única defesa restante é esta.
 *
 * 1 MB é largo para JSON: o maior corpo real do sistema é a importação de
 * questões, e ela não chega perto. Arquivo não passa por aqui — vai para
 * `/api/upload*`, que tem o teto próprio de 2 GB.
 */
export const LIMITE_DO_CORPO = 1024 * 1024;

/** Corpo JSON como objeto. `null`, lista, texto solto ou grande demais viram `null`. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  /* O `content-length` é dica, não prova: quem ataca controla o cabeçalho, e
     `Transfer-Encoding: chunked` nem o envia. Serve para recusar cedo o corpo
     grande e honesto, sem lê-lo; a medida que vale é a do texto já em mãos. */
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > LIMITE_DO_CORPO) return null;

  try {
    const texto = await request.text();
    if (texto.length > LIMITE_DO_CORPO) return null;

    const parsed: unknown = JSON.parse(texto);
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
