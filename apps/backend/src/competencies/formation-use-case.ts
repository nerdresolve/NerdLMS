import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { courseGrade, meetsCertificateGrade } from "@nerdlms/core/assessment/gradebook.ts";
import {
  cadeiaDoPlano,
  exigenciasEfetivas,
  fechariaCiclo,
  formacaoDaPessoa,
  resumoDoCargo,
  type ExigenciaEfetiva,
  type FormacaoDaPessoa,
  type PlanoHerdavel,
  type ResumoDoCargo,
} from "@nerdlms/core/competencies/plano-de-formacao.ts";

import { notasDasMatriculas } from "../assessment/effectiveness-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";
import {
  atualizarPlanoComExigencias,
  criarPlanoComExigencias,
  excluirPlano,
  planosQueContinuam,
  cursosDasTrilhas,
  evidenciasDe,
  pessoasDoPlano,
  planosDeFormacao,
  progressoBruto,
  type ItemDoPlano,
  type PlanoDeCargo,
} from "./formation-repository.ts";

import { LIMITE_DE_NOME, textoDeEntrada } from "@nerdlms/core/validation/texto.ts";
/**
 * "O que forma um Analista de Desenvolvimento PLENO, e quem já está formado?"
 *
 * O plano de formação junta trilhas, cursos e competências e alcança as pessoas
 * pelo CARGO, sem alguém precisar atribuir um a um a cada contratação.
 *
 * A REGRA DE "CURSO CONCLUÍDO" É A MESMA DO CERTIFICADO
 *
 * Todas as aulas vistas e, quando o curso exige, a nota mínima batida. A parte
 * da nota acontece aqui, em TypeScript, com `courseGrade` e
 * `meetsCertificateGrade` — as mesmas funções que o certificado e a avaliação
 * de eficácia chamam. Reescrevê-la em SQL daria uma terceira versão da regra, e
 * um dia as três discordariam sobre quem concluiu.
 */

export interface PessoaFormada {
  id: string;
  nome: string;
  formacao: FormacaoDaPessoa;
}

export interface PlanoComPessoas {
  plano: PlanoDeCargo;
  /** O que o plano exige DE VERDADE: o dele mais o de tudo que ele continua. */
  exigencias: ExigenciaEfetiva[];
  /** Do próprio até a raiz, para a tela mostrar de onde vem cada exigência. */
  cadeia: string[];
  pessoas: PessoaFormada[];
  resumo: ResumoDoCargo;
}

function podeGerir(actor: Actor): boolean {
  return actor.role === "admin" && Boolean(actor.tenantId);
}

/**
 * Os cursos que esta pessoa concluiu de verdade.
 *
 * "De verdade" inclui a nota: quem viu todas as aulas e reprovou na prova não
 * concluiu o curso, e contá-lo como formação diria que a pessoa está pronta
 * para algo que ela não demonstrou.
 */
async function cursosConcluidos(tenantId: string, userId: string): Promise<string[]> {
  const bruto = await progressoBruto(userId);
  if (bruto.cursosComAulasVistas.length === 0) return [];

  const notas = await notasDasMatriculas(tenantId, [...bruto.matriculaPorCurso.values()]);

  return bruto.cursosComAulasVistas.filter((courseId) => {
    const minimo = bruto.exigenciaDeNota.get(courseId);
    if (minimo === undefined) return true;

    const matricula = bruto.matriculaPorCurso.get(courseId);
    const nota = courseGrade(matricula ? (notas.get(matricula) ?? []) : []);

    return meetsCertificateGrade(minimo, nota);
  });
}

/**
 * Os planos, com quem eles alcançam e quanto cada um já cumpriu.
 *
 * Uma consulta de progresso POR PESSOA. Numa organização de trinta pessoas isso
 * é rápido; numa de mil, esta função vira o lugar a otimizar — e a otimização
 * é uma consulta agregada, não um cache, porque o dado muda a cada aula
 * concluída.
 */
