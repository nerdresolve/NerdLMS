import {
  assignPlanUseCase,
  attestUseCase,
  createCompetencyUseCase,
  createFrameworkUseCase,
  createPlanUseCase,
  linkCourseUseCase,
  listCatalog,
  revokeEvidenceUseCase,
  userReport,
} from "@nerdlms/backend/competencies/competency-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * GET    /api/competencias            — o catálogo (frameworks, competências, planos).
 * GET    /api/competencias?pessoa=id  — o painel de uma pessoa, com os gaps.
 * POST   /api/competencias            — cria framework, competência, plano; atesta; vincula.
 * DELETE /api/competencias            — revoga uma evidência.
 *
 * O POST despacha por `acao` e não por adivinhar o formato do corpo: um campo
 * a mais não pode mudar o que a rota faz.
 */

export const dynamic = "force-dynamic";

function numeroOuNulo(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const pessoa = new URL(request.url).searchParams.get("pessoa");

  if (pessoa) {
    if (!isUuid(pessoa)) return Response.json({ error: "Pessoa inválida." }, { status: 400 });

    const resultado = await userReport(actorOf(user), pessoa);

    return resultado.status === 200
      ? Response.json(resultado.report)
      : Response.json({ error: resultado.error }, { status: resultado.status });
  }

  const resultado = await listCatalog(actorOf(user));

  return resultado.status === 200
    ? Response.json(resultado.catalog)
    : Response.json({ error: resultado.error }, { status: resultado.status });
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const actor = actorOf(user);
  const acao = String(body.acao ?? "");

  switch (acao) {
    case "framework": {
      const resultado = await createFrameworkUseCase({
        actor,
        actorName: user.fullName,
        name: String(body.name ?? ""),
        description: typeof body.description === "string" ? body.description : null,
        levels: Array.isArray(body.levels)
          ? body.levels.filter((n): n is string => typeof n === "string")
          : [],
      });

      return resultado.status === 201
        ? Response.json({ id: resultado.id }, { status: 201 })
        : Response.json({ error: resultado.error }, { status: resultado.status });
    }

    case "competencia": {
      if (!isUuid(body.frameworkId)) {
        return Response.json({ error: "Framework inválido." }, { status: 400 });
      }

      const resultado = await createCompetencyUseCase({
        actor,
        actorName: user.fullName,
        frameworkId: String(body.frameworkId),
        parentId: isUuid(body.parentId) ? String(body.parentId) : null,
        code: typeof body.code === "string" && body.code !== "" ? body.code : null,
        name: String(body.name ?? ""),
        description: typeof body.description === "string" ? body.description : null,
        learningOutcome:
          typeof body.learningOutcome === "string" && body.learningOutcome !== ""
            ? body.learningOutcome
            : null,
      });

      return resultado.status === 201
        ? Response.json({ id: resultado.id }, { status: 201 })
        : Response.json({ error: resultado.error }, { status: resultado.status });
    }

    case "vincular":
    case "desvincular": {
      if (!isUuid(body.competencyId) || !isUuid(body.courseId)) {
        return Response.json({ error: "Competência ou curso inválidos." }, { status: 400 });
      }

      const resultado = await linkCourseUseCase(
        actor,
        user.fullName,
        String(body.competencyId),
        String(body.courseId),
        numeroOuNulo(body.grantsLevel) ?? 1,
        acao === "vincular",
      );

      return resultado.status === 200
        ? Response.json({ ok: true })
        : Response.json({ error: resultado.error }, { status: resultado.status });
    }

    case "atestar": {
      if (!isUuid(body.competencyId) || !isUuid(body.userId)) {
        return Response.json({ error: "Competência ou pessoa inválidas." }, { status: 400 });
      }

      const resultado = await attestUseCase({
        actor,
        actorName: user.fullName,
        competencyId: String(body.competencyId),
        userId: String(body.userId),
        level: numeroOuNulo(body.level) ?? 0,
        note: String(body.note ?? ""),
        validityMonths: numeroOuNulo(body.validityMonths),
        external: body.external === true,
      });

      return resultado.status === 201
        ? Response.json({ id: resultado.id }, { status: 201 })
        : Response.json({ error: resultado.error }, { status: resultado.status });
    }

    case "plano": {
      const itens = Array.isArray(body.items)
        ? body.items
            .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
            .filter((i) => isUuid(i.competencyId))
            .map((i) => ({
              competencyId: String(i.competencyId),
              requiredLevel: numeroOuNulo(i.requiredLevel) ?? 1,
            }))
        : [];

      const resultado = await createPlanUseCase({
        actor,
        actorName: user.fullName,
        name: String(body.name ?? ""),
        description: typeof body.description === "string" ? body.description : null,
        /* Só data ISO simples: qualquer outra coisa vira nulo em vez de chegar
           ao banco como texto que o `date` recusaria. */
        dueDate:
          typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
            ? body.dueDate
            : null,
        items: itens,
      });

      return resultado.status === 201
        ? Response.json({ id: resultado.id }, { status: 201 })
        : Response.json({ error: resultado.error }, { status: resultado.status });
    }

    case "atribuir": {
      if (!isUuid(body.planId)) {
        return Response.json({ error: "Plano inválido." }, { status: 400 });
      }

      const pessoas = Array.isArray(body.userIds)
        ? body.userIds.filter((id): id is string => isUuid(id))
        : [];

      const resultado = await assignPlanUseCase(
        actor,
        user.fullName,
        String(body.planId),
        pessoas,
      );

      return resultado.status === 200
        ? Response.json({ atribuidos: resultado.atribuidos })
        : Response.json({ error: resultado.error }, { status: resultado.status });
    }

    default:
      return Response.json({ error: `Ação "${acao}" não existe.` }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.evidenceId)) {
    return Response.json({ error: "Evidência inválida." }, { status: 400 });
  }

  const resultado = await revokeEvidenceUseCase(
    actorOf(user),
    user.fullName,
    String(body.evidenceId),
    String(body.reason ?? ""),
  );

  return resultado.status === 200
    ? Response.json({ ok: true })
    : Response.json({ error: resultado.error }, { status: resultado.status });
}
