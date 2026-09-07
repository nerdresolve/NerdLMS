import "server-only";

import { cookies } from "next/headers";

import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import type { SessionUser } from "@nerdlms/core/auth/login.ts";
import type { User } from "@nerdlms/core/courses/types.ts";

import { findSessionUser } from "@nerdlms/backend/auth/sessions-repository.ts";
import { findTenantBySlug } from "@nerdlms/backend/tenancy/tenants-repository.ts";
import { findTenantFeatures } from "@nerdlms/backend/tenancy/features-repository.ts";
import { admin, instructors, manager, student } from "@/mocks/repository.ts";
import { uuidForMockId } from "@/mocks/seed-ids.ts";
import { SESSION_COOKIE } from "@/lib/session-cookie.ts";

/**
 * Usuário da requisição.
 *
 * Lê o cookie de sessão e carrega o usuário do banco. Quando não há sessão
 * válida, devolve `null` — e é quem chama que decide se redireciona para o
 * login ou responde 404.
 *
 * Em desenvolvimento, `NERD_DEV_ROLE` continua permitindo simular um papel
 * sem passar pelo login, para exercitar as telas. A variável é ignorada em
 * produção: lá, papel vem de sessão autenticada e de mais nada.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    const user = await findSessionUser(token);
    if (user) return user;
  }

  if (process.env.NODE_ENV !== "production" && process.env.NERD_DEV_ROLE) {
    return devUser(process.env.NERD_DEV_ROLE);
  }

  return null;
}

/**
 * Igual a `currentUser`, mas falha em vez de devolver `null`.
 *
 * Serve às camadas de dados que só existem para quem está autenticado: em vez
 * de cada uma repetir o mesmo `if (!user) throw`, elas pedem por aqui.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("Sessão exigida: nenhuma sessão válida nesta requisição.");
  return user;
}

/**
 * Recorte do usuário que a checagem de permissão precisa.
 *
 * `tenantId` entra sempre: é a fronteira externa, e um ator sem tenant faz
 * `can()` cair no comportamento de transição — decidir só pelo papel. Como
 * toda sessão real tem tenant, o caminho de transição só existe para chamadas
 * que ainda não passam por aqui.
 */
export function actorOf(user: SessionUser): Actor {
  return {
    id: user.id,
    role: user.role,
    tenantId: user.tenant.id,
    ...(user.project ? { project: user.project } : {}),
  };
}

/**
 * Converte o usuário da sessão no modelo que as telas exibem.
 *
 * Os dois tipos existem de propósito e não são intercambiáveis: `SessionUser`
 * é o DTO que atravessa a fronteira (campos anuláveis, como o banco devolve), e
 * `User` é o modelo de apresentação (campos opcionais, como o JSX espera). Com
 * `exactOptionalPropertyTypes`, `null` e "ausente" são coisas distintas — então
 * a ponte é explícita, e a chave é **omitida** quando não há valor, em vez de
 * virar `undefined` (mesma regra do DEC-055).
 */
export function toDisplayUser(user: SessionUser): User {
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    fullName: user.fullName,
    status: "active",
    ...(user.email ? { email: user.email } : {}),
    ...(user.project ? { project: user.project } : {}),
  };
}

/**
 * As funcionalidades ligadas para o cliente da sessão.
 *
 * Fica fora de `SessionUser` de propósito: aquele tipo atravessa a fronteira
 * servidor→cliente em toda página, e o mapa completo do catálogo é peso morto
 * onde ninguém o consulta. Quem precisa — o layout do grupo autenticado —
 * pede aqui.
 */
export async function currentFeatures(): Promise<Record<string, boolean>> {
  const user = await currentUser();
  if (!user) return {};

  return Object.fromEntries(await findTenantFeatures(user.tenant.id));
}

/**
 * Usuário simulado por `NERD_DEV_ROLE`, só em desenvolvimento.
 *
 * Vem do seed em memória e não passa pelo banco — é atalho de desenvolvimento,
 * não caminho de autenticação.
 */
async function devUser(role: string): Promise<SessionUser | null> {
  /* O tenant é buscado no banco, não fixado aqui: o id é gerado pela migração
     e inventar um faria toda consulta recortada por tenant devolver vazio. */
  const tenant = await findTenantBySlug("exemplo");
  if (!tenant) return null;

  const source =
    role === "admin" ? admin
    : role === "manager" ? manager
    : role === "instructor" ? instructors[0]!
    : student;

  return {
    /* O id precisa ser o do BANCO, não o do mock: as camadas de dados agora
       consultam Postgres, e `u1` não existe lá. A derivação é a mesma que o
       seed usa, então o atalho de desenvolvimento cai exatamente na pessoa
       correspondente. */
    id: uuidForMockId(source.id),
    firstName: source.firstName,
    fullName: source.fullName,
    email: source.email ?? null,
    role: source.role,
    project: source.project ?? null,
    /* O mock não tem função: o atalho de desenvolvimento serve para abrir as
       telas, e uma função inventada aqui faria as trilhas por função parecerem
       funcionar sem ninguém ter cadastrado nada. */
    jobTitle: null,
    tenant,
  };
}
