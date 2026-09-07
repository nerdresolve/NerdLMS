import { can } from "@nerdlms/core/auth/permissions.ts";
import { searchCourses } from "@nerdlms/core/courses/search.ts";
import { findAllCourses } from "@nerdlms/backend/courses/courses-repository.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { featureGate } from "@/lib/feature-guard.ts";

/**
 * GET /api/busca?q=<termo>
 *
 * A busca do topo. Devolve cursos e aulas que casam com o termo.
 *
 * O recorte de permissão é feito aqui, antes de procurar: só entram os cursos
 * que esta pessoa poderia abrir. Buscar primeiro e filtrar depois vazaria a
 * existência de rascunho pelo número de resultados.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const bloqueio = await featureGate("busca");
  if (bloqueio) return bloqueio;

  const term = new URL(request.url).searchParams.get("q") ?? "";
  if (term.trim().length < 2) {
    /* Uma letra casa com quase tudo e a lista vira ruído. */
    return Response.json({ hits: [] });
  }

  const actor = actorOf(user);
  const courses = await findAllCourses(user.tenant.id);
  const visible = courses.filter((course) =>
    can(actor, "read", { kind: "course", authorId: course.authorId, status: course.status }),
  );

  return Response.json({ hits: searchCourses(visible, term) });
}
