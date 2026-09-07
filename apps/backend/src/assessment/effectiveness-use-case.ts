import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { courseGrade, meetsCertificateGrade } from "@nerdlms/core/assessment/gradebook.ts";
import {
  ehVeredito,
  ordemDaFila,
  situacaoDaEficacia,
  type SituacaoDaEficacia,
  type Veredito,
} from "@nerdlms/core/assessment/eficacia.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import {
  candidatosAEficacia,
  donoDaMatricula,
  notasDasMatriculas,
  registrarAvaliacao,
} from "./effectiveness-repository.ts";

import { LIMITE_DE_TEXTO, textoDeEntrada } from "@nerdlms/core/validation/texto.ts";
/**
 * A fila de avaliação de eficácia e o registro dela.
 *
 * Concluir o curso prova que a pessoa assistiu e passou. A eficácia é outra
 * pergunta — "o trabalho mudou?" — e só quem acompanha a pessoa responde. Este
 * caso de uso monta a lista de quem está esperando resposta e grava a que vier.
 */

export interface ItemDaFila {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  learnerName: string;
  learnerProject: string | null;
  concluidoEm: Date;
  situacao: SituacaoDaEficacia;
}

/**
 * Quem concluiu e ainda espera avaliação.
 *
 * O recorte por autoria é o mesmo que decide quem edita o curso: instrutor vê
 * os cursos que assina, administrador vê a organização inteira.
 */
export async function filaDeEficaciaUseCase(
  actor: Actor,
  hoje = new Date(),
): Promise<ItemDaFila[]> {
  if (!actor.tenantId) return [];
  if (actor.role !== "instructor" && actor.role !== "admin") return [];

  const candidatos = await candidatosAEficacia(
    actor.tenantId,
    actor.role === "admin" ? null : actor.id,
  );

  if (candidatos.length === 0) return [];

  /* A NOTA MÍNIMA DECIDE AQUI, NÃO NO SQL.

     Quem viu todas as aulas e reprovou na prova não concluiu o treinamento, e
     avaliar a eficácia de um treinamento que a pessoa não completou não
     significa nada. A regra é a MESMA do certificado — `courseGrade` com
     `meetsCertificateGrade` —, e chamá-la aqui é o que impede as duas telas de
     discordarem sobre quem concluiu. */
  const notas = await notasDasMatriculas(
    actor.tenantId,
    candidatos.map((c) => c.enrollmentId),
  );

  const concluidos = candidatos.filter((candidato) => {
    if (candidato.minGradePercent === null) return true;

    const nota = courseGrade(notas.get(candidato.enrollmentId) ?? []);
    return meetsCertificateGrade(candidato.minGradePercent, nota);
  });

  return ordemDaFila(concluidos).map((candidato) => ({
    enrollmentId: candidato.enrollmentId,
    courseId: candidato.courseId,
    courseTitle: candidato.courseTitle,
    learnerName: candidato.learnerName,
    learnerProject: candidato.learnerProject,
    concluidoEm: candidato.concluidoEm,
    situacao: situacaoDaEficacia({ concluidoEm: candidato.concluidoEm, hoje }),
  }));
}

export interface RegistrarCommand {
  actor: Actor;
  actorName: string;
  enrollmentId: string;
  veredito: unknown;
  observacao: unknown;
}

export type RegistrarOutcome =
  | { status: 201; id: string }
  | { status: 200; jaAvaliada: true }
  | { status: 400 | 403 | 404; error: string };

/** Quantos caracteres a observação precisa ter. O mesmo número está no CHECK da tabela. */
const MINIMO_DA_OBSERVACAO = 10;

export async function registrarEficaciaUseCase(
  command: RegistrarCommand,
): Promise<RegistrarOutcome> {
  const { actor } = command;

  if (!actor.tenantId) return { status: 404, error: "Matrícula não encontrada." };

  if (actor.role !== "instructor" && actor.role !== "admin") {
    return { status: 403, error: "Só o instrutor do curso avalia a eficácia." };
  }

  if (!ehVeredito(command.veredito)) {
    return { status: 400, error: "Escolha um dos vereditos." };
  }

  const observacao = textoDeEntrada(command.observacao, LIMITE_DE_TEXTO) ?? "";

  if (observacao.length < MINIMO_DA_OBSERVACAO) {
    /* O veredito sozinho não responde "por quê" a quem abrir o registro daqui a
       dois anos, e é justamente ele que a auditoria vai querer entender. */
    return { status: 400, error: "Descreva o que foi observado no desempenho." };
  }

  const matricula = await donoDaMatricula(command.enrollmentId);

  /* Matrícula de outro cliente responde igual a matrícula inexistente: a
     diferença entre "não existe" e "não é sua" já é informação (§18). */
  if (!matricula || matricula.tenantId !== actor.tenantId) {
    return { status: 404, error: "Matrícula não encontrada." };
  }

  if (actor.role !== "admin" && matricula.authorId !== actor.id) {
    return { status: 404, error: "Matrícula não encontrada." };
  }

  if (!matricula.concluidoEm) {
    return { status: 400, error: "Esta pessoa ainda não concluiu o curso." };
  }

  const id = await registrarAvaliacao({
    tenantId: actor.tenantId,
    enrollmentId: command.enrollmentId,
    concluidoEm: matricula.concluidoEm,
    veredito: command.veredito satisfies Veredito,
    observacao,
    avaliadoPor: actor.id,
  });

  /* Já havia uma valendo: o índice único parcial recusou. Dois instrutores
     avaliando ao mesmo tempo, ou dois cliques — o resultado é o mesmo, e
     responder erro faria quem clicou achar que perdeu o registro. */
  if (id === null) return { status: 200, jaAvaliada: true };

  /* Evidência de conformidade também é ação de gestão: quem avaliou e quando
     precisa estar na trilha, e não só na própria tabela. `recordAudit` nunca
     lança — a avaliação já está gravada. */
  await recordAudit({
    tenantId: actor.tenantId,
    actorId: actor.id,
    actorName: command.actorName,
    action: "effectiveness_reviewed",
    /* Legível, como o resto da trilha: um uuid de matrícula não diz a ninguém
       de quem e de que curso se está falando. O veredito não entra aqui — o
       `outcome` da auditoria só conhece "allowed" e "denied", e a avaliação em
       si é a fonte, não a cópia. */
    target: `${matricula.learnerName} · ${matricula.courseTitle}`,
    outcome: "allowed",
  });

  return { status: 201, id };
}
