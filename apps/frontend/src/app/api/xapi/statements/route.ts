import { randomUUID } from "node:crypto";

import {
  findStatementById,
  findStatements,
  resolveActor,
  storeStatement,
  voidStatement,
} from "@nerdlms/backend/xapi/lrs-repository.ts";
import {
  VALIDATION_MESSAGE,
  VERBS,
  validateStatement,
} from "@nerdlms/core/xapi/statement.ts";

import { apiError, requireApiKey } from "@/lib/api-auth.ts";
import { autenticarCmi5, registrarDoCmi5 } from "@/lib/cmi5-statements.ts";

/**
 * LRS — `POST` e `GET /api/xapi/statements` (F6-03, guia §26).
 *
 * É a interface que o padrão define, e é por ela que um simulador, um app de
 * campo ou outro LMS conversam com este produto.
 *
 * AUTENTICA POR CHAVE DE API, não por sessão: quem envia é um SISTEMA, não uma
 * pessoa num navegador. É o mesmo mecanismo do `/api/v1`, e o tenant vem da
 * chave — nunca do corpo, que é o que impediria um sistema de gravar statement
 * no cliente de outro.
 *
 * O escopo é `matriculas:escrever`: um statement afirma o que alguém aprendeu,
 * e isso pesa como progresso.
 */

export const dynamic = "force-dynamic";

/** O padrão exige que o LRS declare a versão em toda resposta. */
const XAPI_HEADERS = { "x-experience-api-version": "1.0.3" };

/** Teto de statements por requisição, para um lote não derrubar o processo. */
const MAX_LOTE = 200;

export async function POST(request: Request): Promise<Response> {
  /* DUAS FORMAS DE AUTENTICAR, e o cmi5 explica por quê.
     Um sistema integrado usa chave de API e fala pelo cliente inteiro. Um
     conteúdo cmi5 usa o token da SESSÃO dele: pode relatar uma tentativa, de
     uma pessoa, numa unidade — e nada além. Dar chave de API a conteúdo de
     terceiro seria dar acesso ao cliente inteiro para quem precisa de uma
     aula. */
  const sessaoCmi5 = await autenticarCmi5(request);

  if (sessaoCmi5) return registrarDoCmi5(request, sessaoCmi5);

  const auth = await requireApiKey(request, "matriculas:escrever");
  if (!auth.ok) return auth.response;

  const corpo = await request.json().catch(() => null);
  if (corpo === null) return apiError(400, "invalid_json", "O corpo não é um JSON válido.");

  /* O padrão aceita um statement OU um array deles. Um app offline manda o
     lote inteiro ao reconectar, e exigir uma requisição por statement faria
     essa sincronização custar centenas de idas. */
  const lote = Array.isArray(corpo) ? corpo : [corpo];

  if (lote.length === 0) {
    return apiError(400, "empty_batch", "Nenhum statement no corpo.");
  }

  if (lote.length > MAX_LOTE) {
    return apiError(
      413,
      "batch_too_large",
      `Máximo de ${MAX_LOTE} statements por requisição.`,
    );
  }

  const ids: string[] = [];

  for (const [indice, bruto] of lote.entries()) {
    const conferido = validateStatement(bruto);

    if (!conferido.ok) {
      /* Recusa o LOTE INTEIRO, não só o statement ruim.

         O padrão define assim, e a razão é prática: quem envia um lote precisa
         saber se ele entrou ou não. Aceitar metade deixaria o cliente sem como
         descobrir qual metade — e reenviar duplicaria o que já entrou. */
      return apiError(
        400,
        "invalid_statement",
        `Statement ${indice + 1} de ${lote.length}: ${VALIDATION_MESSAGE[conferido.error]}`,
      );
    }

    const actorId = await resolveActor(auth.identity.tenantId, conferido.statement.actorEmail);

    const resultado = await storeStatement({
      tenantId: auth.identity.tenantId,
      statement: { ...conferido.statement, id: conferido.statement.id ?? randomUUID() },
      raw: bruto,
      actorId,
      /* Contexto da plataforma: um statement de fora normalmente não tem, e
         está certo — é o "aprendizagem fora da LMS" do §26. */
      courseId: null,
      lessonId: null,
      apiKeyId: auth.identity.id,
    });

    ids.push(resultado.id);

    /* Anulação: um statement com o verbo `voided` marca outro.
       É o mecanismo que o padrão define no lugar de apagar. */
    if (conferido.statement.verbId === VERBS.voided.id) {
      const alvo = conferido.statement.objectId.split("/").pop();
      if (alvo) await voidStatement(auth.identity.tenantId, alvo, resultado.id);
    }
  }

  /* 200 com os ids, como o padrão define para POST de statements. */
  return Response.json(ids, { status: 200, headers: XAPI_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireApiKey(request, "matriculas:ler");
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;

  /* Um statement específico. */
  const statementId = params.get("statementId");
  if (statementId) {
    const encontrado = await findStatementById(auth.identity.tenantId, statementId);

    if (!encontrado) {
      return apiError(404, "not_found", "Statement não encontrado.");
    }

    return Response.json(encontrado.raw, { headers: XAPI_HEADERS });
  }

  const limite = Number(params.get("limit") ?? 50);

  const statements = await findStatements({
    tenantId: auth.identity.tenantId,
    /* `agent` no padrão vem como JSON com `mbox`; aceitamos o e-mail direto
       porque é o que a maioria dos clientes manda, e o JSON também. */
    actorEmail: emailDoParametro(params.get("agent")),
    verbId: params.get("verb"),
    objectId: params.get("activity"),
    since: params.get("since"),
    until: params.get("until"),
    limit: Number.isFinite(limite) && limite > 0 ? Math.min(limite, 500) : 50,
  });

  /* A resposta do padrão é `{ statements: [...], more: "" }`. O `more` vazio
     significa "não há mais páginas" — omiti-lo faria um cliente estrito
     considerar a resposta malformada. */
  return Response.json(
    { statements: statements.map((s) => s.raw), more: "" },
    { headers: XAPI_HEADERS },
  );
}

/** O e-mail de um parâmetro `agent`, que pode vir cru ou como JSON. */
function emailDoParametro(valor: string | null): string | null {
  if (!valor) return null;

  if (valor.startsWith("{")) {
    try {
      const agente = JSON.parse(valor) as { mbox?: string };
      return agente.mbox?.replace(/^mailto:/i, "").toLowerCase() ?? null;
    } catch {
      return null;
    }
  }

  return valor.replace(/^mailto:/i, "").toLowerCase();
}
