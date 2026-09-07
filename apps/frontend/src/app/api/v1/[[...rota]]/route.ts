import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { findAllUsers } from "@nerdlms/backend/courses/users-directory.ts";
import { courseProgress } from "@nerdlms/core/courses/progress.ts";

import { apiError, requireApiKey } from "@/lib/api-auth.ts";

/**
 * API pública v1 — F5-01.
 *
 * Uma rota que despacha por caminho, e não um arquivo por recurso. A razão é o
 * que toda requisição precisa fazer ANTES de qualquer coisa: autenticar a
 * chave, conferir o escopo, e amarrar a resposta ao tenant dela. Espalhar isso
 * por doze arquivos garantiria que um deles esquecesse — e o que se esquece
 * aqui devolve dado de outro cliente.
 *
 * A VERSÃO ESTÁ NO CAMINHO (`/api/v1/`), não num cabeçalho: quem integra
 * consegue ver a versão na URL de um log, e mudar de versão é trocar a URL, não
 * descobrir um cabeçalho.
 */

export const dynamic = "force-dynamic";

interface Rota {
  /** O recurso pedido, já sem a versão. */
  partes: string[];
}

function rotaDe(params: { rota?: string[] }): Rota {
  return { partes: params.rota ?? [] };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ rota?: string[] }> },
): Promise<Response> {
  const { partes } = rotaDe(await params);
  const [recurso, id] = partes;

  switch (recurso) {
    /* Um "quem sou eu" é o primeiro pedido de quem integra: confirma que a
       chave funciona antes de depurar o resto. */
    case undefined:
    case "": {
      return Response.json({
        api: "lms",
        version: "v1",
        resources: ["cursos", "usuarios", "matriculas"],
      });
    }

    case "cursos": {
      const auth = await requireApiKey(request, "cursos:ler");
      if (!auth.ok) return auth.response;

      /* O tenant vem da CHAVE, nunca do pedido: aceitar um `tenantId` no
         parâmetro deixaria qualquer chave ler o catálogo de qualquer cliente. */
      const cursos = await findAllCourses(auth.identity.tenantId);

      if (id) {
        const curso = cursos.find((c) => c.id === id || c.slug === id);
        if (!curso) return apiError(404, "not_found", "Curso não encontrado.");

        return Response.json({ data: serializarCurso(curso, true) });
      }

      return Response.json({
        data: cursos.map((c) => serializarCurso(c, false)),
        meta: { count: cursos.length },
      });
    }

    case "usuarios": {
      const auth = await requireApiKey(request, "usuarios:ler");
      if (!auth.ok) return auth.response;

      const pessoas = await findAllUsers(auth.identity.tenantId);

      return Response.json({
        data: pessoas.map((p) => ({
          id: p.id,
          nome: p.fullName,
          email: p.email ?? null,
          papel: p.role,
          situacao: p.status ?? "active",
          unidade: p.project ?? null,
        })),
        meta: { count: pessoas.length },
      });
    }

    case "matriculas": {
      const auth = await requireApiKey(request, "matriculas:ler");
      if (!auth.ok) return auth.response;

      const [cursos, matriculas] = await Promise.all([
        findAllCourses(auth.identity.tenantId),
        findEnrollments(),
      ]);

      /* `findEnrollments()` sem argumento traz TODAS as matrículas do banco —
         inclusive de outros clientes. O recorte vem daqui: só as de cursos
         deste tenant. Sem este filtro, a API vazaria entre clientes. */
      const doTenant = new Set(cursos.map((c) => c.id));

      const dados = matriculas
        .filter((m) => doTenant.has(m.courseId))
        .map((m) => {
          const curso = cursos.find((c) => c.id === m.courseId)!;
          const resumo = courseProgress(curso, m);

          return {
            cursoId: m.courseId,
            alunoId: m.learnerId,
            progresso: resumo.percent,
            situacao: resumo.status,
            aulasConcluidas: resumo.completed,
            aulasTotal: resumo.total,
          };
        });

      return Response.json({ data: dados, meta: { count: dados.length } });
    }

    default:
      return apiError(404, "unknown_resource", `Recurso "${recurso}" não existe na v1.`);
  }
}

/** O curso como a API o expõe. */
function serializarCurso(curso: Awaited<ReturnType<typeof findAllCourses>>[number], completo: boolean) {
  const base = {
    id: curso.id,
    slug: curso.slug,
    titulo: curso.title,
    resumo: curso.summary,
    situacao: curso.status,
    codigo: curso.code ?? null,
    cargaHorariaMinutos: curso.workloadMinutes ?? null,
    nivel: curso.level ?? null,
    categoria: curso.category?.name ?? null,
  };

  if (!completo) return base;

  /* A estrutura só sai no detalhe: mandá-la na LISTA multiplicaria a resposta
     por todas as aulas de todos os cursos, para um cliente que quase sempre só
     quer os títulos. */
  return {
    ...base,
    modulos: curso.modules.map((m) => ({
      id: m.id,
      titulo: m.title,
      aulas: m.lessons.map((l) => ({
        id: l.id,
        titulo: l.title,
        tipo: l.kind ?? "video",
        duracaoSegundos: l.durationSeconds,
      })),
    })),
  };
}