export async function formacaoPorCargoUseCase(actor: Actor): Promise<PlanoComPessoas[]> {
  if (!podeGerir(actor)) return [];

  const tenantId = actor.tenantId!;
  const [planos, trilhas] = await Promise.all([
    planosDeFormacao(tenantId),
    cursosDasTrilhas(tenantId),
  ]);

  /* A herança é resolvida ANTES de avaliar as pessoas: quem cumpre o quê se
     mede contra as exigências efetivas, não contra as escritas no plano. Um
     PLENO que só declara "liderança" exige também tudo do JR. */
  const porId = new Map<string, PlanoHerdavel>(
    planos.map((plano) => [
      plano.id,
      {
        id: plano.id,
        nome: plano.nome,
        continuaId: plano.continuaId,
        exigencias: plano.exigencias,
      },
    ]),
  );

  const saida: PlanoComPessoas[] = [];

  for (const plano of planos) {
    const efetivas = exigenciasEfetivas(plano.id, porId);
    const pessoas = await pessoasDoPlano(tenantId, plano.id, plano.jobTitle);
    const avaliadas: PessoaFormada[] = [];

    for (const pessoa of pessoas) {
      const concluidos = await cursosConcluidos(tenantId, pessoa.id);
      const feitos = new Set(concluidos);

      /* TRILHA CONCLUÍDA É TER TODOS OS CURSOS DELA.

         Trilha sem curso nenhum NÃO conta como concluída: um conjunto vazio
         satisfaz "todos" por vacuidade, e diria que a pessoa cumpriu uma
         jornada que ninguém montou. */
      const trilhasConcluidas = [...trilhas.entries()]
        .filter(([, cursos]) => cursos.length > 0 && cursos.every((id) => feitos.has(id)))
        .map(([trackId]) => trackId);

      avaliadas.push({
        id: pessoa.id,
        nome: pessoa.nome,
        formacao: formacaoDaPessoa(efetivas, {
          trilhasConcluidas,
          cursosConcluidos: concluidos,
          evidencias: await evidenciasDe(tenantId, pessoa.id),
        }),
      });
    }

    saida.push({
      plano,
      exigencias: efetivas,
      cadeia: cadeiaDoPlano(plano.id, porId).map((p) => p.nome),
      pessoas: avaliadas,
      resumo: resumoDoCargo(plano.jobTitle ?? plano.nome, avaliadas),
    });
  }

  return saida;
}

export interface SalvarPlanoCommand {
  actor: Actor;
  actorName: string;
  nome: unknown;
  descricao: unknown;
  jobTitle: unknown;
  /** Id do plano que este continua. Ausente: não continua nenhum. */
  continuaId: unknown;
  itens: unknown;
}

export type SalvarPlanoOutcome =
  | { status: 201; id: string }
  | { status: 400 | 403; error: string };

