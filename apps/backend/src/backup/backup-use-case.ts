import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  AVISOS_DO_BACKUP,
  BACKUP_FORMAT_VERSION,
  NAO_RESTAURA,
  TABELAS_DO_BACKUP,
  validarBackup,
  type BackupFile,
} from "@nerdlms/core/backup/manifest.ts";

import {
  chavePrimariaDe,
  colunasDe,
  contarTabelas,
  lerTabela,
  lerTabelaDoCurso,
} from "./backup-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";
import { query, withTransaction } from "../db/pool.ts";

/**
 * Backup e restauração — F5-06 (guia §24 e §5).
 *
 * Gerar é ler o cliente inteiro num arquivo. Restaurar é escrevê-lo de volta —
 * e é a operação mais perigosa do produto, porque toca todas as tabelas de uma
 * vez. Duas defesas:
 *
 *  1. **Uma transação para tudo.** Restauração parcial é pior que restauração
 *     nenhuma: deixa o cliente num estado que não é nem o antigo nem o novo.
 *  2. **Nunca sobrescreve.** As linhas entram com `ON CONFLICT DO NOTHING`. Um
 *     restore que atualiza registro existente apagaria trabalho feito depois do
 *     backup, sem aviso e sem volta.
 */

export interface BackupCommand {
  actor: Actor;
  actorName: string;
  /** Ausente: backup do cliente inteiro. Presente: só este curso. */
  courseId?: string | null;
}

export type BackupOutcome =
  | { status: 200; arquivo: BackupFile; nomeDoArquivo: string }
  | { status: 403 | 404; error: string };

/** Só admin: um backup é o cliente inteiro num arquivo. */
function autorizado(actor: Actor): boolean {
  return can(actor, "read", { kind: "analytics", scope: "platform" });
}

/** Nome do arquivo, com a data — para não sobrescrever o anterior. */
function nomeDoArquivo(slug: string, escopo: string, agora: Date): string {
  return `backup-${escopo}-${slug}-${agora.toISOString().slice(0, 10)}.json`;
}

export async function gerarBackup(command: BackupCommand): Promise<BackupOutcome> {
  if (!autorizado(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para gerar backup." };
  }

  const tenantId = command.actor.tenantId;

  const tenants = await query<{ slug: string }>(`SELECT slug FROM tenants WHERE id = $1`, [
    tenantId,
  ]);
  const tenantSlug = tenants[0]?.slug ?? "cliente";

  const escopo = command.courseId ? "curso" : "tenant";
  const dados: BackupFile["dados"] = {};

  let courseSlug: string | undefined;

  if (command.courseId) {
    /* O curso tem de ser DESTE cliente. Sem esta conferência, um id copiado de
       outro lugar geraria o backup de um curso alheio. */
    const cursos = await query<{ slug: string }>(
      `SELECT slug FROM courses WHERE id = $1 AND tenant_id = $2`,
      [command.courseId, tenantId],
    );

    if (!cursos[0]) return { status: 404, error: "Curso não encontrado." };
    courseSlug = cursos[0].slug;
  }

  for (const tabela of TABELAS_DO_BACKUP) {
    if (command.courseId && !tabela.noBackupDeCurso) continue;

    const linhas = command.courseId
      ? await lerTabelaDoCurso(tabela, tenantId, command.courseId)
      : await lerTabela(tabela, tenantId);

    if (linhas.length > 0) dados[tabela.nome] = linhas;
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "backup_generated",
    target: command.courseId ? `curso ${courseSlug}` : `cliente ${tenantSlug}`,
    outcome: "allowed",
  });

  const agora = new Date();

  return {
    status: 200,
    arquivo: {
      formato: BACKUP_FORMAT_VERSION,
      geradoEm: agora.toISOString(),
      escopo,
      origem: {
        tenantId,
        tenantSlug,
        ...(command.courseId && courseSlug
          ? { courseId: command.courseId, courseSlug }
          : {}),
      },
      avisos: AVISOS_DO_BACKUP,
      dados,
    },
    nomeDoArquivo: nomeDoArquivo(courseSlug ?? tenantSlug, escopo, agora),
  };
}

export interface RestoreCommand {
  actor: Actor;
  actorName: string;
  /** O conteúdo do arquivo, ainda como texto. */
  conteudo: string;
}

export interface RestoreResult {
  /** Tabela → quantas linhas entraram de fato. */
  inseridas: Record<string, number>;
  /** Tabela → quantas foram puladas por já existirem. */
  ignoradas: Record<string, number>;
  total: number;
}

