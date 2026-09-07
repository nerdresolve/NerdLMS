import { saveSignature } from "@nerdlms/backend/auth/users-repository.ts";
import { recordAudit } from "@nerdlms/backend/audit/audit-repository.ts";
import { pngParaPdf } from "@nerdlms/core/reports/png.ts";

import { currentUser } from "@/lib/auth/session.ts";
import { readJsonObject } from "@/lib/request-body.ts";

/**
 * POST /api/perfil/assinatura — envia a assinatura que vai no certificado.
 * DELETE /api/perfil/assinatura — remove a que está lá.
 *
 * O ARQUIVO PASSA POR AQUI, ao contrário de `/api/upload`, e a diferença é
 * deliberada. Aquela rota devolve uma URL assinada para o navegador mandar o
 * arquivo direto ao storage, porque um vídeo de duas horas atravessando o
 * processo do Next travaria a renderização para todo mundo. Uma assinatura tem
 * alguns quilobytes E PRECISA SER CONVERTIDA — o PDF não lê PNG, e a conversão
 * acontece no servidor. Mandá-la ao storage significaria buscá-la de volta para
 * converter.
 *
 * CADA PESSOA CUIDA DA PRÓPRIA, e só. Não há caminho para gravar a assinatura
 * de outro: `currentUser()` é a única origem do identificador, e ele não vem do
 * corpo da requisição. Assinatura que um terceiro pode gravar não é assinatura.
 */

export const dynamic = "force-dynamic";

/**
 * Teto do que se aceita receber.
 *
 * Um PNG de assinatura tem dezenas de quilobytes. Dois megabytes em base64
 * cobrem com folga um arquivo de scanner sem tratamento, e recusam o vídeo que
 * alguém tentaria mandar por engano — antes de decodificar, que é o que custa.
 */
const MAX_BASE64 = 2 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!body) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const png = typeof body.png === "string" ? body.png : "";
  if (!png) return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

  if (png.length > MAX_BASE64) {
    return Response.json(
      { error: "O arquivo é grande demais. Envie uma imagem de até 1,5 MB." },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(png, "base64");

  /* A conversão é onde o PNG é validado de verdade: cabeçalho, tipo de cor,
     entrelaçamento, dimensão. A mensagem que ela devolve é escrita para quem
     está na tela — "salve sem entrelaçamento", "salve em RGB" — e por isso vai
     inteira, ao contrário de erro de credencial. Aqui não há nada a proteger:
     o arquivo é da própria pessoa e ela precisa saber o que corrigir. */
  const convertida = pngParaPdf(bytes);
  if (!convertida.ok) {
    return Response.json({ error: convertida.erro }, { status: 400 });
  }

  await saveSignature(user.id, convertida.imagem);

  await recordAudit({
    actorId: user.id,
    actorName: user.fullName,
    action: "config_changed",
    target: "assinatura do certificado, enviada",
    outcome: "allowed",
  });

  return Response.json({
    ok: true,
    largura: convertida.imagem.width,
    altura: convertida.imagem.height,
  });
}

export async function DELETE(): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  await saveSignature(user.id, null);

  /* Remover a assinatura muda o que sai nos certificados dos cursos desta
     pessoa, inclusive nos já emitidos que forem baixados de novo. Fica
     registrado pelo mesmo motivo que o envio. */
  await recordAudit({
    actorId: user.id,
    actorName: user.fullName,
    action: "config_changed",
    target: "assinatura do certificado, removida",
    outcome: "allowed",
  });

  return Response.json({ ok: true });
}