/** Texto opcional: vazio e só-espaços viram nulo. */
function opcional(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

interface PlanoValidado {
  nome: string;
  descricao: string | null;
  jobTitle: string | null;
  continuaId: string | null;
  itens: ItemDoPlano[];
}

/**
 * A validação que criar e editar compartilham.
 *
 * `planoId` é o id do próprio plano quando se está editando, e `null` ao criar.
 * É ele que faz a checagem de ciclo valer: um plano NOVO não tem descendentes,
 * então o ciclo só é possível na edição — fazer JR continuar SÊNIOR quando
 * SÊNIOR já continua JR.
 */
async function validarPlano(
  command: SalvarPlanoCommand,
  planoId: string | null,
): Promise<PlanoValidado | { status: 400; error: string }> {
  const nome = textoDeEntrada(command.nome, LIMITE_DE_NOME) ?? "";
  if (nome.length < 3) {
    return { status: 400, error: `Dê um nome ao plano, de 3 a ${LIMITE_DE_NOME} caracteres.` };
  }

  const itens: ItemDoPlano[] = Array.isArray(command.itens)
    ? command.itens.flatMap((item: unknown) => {
        if (typeof item !== "object" || item === null) return [];

        const { tipo, alvoId, nivelExigido } = item as Record<string, unknown>;
        if (typeof alvoId !== "string") return [];
        if (tipo !== "trilha" && tipo !== "curso" && tipo !== "competencia") return [];

        return [
          {
            tipo,
            alvoId,
            ...(typeof nivelExigido === "number" && nivelExigido >= 1
              ? { nivelExigido }
              : {}),
          },
        ];
      })
    : [];

  /* Plano sem exigência não forma ninguém, e a tela mostraria 0% para todo
     mundo sem explicar por quê. É melhor recusar do que publicar um plano que
     ninguém consegue cumprir. */
  if (itens.length === 0) {
    return { status: 400, error: "Escolha ao menos uma trilha, curso ou competência." };
  }

  const tenantId = command.actor.tenantId!;
  const continuaId = opcional(command.continuaId);

  if (continuaId !== null) {
    if (continuaId === planoId) {
      return { status: 400, error: "Um plano não pode continuar a si mesmo." };
    }

    const existentes = await planosDeFormacao(tenantId);
    const porId = new Map<string, PlanoHerdavel>(
      existentes.map((p) => [
        p.id,
        { id: p.id, nome: p.nome, continuaId: p.continuaId, exigencias: p.exigencias },
      ]),
    );

    if (!porId.has(continuaId)) {
      return { status: 400, error: "O plano que este continua não existe." };
    }

    /* O CICLO É RECUSADO NA ESCRITA.

       Só a edição consegue criar um: um plano novo não tem descendentes. Fazer
       JR continuar SÊNIOR quando SÊNIOR já continua JR tornaria a pergunta "o
       que este plano exige" sem resposta.

       A leitura ainda se protege sozinha, para o caso de um dado chegar por
       restauração de backup ou escrita direta no banco. */
    if (planoId !== null && fechariaCiclo(planoId, continuaId, porId)) {
      return { status: 400, error: "Essa herança fecharia um ciclo entre planos." };
    }
  }

  return {
    nome,
    descricao: opcional(command.descricao),
    jobTitle: opcional(command.jobTitle),
    continuaId,
    itens,
  };
}

export async function salvarPlanoUseCase(
  command: SalvarPlanoCommand,
): Promise<SalvarPlanoOutcome> {
  if (!podeGerir(command.actor)) {
    return { status: 403, error: "Só a administração define planos de formação." };
  }

  const validado = await validarPlano(command, null);
  if ("error" in validado) return validado;

  const tenantId = command.actor.tenantId!;

  const id = await criarPlanoComExigencias(
    {
      tenantId,
      nome: validado.nome,
      descricao: validado.descricao,
      jobTitle: validado.jobTitle,
      continuaId: validado.continuaId,
      criadoPor: command.actor.id,
    },
    validado.itens,
  );

  await recordAudit({
    tenantId,
    actorId: command.actor.id,
    actorName: command.actorName,
    /* Um plano define o que uma função inteira precisa fazer: é configuração
       da organização, como a trilha. */
    action: "config_changed",
    target: `plano de formação ${validado.nome}`,
    outcome: "allowed",
  });

  return { status: 201, id };
}

export interface EditarPlanoCommand extends SalvarPlanoCommand {
  planoId: string;
}

export type EditarPlanoOutcome =
  | { status: 200; id: string }
  | { status: 400 | 403 | 404; error: string };

/**
 * Reescreve um plano existente.
 *
 * As exigências são SUBSTITUÍDAS, não somadas: a tela manda a lista inteira, e
 * quem tirou uma marcação espera que ela saia. Somar faria a remoção não
 * funcionar, e a pessoa marcaria e desmarcaria sem entender por que nada muda.
 */
export async function editarPlanoUseCase(
  command: EditarPlanoCommand,
): Promise<EditarPlanoOutcome> {
  if (!podeGerir(command.actor)) {
    return { status: 403, error: "Só a administração define planos de formação." };
  }

  const validado = await validarPlano(command, command.planoId);
  if ("error" in validado) return validado;

  const tenantId = command.actor.tenantId!;

  const alterou = await atualizarPlanoComExigencias(
    tenantId,
    command.planoId,
    {
      nome: validado.nome,
      descricao: validado.descricao,
      jobTitle: validado.jobTitle,
      continuaId: validado.continuaId,
    },
    validado.itens,
  );

  if (!alterou) return { status: 404, error: "Plano não encontrado." };

  await recordAudit({
    tenantId,
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "config_changed",
    target: `plano de formação ${validado.nome}`,
    outcome: "allowed",
  });

  return { status: 200, id: command.planoId };
}

export type ExcluirPlanoOutcome =
  | { status: 200; nome: string }
  | { status: 403 | 404; error: string }
  | { status: 409; error: string; dependentes: string[] };

/**
 * Apaga um plano de formação.
 *
 * RECUSA QUANDO OUTRO PLANO O CONTINUA
 *
 * `extends_plan_id` é `ON DELETE SET NULL`: apagar sem conferir faria cada
 * plano herdeiro perder a herança em silêncio. O PLENO deixaria de exigir o que
 * o JR exigia, e a única pista seria o percentual de todo mundo subindo sem
 * motivo — descoberto, na melhor das hipóteses, quando alguém fosse assumir o
 * posto sem a formação.
 *
 * A recusa NOMEIA os dependentes. "Não é possível excluir" sem dizer o que está
 * no caminho obriga a pessoa a adivinhar, e é o mesmo desenho que
 * `deleteUserAccount` já usa para comentário e curso.
 *
 * Excluir NÃO apaga progresso de ninguém: a formação é derivada do que a pessoa
 * concluiu, e o plano só declara o que se exige.
 */
export async function excluirPlanoUseCase(command: {
  actor: Actor;
  actorName: string;
  planoId: string;
}): Promise<ExcluirPlanoOutcome> {
  if (!podeGerir(command.actor)) {
    return { status: 403, error: "Só a administração define planos de formação." };
  }

  const tenantId = command.actor.tenantId!;
  const dependentes = await planosQueContinuam(tenantId, command.planoId);

  if (dependentes.length > 0) {
    return {
      status: 409,
      error:
        dependentes.length === 1
          ? `${dependentes[0]} continua este plano. Mude a herança dele antes de excluir.`
          : `${dependentes.length} planos continuam este. Mude a herança deles antes de excluir.`,
      dependentes,
    };
  }

  const nome = await excluirPlano(tenantId, command.planoId);

  /* Plano de outro cliente responde como inexistente: a diferença entre "não
     existe" e "não é seu" já é informação (§18). */
  if (nome === null) return { status: 404, error: "Plano não encontrado." };

  await recordAudit({
    tenantId,
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "config_changed",
    target: `plano de formação removido: ${nome}`,
    outcome: "allowed",
  });

  return { status: 200, nome };
}
