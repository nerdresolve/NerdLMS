import type { Actor } from "@nerdlms/core/auth/permissions.ts";

import { query } from "../db/pool.ts";

/**
 * Quem está sob a alçada de quem — F1-03.
 *
 * A tela de equipe já monta essa lista carregando todo mundo do tenant e
 * filtrando em memória. Isso serve para exibir dezenas de pessoas; não serve
 * para AUTORIZAR, porque uma decisão de permissão não deve depender de a
 * chamada anterior ter filtrado direito.
 *
 * Aqui a pergunta é respondida pelo banco, com o recorte na cláusula WHERE.
 */

/**
 * Os ids que este ator pode matricular.
 *
 * O recorte depende do papel:
 *
 * - **gestor**: as pessoas da unidade dele (`project`). É o recorte que o
 *   painel dele já usa, e o que impede matricular gente de outra
 *   unidade;
 * - **admin**: o tenant inteiro. Não tem unidade, e restringi-lo a uma o
 *   impediria de atender o cliente que administra;
 * - **qualquer outro papel**: conjunto vazio. Quem não matricula não precisa
 *   de lista, e devolver vazio faz a checagem de fora recusar naturalmente.
 *
 * `tenant_id` está em toda consulta: é a fronteira que nada atravessa.
 *
 * Sobre o status: fica de fora apenas quem está `inactive`. `pending` é
 * "convidado, ainda não aceitou" (o `password_hash` nulo da 001), e essa
 * pessoa aparece na tela de equipe — filtrá-la aqui faria o servidor recusar
 * exatamente quem a tela oferece. Matricular
 * quem ainda não entrou é legítimo: o curso está lá quando ela entrar.
 */
export async function findTeamMemberIds(actor: Actor): Promise<Set<string>> {
  if (!actor.tenantId) return new Set();

  if (actor.role === "admin") {
    const rows = await query<{ id: string }>(
      `SELECT id FROM users WHERE tenant_id = $1 AND role = 'learner' AND status <> 'inactive'`,
      [actor.tenantId],
    );

    return new Set(rows.map((row) => row.id));
  }

  if (actor.role === "manager") {
    /* Sem unidade o gestor não tem equipe. O schema exige a unidade
       (`users_manager_needs_project`), mas depender disso aqui seria confiar
       numa restrição de outra tabela para decidir permissão. */
    if (!actor.project) return new Set();

    const rows = await query<{ id: string }>(
      `SELECT id
         FROM users
        WHERE tenant_id = $1 AND project = $2 AND role = 'learner' AND status <> 'inactive'`,
      [actor.tenantId, actor.project],
    );

    return new Set(rows.map((row) => row.id));
  }

  return new Set();
}
