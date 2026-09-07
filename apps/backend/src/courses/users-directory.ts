import type { Role } from "@nerdlms/core/auth/permissions.ts";
import type { User } from "@nerdlms/core/courses/types.ts";

import { query } from "../db/pool.ts";

/**
 * Consulta de pessoas para as telas de gestão.
 *
 * Separada de `auth/users-repository.ts` de propósito: aquele existe para
 * autenticar e devolve `AccountRecord`, que carrega o hash da senha. Este
 * devolve `User` — o modelo de exibição, sem nada sensível — e é o que as telas
 * de gestor e admin consomem.
 *
 * A separação é o que impede o hash de chegar perto de uma tela por descuido.
 */

interface DirectoryRow {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  status: "active" | "pending" | "inactive";
  project: string | null;
  region: string | null;
  last_access_at: Date | null;
}

function toUser(row: DirectoryRow): User {
  /* Chaves opcionais são OMITIDAS quando não há valor, e não postas como
     `undefined`: com `exactOptionalPropertyTypes` as duas coisas são
     diferentes, e o domínio trata ausência como ausência (DEC-055). */
  return {
    id: row.id,
    role: row.role,
    firstName: row.full_name.trim().split(/\s+/)[0] ?? row.full_name,
    fullName: row.full_name,
    status: row.status,
    ...(row.email ? { email: row.email } : {}),
    ...(row.project ? { project: row.project } : {}),
    ...(row.region ? { region: row.region } : {}),
    ...(row.last_access_at ? { lastAccessAt: row.last_access_at.toISOString() } : {}),
  };
}

/** Todas as pessoas com acesso, ordenadas por nome. */
/**
 * Todas as pessoas DO TENANT.
 *
 * `tenantId` obrigatório: esta consulta alimenta a gestão de usuários e a
 * exportação em CSV — sem recorte, o relatório de um cliente sairia com a
 * lista de pessoas de outro.
 */
export async function findAllUsers(tenantId: string): Promise<User[]> {
  const rows = await query<DirectoryRow>(
    `SELECT id, full_name, email, role, status, project, region, last_access_at
       FROM users
      WHERE tenant_id = $1
      ORDER BY full_name`,
    [tenantId],
  );
  return rows.map(toUser);
}
