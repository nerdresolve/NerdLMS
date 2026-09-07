import { exportUseCase, type ReportKind } from "@nerdlms/backend/reports/export-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";

/**
 * GET /api/relatorios?tipo=progresso|usuarios|notas|cursos
 *
 * Devolve CSV. O Excel abre CSV nativamente, então "exportação PDF/Excel" da
 * proposta é atendida sem biblioteca de planilha — e sem licença de terceiro,
 * que a seção 14 exclui do escopo.
 */

export const dynamic = "force-dynamic";

const KINDS: ReportKind[] = ["progresso", "usuarios", "notas", "cursos"];

function isKind(value: string | null): value is ReportKind {
  return value !== null && (KINDS as string[]).includes(value);
}

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const kind = new URL(request.url).searchParams.get("tipo");
  if (!isKind(kind)) {
    return Response.json({ error: "Relatório desconhecido." }, { status: 400 });
  }

  /* Filtros opcionais (TASK-047). Vêm da query porque o relatório é um link:
     precisa funcionar ao colar a URL, sem depender de JavaScript. Valor
     inválido é ignorado, não recusado — um relatório completo é resposta
     melhor que um erro para quem digitou o parâmetro errado. */
  const params = new URL(request.url).searchParams;
  const dias = Number(params.get("ativos"));
  const projeto = params.get("projeto");

  const filtros = {
    ...(Number.isFinite(dias) && dias > 0 ? { ativosEmDias: Math.floor(dias) } : {}),
    ...(projeto ? { projeto } : {}),
    ...(params.get("concluidos") === "1" ? { somenteConcluidos: true } : {}),
  };

  const outcome = await exportUseCase({
    ...(Object.keys(filtros).length > 0 ? { filtros } : {}),
    actor: actorOf(user),
    actorName: user.fullName,
    kind,
  });

  if (outcome.status !== 200) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return new Response(outcome.csv, {
    headers: {
      /* `text/csv; charset=utf-8` junto com o BOM: os dois dizem a mesma coisa,
         e o Excel só respeita o segundo. */
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${outcome.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
