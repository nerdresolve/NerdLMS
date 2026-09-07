import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { slugify } from "@nerdlms/core/courses/slug.ts";
import type { Track } from "@nerdlms/core/courses/tracks.ts";
import {
  matrizDeTreinamento,
  type CelulaDaMatriz,
} from "@nerdlms/core/courses/alvo-da-trilha.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import {
  createTrack,
  findAllTracks,
  pessoasDaMatriz,
  setTrackCourses,
  updateTrack,
} from "./tracks-repository.ts";

import { LIMITE_DE_NOME, LIMITE_DE_TEXTO, textoDeEntrada } from "@nerdlms/core/validation/texto.ts";
/**
 * Montar trilhas e ver a matriz de treinamento.
 *
 * Uma trilha se destina a um LOCAL, a uma FUNÇÃO, aos dois ou a ninguém em
 * particular — e "a ninguém em particular" quer dizer a todo mundo. A regra
 * inteira está em `core/courses/alvo-da-trilha.ts`; aqui fica a autorização e
 * a montagem.
 *
 * Só administrador. Trilha é decisão de programa de treinamento da organização,
 * não de quem escreve um curso: um instrutor mudando o alvo de uma trilha
 * mudaria o que outra unidade inteira vê.
 */

function podeGerir(actor: Actor): boolean {
  return actor.role === "admin" && Boolean(actor.tenantId);
}

/** Texto de campo opcional: vazio e só-espaços viram nulo, que é "todos". */
function opcional(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

export interface MatrizDeTreinamento {
  trilhas: Track[];
  linhas: CelulaDaMatriz[];
  /** Quantas contas ativas não têm função cadastrada. */
  semFuncao: number;
}

export async function matrizUseCase(actor: Actor): Promise<MatrizDeTreinamento> {
  if (!podeGerir(actor)) return { trilhas: [], linhas: [], semFuncao: 0 };

  const [trilhas, pessoas] = await Promise.all([
    findAllTracks(actor.tenantId!),
    pessoasDaMatriz(actor.tenantId!),
  ]);

  const linhas = matrizDeTreinamento(
    pessoas,
    trilhas.map((trilha) => ({
      title: trilha.title,
      project: trilha.project ?? null,
      jobTitle: trilha.jobTitle ?? null,
    })),
  );

  return {
    trilhas,
    linhas,
    semFuncao: linhas.find((linha) => linha.funcao === null)?.pessoas ?? 0,
  };
}

export interface SalvarTrilhaCommand {
  actor: Actor;
  actorName: string;
  /** Ausente: criar. Presente: editar aquela trilha. */
  trackId?: string | null;
  title: unknown;
  summary: unknown;
  mode: unknown;
  project: unknown;
  jobTitle: unknown;
  courseIds: unknown;
}

export type SalvarTrilhaOutcome =
  | { status: 200 | 201; id: string }
  | { status: 400 | 403 | 404 | 409; error: string };

export async function salvarTrilhaUseCase(
  command: SalvarTrilhaCommand,
): Promise<SalvarTrilhaOutcome> {
  if (!podeGerir(command.actor)) {
    return { status: 403, error: "Só a administração monta trilhas." };
  }

  const tenantId = command.actor.tenantId!;
  const title = textoDeEntrada(command.title, LIMITE_DE_NOME) ?? "";

  if (title.length < 3) {
    return { status: 400, error: `Dê um nome à trilha, de 3 a ${LIMITE_DE_NOME} caracteres.` };
  }

  const resumo = textoDeEntrada(command.summary, LIMITE_DE_TEXTO);

  /* Nulo com `summary` presente é resumo grande demais, e recusar é o certo:
     cortar guardaria metade de um texto dizendo que deu certo. Nulo com
     `summary` ausente é trilha sem resumo, que é permitido. */
  if (resumo === null && command.summary !== undefined) {
    return { status: 400, error: `O resumo passa de ${LIMITE_DE_TEXTO} caracteres.` };
  }

  const summary = resumo ?? "";
  /* `sequential` só quando pedido explicitamente. "free" é o padrão seguro: uma
     trilha travada por engano deixa a pessoa sem saber por que o segundo curso
     não abre. */
  const mode = command.mode === "sequential" ? "sequential" : "free";
  const project = opcional(command.project);
  const jobTitle = opcional(command.jobTitle);

  const courseIds = Array.isArray(command.courseIds)
    ? command.courseIds.filter((item): item is string => typeof item === "string")
    : [];

  if (command.trackId) {
    const alterou = await updateTrack({
      tenantId,
      trackId: command.trackId,
      title,
      summary,
      mode,
      project,
      jobTitle,
    });

    /* Trilha de outro cliente responde como inexistente: a diferença entre
       "não existe" e "não é sua" já é informação (§18). */
    if (!alterou) return { status: 404, error: "Trilha não encontrada." };

    await setTrackCourses(tenantId, command.trackId, courseIds);
    return { status: 200, id: command.trackId };
  }

  /* O slug sai do título. Vazio quando o título não tem nada representável em
     ASCII — um nome só de emoji —, e aí a trilha teria endereço `/trilhas/`. */
  const slug = slugify(title);
  if (slug === "") {
    return { status: 400, error: "O nome precisa ter letras ou números." };
  }

  const id = await createTrack({ tenantId, slug, title, summary, mode, project, jobTitle });

  if (id === null) {
    return { status: 409, error: "Já existe uma trilha com este nome." };
  }

  await setTrackCourses(tenantId, id, courseIds);

  await recordAudit({
    tenantId,
    actorId: command.actor.id,
    actorName: command.actorName,
    /* Trilha define o que uma unidade ou função inteira precisa fazer: é
       configuração da organização, e é assim que a trilha de auditoria a
       classifica. */
    action: "config_changed",
    target: `trilha ${title}`,
    outcome: "allowed",
  });

  return { status: 201, id };
}