export type RestoreOutcome =
  | { status: 200; resultado: RestoreResult }
  | { status: 400 | 403; error: string };

/**
 * Confere o arquivo sem escrever nada.
 *
 * Mesmo princípio das importações: quem restaura precisa ver o que vem antes de
 * mandar vir.
 */
export type RestorePreviewOutcome =
  | {
      status: 200;
      escopo: "tenant" | "curso";
      origem: BackupFile["origem"];
      geradoEm: string;
      avisos: readonly string[];
      /** Tabela → linhas no arquivo. */
      conteudo: Array<{ tabela: string; linhas: number }>;
      /** `true` quando o backup é de OUTRO cliente. */
      deOutroCliente: boolean;
    }
  | { status: 400 | 403; error: string };

export async function conferirBackup(command: RestoreCommand): Promise<RestorePreviewOutcome> {
  if (!autorizado(command.actor) || !command.actor.tenantId) {
    return { status: 403, error: "Sem permissão para restaurar backup." };
  }

  let json: unknown;
  try {
    json = JSON.parse(command.conteudo);
  } catch {
    return { status: 400, error: "O arquivo não é um JSON válido." };
  }

  const conferido = validarBackup(json);
  if (!conferido.ok) return { status: 400, error: conferido.erro };

  const { arquivo } = conferido;

  return {
    status: 200,
    escopo: arquivo.escopo,
    origem: arquivo.origem,
    geradoEm: arquivo.geradoEm,
    avisos: arquivo.avisos ?? AVISOS_DO_BACKUP,
    conteudo: TABELAS_DO_BACKUP.filter((t) => (arquivo.dados[t.nome]?.length ?? 0) > 0).map(
      (t) => ({ tabela: t.nome, linhas: arquivo.dados[t.nome]!.length }),
    ),
    /* Restaurar backup de outro cliente é migração de tenant — o §24 pede, e é
       legítimo. Mas a tela precisa dizer isso em voz alta: é a diferença entre
       "recuperar o que eu perdi" e "trazer o conteúdo de outra empresa". */
    deOutroCliente: arquivo.origem.tenantId !== command.actor.tenantId,
  };
}

