import { hasScope } from "@nerdlms/core/api/keys.ts";
import { authenticateApiKey, type ApiKeyIdentity } from "@nerdlms/backend/api/api-key-repository.ts";

/**
 * Autenticação da API pública — F5-01.
 *
 * Separada da sessão do navegador de propósito: são dois mundos com regras
 * diferentes. A sessão tem cookie, CSRF e um usuário com papel; a chave tem
 * escopos e pertence a um sistema, não a uma pessoa.
 */

export interface ApiAuthOk {
  ok: true;
  identity: ApiKeyIdentity;
}

export interface ApiAuthFail {
  ok: false;
  response: Response;
}

/** Erro no formato que a API usa em toda resposta. */
export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Autentica e confere o escopo.
 *
 * O cabeçalho é `Authorization: Bearer aeg_...`, que é o que qualquer cliente
 * HTTP já sabe mandar — um cabeçalho próprio obrigaria configuração extra em
 * toda ferramenta de integração.
 */
export async function requireApiKey(
  request: Request,
  escopo: string,
): Promise<ApiAuthOk | ApiAuthFail> {
  const header = request.headers.get("authorization") ?? "";
  const chave = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (chave === "") {
    return {
      ok: false,
      response: apiError(401, "missing_key", "Informe a chave em Authorization: Bearer."),
    };
  }

  const identity = await authenticateApiKey(chave);

  if (!identity) {
    /* Chave inválida, desconhecida e revogada dão a MESMA resposta: distinguir
       diria a quem tenta se a chave existe. */
    return { ok: false, response: apiError(401, "invalid_key", "Chave inválida ou revogada.") };
  }

  if (!hasScope(identity.scopes, escopo)) {
    /* 403 e não 404: a chave é válida, e dizer que o recurso não existe
       confundiria quem está integrando de boa-fé. O escopo que falta vai na
       mensagem, porque é acionável. */
    return {
      ok: false,
      response: apiError(403, "missing_scope", `Esta chave não tem o escopo ${escopo}.`),
    };
  }

  return { ok: true, identity };
}
