import { esvaziarFilaDeCortes } from "@nerdlms/backend/media/video-split-use-case.ts";

import { currentUser } from "@/lib/auth/session.ts";

/**
 * POST /api/cortes — processa a fila de cortes de vídeo.
 *
 * O caminho normal é a própria rota que registra a aula disparar o
 * processamento depois de responder. Esta rota existe para o que aquele
 * caminho não cobre: um corte interrompido por um reinício fica pendente até
 * alguém enviar outro vídeo, e "até alguém enviar outro vídeo" não é uma
 * garantia — é uma coincidência.
 *
 * Serve a um administrador que queira destravar a fila, e a um agendador que
 * chame de tempos em tempos. RESPONDE SÓ QUANDO TERMINA, porque quem chama
 * quer saber o que foi feito.
 */

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  if (user.role !== "admin") {
    return Response.json({ error: "Só a administração processa a fila." }, { status: 403 });
  }

  const feitos = await esvaziarFilaDeCortes();

  return Response.json({ processados: feitos });
}
