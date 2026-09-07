import { publicarPacoteScorm } from "@nerdlms/backend/scorm/scorm-upload.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { findCourseOwnership } from "@nerdlms/backend/courses/course-editor-repository.ts";
import { findLessonCourse } from "@nerdlms/backend/courses/material-repository.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * POST /api/scorm/pacote — publica um pacote SCORM numa aula.
 *
 * ROTA SEPARADA de `/api/scorm`, que registra progresso. Não é organização: a
 * autorização é oposta. Ali, quem escreve é o ALUNO matriculado; aqui, só quem
 * edita o curso. Na mesma rota, a permissão viraria uma condicional sobre o
 * formato do corpo — e uma condicional errada ali deixaria um aluno republicar
 * o conteúdo da aula.
 *
 * O ARQUIVO PASSA PELO SERVIDOR, ao contrário dos outros uploads. Um `.zip`
 * precisa ser descompactado, e a URL assinada resolveria o envio sem resolver
 * o que vem depois. O limite abaixo é o que mantém essa exceção contida.
 */

export const dynamic = "force-dynamic";

/**
 * 60 MB de `.zip`.
 *
 * Um treinamento corporativo com narração e slides fica entre 20 e 40 MB. O
 * que passa disso costuma ser vídeo embutido no pacote — que deveria ser uma
 * aula de vídeo, servida pelo storage, e não um arquivo dentro do SCORM.
 *
 * O teto do DESCOMPRIMIDO é outro, e mora no leitor do ZIP: são defesas
 * diferentes, contra o arquivo grande e contra o arquivo que finge ser
 * pequeno.
 */
const LIMITE_BYTES = 60 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  const lessonId = form?.get("lessonId");

  if (typeof lessonId !== "string" || !isUuid(lessonId)) {
    return Response.json({ error: "Aula não informada." }, { status: 400 });
  }

  if (!(arquivo instanceof File)) {
    return Response.json({ error: "Envie o arquivo .zip do pacote." }, { status: 400 });
  }

  if (arquivo.size === 0) {
    return Response.json({ error: "O arquivo está vazio." }, { status: 400 });
  }

  if (arquivo.size > LIMITE_BYTES) {
    /* Antes de ler na memória: o ponto de um limite é não carregar o que não
       cabe. */
    return Response.json(
      { error: "Pacote grande demais. O limite é 60 MB." },
      { status: 413 },
    );
  }

  const courseId = await findLessonCourse(lessonId);
  if (!courseId) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  const curso = await findCourseOwnership(courseId);

  /* O tenant é conferido junto: sem isso, o id de uma aula de outro cliente
     passaria pela permissão de papel e publicaria lá. */
  if (!curso || curso.tenantId !== user.tenant.id) {
    return Response.json({ error: "Aula não encontrada." }, { status: 404 });
  }

  /* Quem publica é quem edita o curso — a mesma regra do editor, e a razão de
     esta rota não morar junto do registro de progresso. */
  const status = curso.status === "published" ? "published" : "draft";
  if (!can(actorOf(user), "update", { kind: "course", authorId: curso.authorId, status })) {
    return Response.json({ error: "Sem permissão para editar este curso." }, { status: 403 });
  }

  const zip = Buffer.from(await arquivo.arrayBuffer());
  const resultado = await publicarPacoteScorm({ tenantId: user.tenant.id, lessonId, zip });

  if (resultado.status !== 200) {
    return Response.json({ error: resultado.error }, { status: resultado.status });
  }

  return Response.json({
    ok: true,
    titulo: resultado.title,
    versao: resultado.version,
    arquivos: resultado.arquivos,
  });
}
