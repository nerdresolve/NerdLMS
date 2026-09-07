import {
  applyCoursesImport,
  previewCoursesImport,
} from "@nerdlms/backend/imports/courses-import-use-case.ts";
import {
  applyQtiImport,
  applyQuestionsImport,
  previewQtiImport,
  previewQuestionsImport,
} from "@nerdlms/backend/imports/questions-import-use-case.ts";
import {
  applyUserImport,
  previewUserImport,
} from "@nerdlms/backend/imports/users-import-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * POST /api/importacao — confere ou aplica uma planilha (F5-05).
 *
 * `?tipo=usuarios|questoes|cursos|qti` diz o que importar; `?aplicar=1` grava. O
 * padrão é o que NÃO grava: se o parâmetro faltar por engano, o pior que
 * acontece é a pessoa ver o plano de novo.
 *
 * Uma rota para os três tipos, e não três rotas: o que muda entre eles é qual
 * caso de uso chamar — o limite de tamanho, a leitura do arquivo e o par
 * conferir/aplicar são idênticos, e duplicá-los faria as cópias divergirem na
 * primeira correção.
 */

export const dynamic = "force-dynamic";

/** 4 MB. Uma planilha de RH com dez mil linhas não passa de algumas centenas de KB. */
const LIMITE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");

  if (!(arquivo instanceof File)) {
    return Response.json({ error: "Envie o arquivo." }, { status: 400 });
  }

  if (arquivo.size === 0) {
    return Response.json({ error: "O arquivo está vazio." }, { status: 400 });
  }

  if (arquivo.size > LIMITE_BYTES) {
    return Response.json({ error: "Arquivo grande demais. O limite é 4 MB." }, { status: 413 });
  }

  const csv = await arquivo.text();
  const params = new URL(request.url).searchParams;
  const aplicar = params.get("aplicar") === "1";
  const tipo = params.get("tipo") ?? "usuarios";

  if (tipo === "questoes") {
    /* O curso vem do formulário e é conferido aqui: um valor que não é uuid
       não pode chegar à consulta. Ausente é banco geral do cliente. */
    const cursoBruto = form?.get("cursoId");
    const courseId = typeof cursoBruto === "string" && isUuid(cursoBruto) ? cursoBruto : null;

    const comando = { actor: actorOf(user), actorName: user.fullName, csv, courseId };

    const resultado = aplicar
      ? await applyQuestionsImport(comando)
      : await previewQuestionsImport(comando);

    if (resultado.status !== 200) {
      return Response.json({ error: resultado.error }, { status: resultado.status });
    }

    return Response.json("plano" in resultado ? resultado.plano : resultado.resultado);
  }

  if (tipo === "qti") {
    /* QTI (§30): outro formato de entrada, mesmo destino. A tela de
       conferência e a gravação são as da planilha — o que muda é só o leitor. */
    const cursoBruto = form?.get("cursoId");
    const courseId = typeof cursoBruto === "string" && isUuid(cursoBruto) ? cursoBruto : null;

    const comando = { actor: actorOf(user), actorName: user.fullName, csv, courseId };

    const resultado = aplicar ? await applyQtiImport(comando) : await previewQtiImport(comando);

    if (resultado.status !== 200) {
      return Response.json({ error: resultado.error }, { status: resultado.status });
    }

    return Response.json("plano" in resultado ? resultado.plano : resultado.resultado);
  }

  if (tipo === "cursos") {
    const comando = { actor: actorOf(user), actorName: user.fullName, csv };

    const resultado = aplicar
      ? await applyCoursesImport(comando)
      : await previewCoursesImport(comando);

    if (resultado.status !== 200) {
      return Response.json({ error: resultado.error }, { status: resultado.status });
    }

    return Response.json("plano" in resultado ? resultado.plano : resultado.resultado);
  }

  if (tipo !== "usuarios") {
    return Response.json({ error: `Não sei importar "${tipo}".` }, { status: 400 });
  }

  const comando = { actor: actorOf(user), actorName: user.fullName, csv };

  const resultado = aplicar
    ? await applyUserImport(comando)
    : await previewUserImport(comando);

  if (resultado.status !== 200) {
    return Response.json({ error: resultado.error }, { status: resultado.status });
  }

  return Response.json("plano" in resultado ? resultado.plano : resultado.resultado);
}
