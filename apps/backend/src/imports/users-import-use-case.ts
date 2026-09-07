import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import { parseTable } from "@nerdlms/core/imports/csv-parse.ts";
import { planImport, type PlanoDeImportacao } from "@nerdlms/core/imports/users-import.ts";

import { inviteUser } from "../auth/user-admin-repository.ts";
import { findAllUsers } from "../courses/users-directory.ts";
import { recordAudit } from "../audit/audit-repository.ts";

/**
 * Importação de usuários em massa — F5-05 (guia §24).
 *
 * Dois passos, sempre nesta ordem: **conferir** devolve o plano sem gravar
 * nada, e **aplicar** grava o que o plano prometeu. Um passo só — manda o
 * arquivo, grava o que der — deixaria o cliente com 300 contas criadas e 40
 * erros para descobrir depois, sem como voltar atrás.
 */

export interface ImportCommand {
  actor: Actor;
  actorName: string;
  /** O conteúdo do arquivo, já como texto. */
  csv: string;
}

export type ImportOutcome =
  | { status: 200; plano: PlanoDeImportacao }
  | { status: 400 | 403; error: string };

/** Quem pode importar gente: só quem administra a plataforma. */
function autorizado(actor: Actor): boolean {
  return can(actor, "read", { kind: "analytics", scope: "platform" });
}

/**
 * Confere a planilha e devolve o que aconteceria. **Não grava.**
 */
export async function previewUserImport(command: ImportCommand): Promise<ImportOutcome> {
  if (!autorizado(command.actor)) {
    return { status: 403, error: "Sem permissão para importar usuários." };
  }

  if (!command.actor.tenantId) {
    return { status: 400, error: "Sessão sem cliente definido." };
  }

  const { headers, rows } = parseTable(command.csv);

  if (headers.length === 0) {
    return { status: 400, error: "O arquivo está vazio." };
  }

  if (rows.length === 0) {
    return { status: 400, error: "O arquivo só tem o cabeçalho, sem nenhuma linha." };
  }

  /* Os e-mails que já existem NESTE cliente. O recorte é o de sempre: sem ele,
     a importação diria "já existe" por causa de alguém de outra empresa — e
     revelaria, pela mensagem, que aquele endereço está cadastrado lá. */
  const existentes = new Set(
    (await findAllUsers(command.actor.tenantId))
      .map((u) => u.email ?? "")
      .filter((e) => e !== ""),
  );

  return { status: 200, plano: planImport(rows, existentes) };
}

export interface AppliedImport {
  criados: number;
  /** As que o plano previa criar mas o banco recusou — corrida entre conferir e aplicar. */
  recusados: number;
}

export type ApplyOutcome =
  | { status: 200; resultado: AppliedImport }
  | { status: 400 | 403; error: string };

/**
 * Aplica: cria as contas que o plano marcou como "criar".
 *
 * O plano é recalculado aqui, e não recebido pronto do navegador. Confiar no
 * que a tela mandou deixaria qualquer um criar um admin bastando alterar o
 * corpo da requisição — a tela é conveniência, nunca autoridade.
 */
export async function applyUserImport(command: ImportCommand): Promise<ApplyOutcome> {
  const conferido = await previewUserImport(command);
  if (conferido.status !== 200) return conferido;

  const paraCriar = conferido.plano.linhas.filter((l) => l.situacao === "criar");

  let criados = 0;
  let recusados = 0;

  for (const linha of paraCriar) {
    const resultado = await inviteUser({
      tenantId: command.actor.tenantId!,
      fullName: linha.nome,
      email: linha.email,
      role: linha.papel,
      project: linha.unidade,
    });

    /* Recusa aqui é o e-mail que passou a existir ENTRE conferir e aplicar.
       Não é falha da importação: é a restrição do banco fazendo o trabalho
       dela, e a linha simplesmente não vira conta. */
    if (resultado.ok) criados += 1;
    else recusados += 1;
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "users_imported",
    target: `${criados} ${criados === 1 ? "conta criada" : "contas criadas"}`,
    outcome: "allowed",
  });

  return { status: 200, resultado: { criados, recusados } };
}
