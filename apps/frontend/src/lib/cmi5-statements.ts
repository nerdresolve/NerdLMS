import "server-only";

import { randomUUID } from "node:crypto";

import { SEQUENCE_MESSAGE, verbFromIri } from "@nerdlms/core/cmi5/cmi5.ts";
import { VALIDATION_MESSAGE, validateStatement } from "@nerdlms/core/xapi/statement.ts";
import { registrarVerbo, sessionByToken } from "@nerdlms/backend/cmi5/cmi5-repository.ts";
import { resolveActor, storeStatement } from "@nerdlms/backend/xapi/lrs-repository.ts";
import { setManualCompletion } from "@nerdlms/backend/courses/progress-repository.ts";

/**
 * Statements que vêm de um conteúdo cmi5.
 *
 * Separado da rota porque o caminho é outro: a chave de API fala pelo cliente
 * inteiro; o token de sessão fala por UMA tentativa de UMA unidade. Misturar os
 * dois no mesmo corpo de função faria a autorização virar uma sequência de
 * condicionais — e uma condicional errada ali dá acesso ao cliente inteiro.
 */

export interface SessaoCmi5 {
  token: string;
  tenantId: string;
  userId: string;
  lessonId: string;
  courseId: string;
  enrollmentId: string | null;
}

/** O token de sessão vem no mesmo cabeçalho, e o formato distingue os dois. */
export async function autenticarCmi5(request: Request): Promise<SessaoCmi5 | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const sessao = await sessionByToken(token);
  if (!sessao) return null;

  return {
    token,
    tenantId: sessao.tenantId,
    userId: sessao.userId,
    lessonId: sessao.lessonId,
    courseId: sessao.courseId,
    enrollmentId: sessao.enrollmentId,
  };
}

/**
 * Registra o statement de um conteúdo cmi5.
 *
 * Duas coisas acontecem, e a ordem importa: o statement entra no LRS como
 * qualquer outro, E o verbo é validado contra a sequência da sessão. A
 * validação vem PRIMEIRO — gravar e depois descobrir que o verbo era inválido
 * deixaria o LRS com um registro que a sessão não reconhece.
 */
export async function registrarDoCmi5(
  request: Request,
  sessao: SessaoCmi5,
): Promise<Response> {
  const corpo = await request.json().catch(() => null);
  if (corpo === null) {
    return Response.json({ error: "O corpo não é um JSON válido." }, { status: 400 });
  }

  /* Um statement por requisição no caminho cmi5, não lote: um AU relata um
     evento de cada vez, e a validação de sequência é sobre UM verbo. Aceitar
     lote exigiria decidir o que fazer quando o terceiro é inválido depois de
     os dois primeiros terem mudado a sessão. */
  const lote = Array.isArray(corpo) ? corpo : [corpo];
  if (lote.length !== 1) {
    return Response.json(
      { error: "Envie um statement por vez nesta sessão." },
      { status: 400 },
    );
  }

  const bruto = lote[0];
  const conferido = validateStatement(bruto);

  if (!conferido.ok) {
    return Response.json(
      { error: VALIDATION_MESSAGE[conferido.error] },
      { status: 400 },
    );
  }

  const verbo = verbFromIri(conferido.statement.verbId);
  if (!verbo) {
    /* Verbo fora dos nove: cmi5 fixa a lista justamente para que a plataforma
       possa comparar conteúdos diferentes. Aceitar um verbo livre aqui devolve
       o problema que o cmi5 existe para resolver. */
    return Response.json(
      { error: "Este verbo não faz parte do cmi5." },
      { status: 400 },
    );
  }

  const registro = await registrarVerbo(sessao.token, verbo, (erro) =>
    SEQUENCE_MESSAGE[erro as keyof typeof SEQUENCE_MESSAGE],
  );

  if (!registro.ok) return Response.json({ error: registro.erro }, { status: 409 });

  const actorId = await resolveActor(sessao.tenantId, conferido.statement.actorEmail);

  /* O id é gerado AQUI e guardado, porque a resposta tem de devolvê-lo: o
     padrão xAPI define que o LRS responde com os ids atribuídos, e é assim que
     o cliente sabe o que reenviar depois de uma queda. Gerar dentro da chamada
     e ler o original na resposta devolvia `[null]` — o que foi encontrado
     testando contra o servidor, não no código. */
  const statementId = conferido.statement.id ?? randomUUID();

  await storeStatement({
    tenantId: sessao.tenantId,
    statement: { ...conferido.statement, id: statementId },
    raw: bruto,
    actorId,
    courseId: sessao.courseId,
    lessonId: sessao.lessonId,
    /* Nulo: quem enviou foi o conteúdo, pela sessão — não um sistema com
       chave de API. A distinção importa na auditoria do LRS. */
    apiKeyId: null,
  });

  /* O `moveOn` foi satisfeito: a aula conta como feita. É aqui que a camada
     cmi5 encosta no progresso do curso — e é o único ponto onde ela o faz, o
     que mantém a decisão de conclusão num lugar só. */
  if (registro.satisfied && sessao.enrollmentId) {
    await setManualCompletion(sessao.enrollmentId, sessao.lessonId, true, sessao.userId);
  }

  return new Response(JSON.stringify([statementId]), {
    status: 200,
    headers: { "content-type": "application/json", "x-experience-api-version": "1.0.3" },
  });
}
