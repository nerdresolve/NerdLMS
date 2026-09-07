import "server-only";

import { notFound } from "next/navigation";

import { findTenantFeatures } from "@nerdlms/backend/tenancy/features-repository.ts";

import { currentUser } from "@/lib/auth/session.ts";

/**
 * Guarda de funcionalidade no SERVIDOR.
 *
 * Esconder o item do menu não basta: a URL continua digitável, e uma
 * funcionalidade "desligada" que responde 200 a quem sabe o endereço não está
 * desligada — está escondida. Quem decide é o servidor, como toda autorização
 *.
 *
 * Responde 404, não 403. O 403 confirma que a coisa existe e está fechada; o
 * 404 diz que não existe — que é a verdade para aquele cliente, e não revela o
 * que ele não contratou.
 */
export async function requireFeature(key: string): Promise<void> {
  const user = await currentUser();
  if (!user) notFound();

  const features = await findTenantFeatures(user.tenant.id);
  if (features.get(key) !== true) notFound();
}

/**
 * Igual, para rotas de API, que devolvem resposta em vez de renderizar.
 *
 * Devolve `null` quando pode seguir, ou a resposta 404 pronta — assim a rota
 * escreve `const bloqueio = await featureGate(...); if (bloqueio) return bloqueio;`
 * e não precisa repetir o corpo do erro.
 */
export async function featureGate(key: string): Promise<Response | null> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão exigida." }, { status: 401 });

  const features = await findTenantFeatures(user.tenant.id);
  if (features.get(key) !== true) {
    return Response.json({ error: "Não encontrado." }, { status: 404 });
  }

  return null;
}
