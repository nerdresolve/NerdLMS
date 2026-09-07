import {
  awardManuallyUseCase,
  createBadgeUseCase,
  listBadges,
  revokeAwardUseCase,
  toggleBadgeUseCase,
} from "@nerdlms/backend/badges/badge-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid, readJsonObject } from "@/lib/request-body.ts";

/**
 * GET    /api/badges — os badges do cliente, para a tela de configuração.
 * POST   /api/badges — cria um badge, ou emite um à mão (`acao: "emitir"`).
 * PATCH  /api/badges — liga/desliga.
 * DELETE /api/badges — revoga uma emissão pelo código.
 *
 * A VERIFICAÇÃO PÚBLICA não mora aqui: ela é `/badges/[codigo]`, sem sessão, e
 * os documentos Open Badges são `/api/badges/...` em rotas próprias. Misturar
 * as duas coisas na mesma rota faria a autenticação virar condicional — e uma
 * condicional errada aqui expõe o cliente inteiro.
 */

export const dynamic = "force-dynamic";

/** Um número do corpo, ou nulo. Não confia no que vem do navegador. */
function numeroOuNulo(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const resultado = await listBadges(actorOf(user));

  return resultado.status === 200
    ? Response.json({ badges: resultado.badges })
    : Response.json({ error: resultado.error }, { status: resultado.status });
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  /* Emissão manual: identificada pela ação, não por adivinhar o formato do
     corpo. Um `if (body.userId)` faria um campo a mais mudar o que a rota faz. */
  if (body.acao === "emitir") {
    if (!isUuid(body.badgeId) || !isUuid(body.userId)) {
      return Response.json({ error: "Badge ou pessoa inválidos." }, { status: 400 });
    }

    const resultado = await awardManuallyUseCase({
      actor: actorOf(user),
      actorName: user.fullName,
      badgeId: String(body.badgeId),
      userId: String(body.userId),
    });

    return resultado.status === 201
      ? Response.json({ code: resultado.code }, { status: 201 })
      : Response.json({ error: resultado.error }, { status: resultado.status });
  }

  const resultado = await createBadgeUseCase({
    actor: actorOf(user),
    actorName: user.fullName,
    name: String(body.name ?? ""),
    description: String(body.description ?? ""),
    icon: typeof body.icon === "string" && body.icon !== "" ? body.icon : "award",
    criterion: String(body.criterion ?? "manual"),
    courseId: isUuid(body.courseId) ? String(body.courseId) : null,
    trackId: isUuid(body.trackId) ? String(body.trackId) : null,
    threshold: numeroOuNulo(body.threshold),
    validityMonths: numeroOuNulo(body.validityMonths),
  });

  return resultado.status === 201
    ? Response.json({ id: resultado.id }, { status: 201 })
    : Response.json({ error: resultado.error }, { status: resultado.status });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.id)) {
    return Response.json({ error: "Badge inválido." }, { status: 400 });
  }

  const resultado = await toggleBadgeUseCase(
    actorOf(user),
    user.fullName,
    String(body.id),
    body.active === true,
  );

  return resultado.status === 200
    ? Response.json({ ok: true })
    : Response.json({ error: resultado.error }, { status: resultado.status });
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body || typeof body.code !== "string") {
    return Response.json({ error: "Código inválido." }, { status: 400 });
  }

  const resultado = await revokeAwardUseCase(
    actorOf(user),
    user.fullName,
    body.code,
    String(body.reason ?? ""),
  );

  return resultado.status === 200
    ? Response.json({ ok: true })
    : Response.json({ error: resultado.error }, { status: resultado.status });
}
