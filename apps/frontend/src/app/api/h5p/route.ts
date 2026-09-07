import { can } from "@nerdlms/core/auth/permissions.ts";
import { importarH5p } from "@nerdlms/core/h5p/h5p-import.ts";
import { readZip } from "@nerdlms/core/scorm/zip.ts";
import { findCourseOwnership } from "@nerdlms/backend/courses/course-editor-repository.ts";
import { findLessonCourse } from "@nerdlms/backend/courses/material-repository.ts";
import { saveInteractive } from "@nerdlms/backend/interactive/interactive-repository.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * POST /api/h5p — importa um pacote `.h5p` como conteúdo interativo.
 *
 * O QUE VEM E O QUE NÃO VEM
 *
 * Vem o conteúdo: perguntas, alternativas, gabarito, o instante de cada
 * pergunta no vídeo, a posição de cada ponto na imagem. Não vem o código de
 * renderização do H5P, que é GPL — o conteúdo passa a rodar no player próprio.
 *
 * A mídia também não vem. O pacote referencia um arquivo interno ou um link do
 * YouTube, e nenhum dos dois é a mídia da plataforma: quem importa aponta o
 * vídeo ou a imagem depois. As perguntas chegam posicionadas, que é o trabalho
 * que ninguém quer refazer à mão.
 *
 * O `.zip` passa pelo servidor pela mesma razão do SCORM: precisa ser aberto.
 */

export const dynamic = "force-dynamic";

/** 30 MB. Um `.h5p` sem mídia embutida raramente passa de alguns megabytes. */
const LIMITE_BYTES = 30 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  const lessonId = form?.get("lessonId");

  /* A mídia é pedida JUNTO, e não depois.

     O pacote H5P referencia um arquivo interno ou um link do YouTube, e nenhum
     dos dois é a mídia da plataforma. O banco exige mídia para vídeo e imagem
     — com razão: uma aula de vídeo interativo sem vídeo é uma tela vazia com
     perguntas soltas.

     Pedir aqui é melhor que importar pela metade e deixar a aula quebrada até
     alguém lembrar de completá-la. */
  const mediaUrl = typeof form?.get("mediaUrl") === "string"
    ? String(form.get("mediaUrl")).trim()
    : "";

  if (typeof lessonId !== "string" || !isUuid(lessonId)) {
    return Response.json({ error: "Aula não informada." }, { status: 400 });
  }

  if (!(arquivo instanceof File)) {
    return Response.json({ error: "Envie o arquivo .h5p." }, { status: 400 });
  }

  if (arquivo.size === 0) {
    return Response.json({ error: "O arquivo está vazio." }, { status: 400 });
  }

  if (arquivo.size > LIMITE_BYTES) {
    return Response.json({ error: "Pacote grande demais. O limite é 30 MB." }, { status: 413 });
  }

  const courseId = await findLessonCourse(lessonId);
  if (!courseId) return Response.json({ error: "Aula não encontrada." }, { status: 404 });

  const curso = await findCourseOwnership(courseId);

  /* O tenant é conferido junto: sem isso, o id de uma aula de outro cliente
     passaria pela permissão de papel e importaria lá. */
  if (!curso || curso.tenantId !== user.tenant.id) {
    return Response.json({ error: "Aula não encontrada." }, { status: 404 });
  }

  const status = curso.status === "published" ? "published" : "draft";
  if (!can(actorOf(user), "update", { kind: "course", authorId: curso.authorId, status })) {
    return Response.json({ error: "Sem permissão para editar este curso." }, { status: 403 });
  }

  /* O mesmo leitor do SCORM: um `.h5p` é um ZIP, e as defesas contra zip slip
     e zip bomb valem igual. */
  const lido = readZip(Buffer.from(await arquivo.arrayBuffer()));
  if (!lido.ok) return Response.json({ error: lido.error }, { status: 400 });

  const manifesto = lido.entries.find((e) => e.path === "h5p.json");
  const conteudo = lido.entries.find((e) => e.path === "content/content.json");

  if (!manifesto || !conteudo) {
    return Response.json(
      { error: "O arquivo não parece um pacote H5P: faltam h5p.json ou content/content.json." },
      { status: 400 },
    );
  }

  const importado = importarH5p(
    manifesto.data.toString("utf8"),
    conteudo.data.toString("utf8"),
  );

  if (!importado.ok) return Response.json({ error: importado.error }, { status: 400 });

  /* Cartões não precisam de mídia; os outros dois, sim. A conferência é depois
     de saber o tipo — que só o pacote diz. */
  if (importado.conteudo.kind !== "flashcards" && !mediaUrl) {
    return Response.json(
      {
        error:
          importado.conteudo.kind === "interactive_video"
            ? "Informe o endereço do vídeo: o pacote H5P traz as perguntas, não a mídia."
            : "Informe o endereço da imagem: o pacote H5P traz os pontos, não a mídia.",
        precisaDeMidia: importado.conteudo.kind,
        titulo: importado.conteudo.title,
        itens: importado.conteudo.items.length,
      },
      { status: 400 },
    );
  }

  await saveInteractive({
    tenantId: user.tenant.id,
    lessonId,
    kind: importado.conteudo.kind,
    title: importado.conteudo.title,
    mediaUrl: mediaUrl || null,
    requiredInteractions: null,
    items: importado.conteudo.items.map((item) => ({
      ...item,
      /* `feedback` é OPCIONAL no destino, não nulo: passar `null` onde o tipo
         espera ausência gravaria a palavra "null" onde deveria não haver
         campo. */
      options: item.options.map((o) => ({
        text: o.text,
        correct: o.correct,
        ...(o.feedback ? { feedback: o.feedback } : {}),
      })),
    })),
  });

  return Response.json({
    ok: true,
    tipo: importado.conteudo.kind,
    titulo: importado.conteudo.title,
    itens: importado.conteudo.items.length,
    /* Os avisos VÃO para a tela: dizem o que não atravessou, e quem importou
       precisa saber antes de dar a aula por pronta. */
    avisos: importado.conteudo.avisos,
  });
}
