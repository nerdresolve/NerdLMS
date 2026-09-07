import type { Role } from "@nerdlms/core/auth/permissions.ts";

import { query } from "../db/pool.ts";
import { anonymizeActorStatements } from "../xapi/lrs-repository.ts";

/**
 * Escrita de usuário: convite, edição, desativação e exclusão.
 *
 * Separado de `users-repository.ts` (autenticação) e de
 * `courses/users-directory.ts` (leitura para telas). Três arquivos porque são
 * três responsabilidades, e porque manter a escrita longe da leitura de
 * autenticação evita que o hash de senha apareça onde não deve.
 */

export interface InviteInput {
  tenantId: string;
  fullName: string;
  email: string;
  role: Role;
  project: string | null;
}

export type InviteResult = { ok: true; userId: string } | { ok: false; reason: "email_taken" };

/**
 * Cria a conta em estado pendente.
 *
 * `password_hash` fica nulo de propósito: quem escolhe a senha é a pessoa, no
 * primeiro acesso. Um administrador que digita a senha de outro passa a saber
 * a senha de outro.
 *
 * O e-mail duplicado é detectado pela restrição do banco, não por uma consulta
 * antes — entre verificar e inserir cabe outra requisição criando o mesmo
 * endereço.
 */
export async function inviteUser(input: InviteInput): Promise<InviteResult> {
  /* O conflito é sobre `(tenant_id, email)`, não sobre `email` sozinho: desde
     a migração 003 o endereço é único POR CLIENTE, e duas empresas podem
     legitimamente ter a mesma pessoa. Apontar para a restrição antiga faria o
     Postgres recusar o ON CONFLICT — ela não existe mais. */
  const rows = await query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, full_name, role, status, project)
     VALUES ($5, $1, $2, $3, 'pending', $4)
     ON CONFLICT (tenant_id, email) DO NOTHING
     RETURNING id`,
    [input.email, input.fullName, input.role, input.project, input.tenantId],
  );

  const id = rows[0]?.id;
  return id ? { ok: true, userId: id } : { ok: false, reason: "email_taken" };
}

export interface UpdateUserInput {
  userId: string;
  fullName: string;
  role: Role;
  project: string | null;
}

/** Atualiza nome, papel e projeto. Devolve `false` se o usuário não existe. */
export async function updateUser(input: UpdateUserInput): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE users SET full_name = $2, role = $3, project = $4, updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [input.userId, input.fullName, input.role, input.project],
  );
  return rows.length > 0;
}

/**
 * Ativa ou desativa a conta.
 *
 * Desativar **não apaga**: o histórico de progresso, matrícula e comentário
 * continua, e a pessoa some das telas de acesso. Apagar levaria junto o que
 * ela produziu, e a auditoria perderia o rastro.
 *
 * As sessões abertas são encerradas junto — desativar alguém que continua
 * navegando não desativou ninguém.
 */
export async function setUserStatus(userId: string, active: boolean): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE users SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [userId, active ? "active" : "inactive"],
  );

  if (rows.length > 0 && !active) {
    await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  }

  return rows.length > 0;
}

/** O papel e o projeto de alguém, para as checagens antes de escrever. */
export async function findUserRole(
  userId: string,
): Promise<{ role: Role; project: string | null } | null> {
  const rows = await query<{ role: Role; project: string | null }>(
    `SELECT role, project FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Grava o que a própria pessoa pode mudar no seu cadastro.
 *
 * Só o nome. Papel e projeto ficam de fora de propósito: são o que define o
 * que ela enxerga, e deixá-los aqui permitiria que qualquer conta se
 * promovesse a administrador editando o próprio perfil. E-mail também não,
 * porque é a credencial de acesso — trocá-lo é outro fluxo, com confirmação.
 */
