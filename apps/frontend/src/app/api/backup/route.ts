import {
  conferirBackup,
  gerarBackup,
  restaurarBackup,
  tamanhoDoBackup,
} from "@nerdlms/backend/backup/backup-use-case.ts";

import { actorOf, currentUser } from "@/lib/auth/session.ts";
import { isUuid } from "@/lib/request-body.ts";

/**
 * GET  /api/backup            — baixa o backup do cliente.
 * GET  /api/backup?curso=<id> — baixa o backup de um curso.
 * GET  /api/backup?tamanho=1  — só as contagens, para a tela avisar antes.
 * POST /api/backup            — confere um arquivo; `?restaurar=1` aplica.
 *
 * Como nas importações, o padrão do POST é o que NÃO escreve.
 */

export const dynamic = "force-dynamic";

/** 64 MB. Um backup de cliente com anos de auditoria passa de 10 MB fácil. */
const LIMITE_BYTES = 64 * 1024 * 1024;

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const actor = actorOf(user);

  if (params.get("tamanho") === "1") {
    const resultado = await tamanhoDoBackup(actor);

    return resultado.status === 200
      ? Response.json(resultado.contagens)
      : Response.json({ error: resultado.error }, { status: resultado.status });
  }

  const cursoBruto = params.get("curso");
  const courseId = cursoBruto && isUuid(cursoBruto) ? cursoBruto : null;

  const resultado = await gerarBackup({
    actor,
    actorName: user.fullName,
    courseId,
  });

  if (resultado.status !== 200) {
    return Response.json({ error: resultado.error }, { status: resultado.status });
  }

  /* Baixa como arquivo, não como resposta de API: o backup existe para ser
     guardado fora daqui. `Content-Disposition` é o que faz o navegador salvar
     em vez de exibir um JSON de megabytes na tela. */
  return new Response(JSON.stringify(resultado.arquivo, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${resultado.nomeDoArquivo}"`,
      /* Um backup nunca deve ficar em cache: é dado do cliente inteiro. */
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");

  if (!(arquivo instanceof File)) {
    return Response.json({ error: "Envie o arquivo de backup." }, { status: 400 });
  }

  if (arquivo.size === 0) {
    return Response.json({ error: "O arquivo está vazio." }, { status: 400 });
  }

  if (arquivo.size > LIMITE_BYTES) {
    return Response.json({ error: "Arquivo grande demais. O limite é 64 MB." }, { status: 413 });
  }

  const comando = {
    actor: actorOf(user),
    actorName: user.fullName,
    conteudo: await arquivo.text(),
  };

  const restaurar = new URL(request.url).searchParams.get("restaurar") === "1";

  const resultado = restaurar
    ? await restaurarBackup(comando)
    : await conferirBackup(comando);

  if (resultado.status !== 200) {
    return Response.json({ error: resultado.error }, { status: resultado.status });
  }

  return Response.json("resultado" in resultado ? resultado.resultado : resultado);
}