export async function restaurarBackup(command: RestoreCommand): Promise<RestoreOutcome> {
  const conferido = await conferirBackup(command);
  if (conferido.status !== 200) return conferido;

  /* RESTAURAÇÃO É NO MESMO CLIENTE. Migrar para outro exige mais que isto.
   *
   * As linhas carregam os UUIDs de origem, e é assim que as chaves estrangeiras
   * entre elas continuam válidas. Num cliente diferente, esses mesmos UUIDs já
   * existem — são as linhas do cliente de origem, na mesma tabela — e o
   * `ON CONFLICT DO NOTHING` pula TODAS. O resultado é uma migração que diz ter
   * funcionado e não moveu nada, que é pior que uma que recusa.
   *
   * Fazer de verdade exige reemitir cada UUID e reescrever toda referência a
   * ele, de forma consistente entre 45 tabelas. É trabalho próprio, e está
   * registrado como lacuna do §24 ("migrar tenant") no plano.
   *
   * Recusar aqui, e não na tela: a tela avisa, mas quem chama a rota direto
   * também precisa da recusa. */
  if (conferido.deOutroCliente) {
    return {
      status: 400,
      error:
        `Este backup é do cliente "${conferido.origem.tenantSlug}". ` +
        "A restauração só funciona no mesmo cliente que gerou o arquivo, " +
        "migrar conteúdo entre clientes ainda não está disponível.",
    };
  }

  /* Refeito a partir do texto, não recebido pronto: o mesmo princípio das
     importações — a tela é conveniência, nunca autoridade. */
  const validado = validarBackup(JSON.parse(command.conteudo));
  if (!validado.ok) return { status: 400, error: validado.erro };

  const arquivo = validado.arquivo;
  const tenantId = command.actor.tenantId!;

  const inseridas: Record<string, number> = {};
  const ignoradas: Record<string, number> = {};
  let total = 0;

  /* UMA TRANSAÇÃO PARA O ARQUIVO INTEIRO.
   *
   * Diferente da importação de cursos, onde cada curso é uma unidade
   * independente. Aqui as tabelas se referenciam entre si: restaurar `lessons`
   * sem `modules` deixa aula órfã, e parar no meio deixa o cliente num estado
   * que não é nem o antigo nem o do arquivo. Ou volta tudo, ou não volta nada. */
  await withTransaction(async (exec) => {
    for (const tabela of TABELAS_DO_BACKUP) {
      /* A auditoria sai no arquivo mas não volta: sem chave única, cada
         restauração a duplicaria — e auditoria duplicada afirma que a mesma
         ação aconteceu duas vezes. */
      if (NAO_RESTAURA.has(tabela.nome)) continue;

      const linhas = arquivo.dados[tabela.nome];
      if (!linhas || linhas.length === 0) continue;

      /* As colunas vêm do BANCO DE DESTINO, não do arquivo: um backup gerado
         antes de uma migração tem colunas que não existem mais, e mandá-las no
         INSERT falharia. O que o destino não conhece é descartado. */
      const doDestino = await colunasDe(tabela.nome);
      const porNome = new Map(doDestino.map((c) => [c.nome, c]));

      /* Coluna de identidade GENERATED ALWAYS fica de fora: o banco recusa
         valor explícito nela e derruba a restauração inteira. O valor novo é
         gerado no destino. */
      const colunas = Object.keys(linhas[0]!).filter(
        (c) => porNome.has(c) && !porNome.get(c)!.identidadeSempre,
      );

      if (colunas.length === 0) continue;

      /* O alvo do ON CONFLICT é a CHAVE PRIMÁRIA, nomeada.
         Sem alvo, o Postgres recusa a instrução quando a tabela tem alguma
         restrição única DEFERRABLE — `modules(course_id, position)` é assim. */
      const pk = await chavePrimariaDe(tabela.nome);
      const alvo = pk.length > 0 ? `(${pk.map((c) => `"${c}"`).join(", ")})` : "";

      let inseridasNaTabela = 0;

      for (const linha of linhas) {
        const valores = colunas.map((coluna) => {
          /* O `tenant_id` é REESCRITO para o cliente de destino. É isto que
             faz "migrar tenant" funcionar — e o que impede que restaurar um
             backup alheio crie linhas apontando para o cliente de origem. */
          if (coluna === "tenant_id") return tenantId;

          const valor = linha[coluna] ?? null;

          /* jsonb volta como TEXTO. O driver entrega jsonb já parseado, e
             devolver o objeto faz o Postgres receber "[object Object]" —
             `invalid input syntax for type json`. Arrays do Postgres NÃO
             entram aqui: o driver sabe convertê-los sozinho, e serializá-los
             como JSON os gravaria como string. */
          if (porNome.get(coluna)!.json && valor !== null) return JSON.stringify(valor);

          return valor;
        });

        const marcadores = colunas.map((_, i) => `$${i + 1}`).join(", ");

        /* `ON CONFLICT DO NOTHING`: nunca sobrescreve.
           Restaurar por cima de um registro que mudou depois do backup apagaria
           trabalho feito nesse meio-tempo, sem aviso e sem volta. Quem quer o
           estado do arquivo apaga antes, por decisão explícita. */
        const resultado = await exec<{ id: unknown }>(
          `INSERT INTO ${tabela.nome} (${colunas.map((c) => `"${c}"`).join(", ")})
           VALUES (${marcadores})
           ON CONFLICT ${alvo} DO NOTHING
           RETURNING 1 AS id`,
          valores,
        );

        if (resultado.length > 0) inseridasNaTabela += 1;
      }

      if (inseridasNaTabela > 0) inseridas[tabela.nome] = inseridasNaTabela;
      if (linhas.length - inseridasNaTabela > 0) {
        ignoradas[tabela.nome] = linhas.length - inseridasNaTabela;
      }

      total += inseridasNaTabela;
    }
  });

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "backup_restored",
    target: `${total} ${total === 1 ? "registro" : "registros"} de ${arquivo.origem.tenantSlug}`,
    outcome: "allowed",
  });

  return { status: 200, resultado: { inseridas, ignoradas, total } };
}

/** O tamanho do backup antes de gerá-lo, para a tela avisar. */
export async function tamanhoDoBackup(
  actor: Actor,
): Promise<{ status: 200; contagens: Record<string, number> } | { status: 403; error: string }> {
  if (!autorizado(actor) || !actor.tenantId) {
    return { status: 403, error: "Sem permissão." };
  }

  return { status: 200, contagens: await contarTabelas(actor.tenantId) };
}