export async function updateOwnProfile(userId: string, fullName: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE users SET full_name = $2, updated_at = now()
      WHERE id = $1 AND status = 'active'
      RETURNING id`,
    [userId, fullName],
  );
  return rows.length > 0;
}

export type DeleteOutcome =
  | { kind: "deleted"; anonymizedStatements: number }
  | { kind: "blocked"; comments: number; courses: number };

/**
 * Exclui a conta de verdade — LGPD, direito à eliminação.
 *
 * Diferente de desativar, que é o caminho normal: desativar guarda tudo e tira
 * o acesso. Isto apaga a pessoa. Só faz sentido quando o titular exerce o
 * direito de eliminação, e por isso não é um botão qualquer da tela de
 * usuários.
 *
 * O QUE ACONTECE COM O QUE ELA PRODUZIU
 *
 * O schema já responde, coluna por coluna, e esta função só respeita o que
 * está lá:
 *
 *   CASCADE — matrícula, progresso, notificação, sessão. Some junto, porque
 *   fora da pessoa não significa nada.
 *
 *   SET NULL — auditoria, quem publicou um material, quem corrigiu uma nota.
 *   O registro fica sem o nome. Apagar a linha inteira quebraria o histórico
 *   de outras pessoas.
 *
 *   RESTRICT — comentário e curso. O banco RECUSA a exclusão, e está certo:
 *   apagar levaria junto a conversa de uma aula ou um curso que outras pessoas
 *   estão fazendo. Aqui a função devolve `blocked` com a contagem, para quem
 *   for decidir saber exatamente o que está no caminho.
 *
 * O xAPI é tratado ANTES: `actor_id` é `SET NULL`, e depois da exclusão não há
 * como encontrar as linhas para limpar o e-mail que ficou nelas.
 */
export async function deleteUserAccount(
  tenantId: string,
  userId: string,
): Promise<DeleteOutcome> {
  const barreiras = await query<{ comentarios: number; cursos: number }>(
    `SELECT (SELECT count(*) FROM comments WHERE author_id = $1)::int AS comentarios,
            (SELECT count(*) FROM courses  WHERE author_id = $1)::int AS cursos`,
    [userId],
  );

  const { comentarios = 0, cursos = 0 } = barreiras[0] ?? {};
  if (comentarios > 0 || cursos > 0) {
    /* Recusa ANTES de tentar: deixar o banco levantar a violação de chave
       estrangeira daria uma mensagem sobre a restrição, e não sobre o que a
       pessoa precisa resolver primeiro. */
    return { kind: "blocked", comments: comentarios, courses: cursos };
  }

  const anonimizados = await anonymizeActorStatements(tenantId, userId);

  /* A TRILHA DE AUDITORIA VEM ANTES DO DELETE, PELO MESMO MOTIVO DO xAPI.

     `audit_log.actor_id` é `ON DELETE SET NULL`, mas o `SET NULL` do banco só
     alcança o vínculo: deixaria `actor_name` e `ip` na linha, devolvendo a
     identidade que a exclusão acabou de tirar. E `target` guarda o e-mail da
     própria pessoa quando a ação é o login.

     Feito aqui, num UPDATE só, o `actor_id` já sai nulo e a chave estrangeira
     não encontra mais nada para atualizar durante o DELETE. */
  await anonymizeAuditTrail(tenantId, userId);

  await query(`DELETE FROM users WHERE id = $1 AND tenant_id = $2`, [userId, tenantId]);

  return { kind: "deleted", anonymizedStatements: anonimizados };
}

/**
 * Tira a pessoa da trilha de auditoria sem apagar os fatos.
 *
 * Fica: quando, qual ação, com que desfecho. Sai: quem, de onde, e o e-mail
 * quando ele estava no alvo — o login grava `target` como o próprio e-mail,
 * enquanto nas demais ações o alvo é outra coisa e limpá-lo destruiria o
 * registro de terceiros.
 *
 * A escrita não acontece aqui: o papel da aplicação não tem UPDATE em
 * `audit_log` e não vai ter. Quem escreve é `anonimizar_auditoria`, criada pela
 * migração 040 — uma função `SECURITY DEFINER` que faz exatamente isto e nada
 * mais, e cuja execução é a única coisa concedida à aplicação.
 */
async function anonymizeAuditTrail(tenantId: string, userId: string): Promise<number> {
  const linhas = await query<{ anonimizar_auditoria: string }>(
    `SELECT anonimizar_auditoria($1, $2)`,
    [tenantId, userId],
  );

  return Number(linhas[0]?.anonimizar_auditoria ?? 0);
}
