import { questoesParaQti } from "@nerdlms/core/imports/qti-export.ts";
import { findQuestions } from "@nerdlms/backend/assessment/question-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * GET /api/questoes/qti?curso=<uuid> — exporta o banco de questões em QTI 2.1.
 *
 * A contrapartida da importação (§30): quem sai desta plataforma leva as
 * questões num formato que outro LMS lê. É o que impede o produto de virar uma
 * armadilha.
 *
 * Instrutor e admin, a mesma regra de quem importa: questão é conteúdo de
 * curso. E o recorte por cliente vem do `findQuestions`, que exige o tenant —
 * um banco de questões é conteúdo proprietário, e vazá-lo entre clientes seria
 * dos piores vazamentos possíveis.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  if (user.role !== "admin" && user.role !== "instructor") {
    return Response.json({ error: "Sem permissão para exportar questões." }, { status: 403 });
  }

  const curso = new URL(request.url).searchParams.get("curso");
  const filtro = curso && isUuid(curso) ? { courseId: curso } : {};

  const questoes = await findQuestions(user.tenant.id, filtro);

  const { xml, exportadas, omitidas } = questoesParaQti(
    questoes.map((q) => ({
      id: q.id,
      kind: q.kind,
      prompt: q.prompt,
      points: q.points,
      explanation: q.explanation ?? null,
      alternativas: q.options.map((o) => ({ texto: o.text, correta: o.isCorrect })),
    })),
  );

  if (exportadas === 0) {
    return Response.json(
      { error: "Nenhuma questão deste banco tem representação em QTI." },
      { status: 404 },
    );
  }

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="questoes-qti.xml"`,
      /* Quantas ficaram de fora, num cabeçalho: o corpo é XML e tem de
         continuar válido para o LMS de destino, mas quem exporta precisa saber
         que o arquivo não traz tudo. A tela lê este número. */
      "x-questoes-omitidas": String(omitidas),
      "cache-control": "no-store",
    },
  });
}
