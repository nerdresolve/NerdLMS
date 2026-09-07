import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import { decideProgress } from "@nerdlms/core/courses/progress-update.ts";
import { avancoPossivel, podeConcluirVideo } from "@nerdlms/core/courses/watch-guard.ts";

import {
  addSecondsOnPage,
  findProgressContext,
  recordPageSeen,
  saveProgress,
  setManualCompletion,
} from "./progress-repository.ts";
import { canCompleteContent } from "@nerdlms/core/courses/content.ts";
import { evaluateBadges } from "../badges/badge-use-case.ts";
import { grantCompetenciesForCourse } from "../competencies/competency-use-case.ts";
import { isCourseComplete } from "./progress-repository.ts";
import { emitStatement } from "../xapi/emit.ts";

/**
 * Caso de uso da gravação de progresso.
 *
 * A sequência inteira mora aqui — autorizar, decidir, gravar — para que a rota
 * HTTP não precise conhecer nenhuma etapa. Mesmo desenho do login.
 *
 * A ordem importa: **autoriza antes de decidir**. Checar a regra primeiro e a
 * permissão depois vazaria, pelo tipo do erro, se a aula existe.
 */

export interface ProgressCommand {
  actor: Actor;
  lessonId: string;
  /** Página do documento por onde a pessoa passou (aula de conteúdo). */
  pageSeen?: number;
  /** Segundos de permanência a acumular. */
  secondsOnPage?: number;
  /** Posição alcançada. Ignorada quando `complete` é verdadeiro. */
  watchedSeconds?: number;
  /** `true` quando a pessoa clicou em "concluir aula". */
  complete?: boolean;
}

export type ProgressOutcome =
  | { status: 200; watchedSeconds: number; completed: boolean }
  | { status: 204 }
  | { status: 400 | 403 | 404; error: string };

export async function progressUseCase(command: ProgressCommand): Promise<ProgressOutcome> {
  const context = await findProgressContext({
    learnerId: command.actor.id,
    lessonId: command.lessonId,
  });

  /* 404 também quando existe aula mas não há matrícula: distinguir os casos
     diria quais aulas existem a quem tentar ids na sequência. */
  if (!context) {
    return { status: 404, error: "Aula não encontrada." };
  }

  const allowed = can(command.actor, "update", {
    kind: "progress",
    learnerId: command.actor.id,
    courseAuthorId: context.courseAuthorId,
  });
  if (!allowed) {
    return { status: 403, error: "Sem permissão para registrar progresso nesta aula." };
  }

  /* Aula de conteúdo: registrar por onde a pessoa passou.
     
     É o rastro que libera o botão de concluir — sem ele, qualquer um marcaria
     a aula como lida sem abrir o arquivo. */
  if (command.pageSeen !== undefined || command.secondsOnPage !== undefined) {
    if (command.pageSeen !== undefined) {
      if (!Number.isInteger(command.pageSeen) || command.pageSeen < 1) {
        return { status: 400, error: "Página inválida." };
      }
      await recordPageSeen(context.enrollmentId, command.lessonId, command.pageSeen);
    }

    if (command.secondsOnPage !== undefined && command.secondsOnPage > 0) {
      await addSecondsOnPage(context.enrollmentId, command.lessonId, command.secondsOnPage);
    }

    return { status: 200, watchedSeconds: context.watchedSeconds, completed: context.alreadyCompleted };
  }

  /* Concluir manualmente é um caminho próprio, não um progresso de vídeo.

     Antes, "concluir" gravava a duração inteira como assistida — falsificava o
     consumo para que o cálculo derivasse a conclusão. Isso inflava o relatório
     de consumo (quem clicou em concluir aparecia como tendo assistido tudo) e
     impedia desmarcar. Agora a conclusão é registrada como fato, e o consumo
     fica como está. */
  if (command.complete !== undefined) {
    /* CONCLUIR EXIGE TER CHEGADO AO FIM.
       
       Sem esta checagem no servidor, esconder o botão na tela seria decoração:
       bastaria um POST direto para marcar como concluída uma aula que a pessoa
       nem abriu. É a mesma razão de o bloqueio de liberação progressiva viver
       no servidor (F2-05).
       
       Desmarcar não passa por aqui: quem já concluiu pode voltar atrás. */
    if (command.complete === true && context.contentRule) {
      const decision = canCompleteContent(context.contentRule, {
        pagesSeen: context.pagesSeen,
        seconds: context.secondsOnPage,
      });

      if (!decision.allow) {
        return {
          status: 403,
          error:
            decision.reason === "pages_pending"
              ? `Ainda faltam ${decision.remaining} ${decision.remaining === 1 ? "página" : "páginas"} para concluir.`
              : `Permaneça mais ${decision.remaining}s nesta aula para concluir.`,
        };
      }
    }

    /* AULA DE VÍDEO: concluir exige ter assistido.

       Esta era a brecha. A aula de conteúdo já tinha trava — páginas vistas,
       tempo na página —, e o vídeo não tinha nenhuma: `complete: true` passava
       direto, e bastava clicar em "concluir" no primeiro segundo. Esconder o
       botão na tela seria decoração, pelo mesmo motivo que vale para a aula de
       conteúdo: um POST direto ignora a tela.

       O consumo que sustenta esta checagem é o mesmo que a regra de
       plausibilidade protege lá embaixo. Sem ela, arrastar a barra até o fim
       satisfaria isto aqui — as duas regras só funcionam juntas. */
    if (command.complete === true && !context.contentRule) {
      const veredito = podeConcluirVideo({
        watchedSeconds: context.watchedSeconds,
        durationSeconds: context.durationSeconds,
        travado: context.watchGuard,
      });

      if (!veredito.pode) {
        const faltam = Math.ceil(veredito.faltamSegundos / 60);
        return {
          status: 403,
          error:
            faltam <= 1
              ? "Assista até o fim para concluir esta aula."
              : `Assista mais ${faltam} minutos para concluir esta aula.`,
        };
      }
    }

    await setManualCompletion(
      context.enrollmentId,
      command.lessonId,
      command.complete,
      command.actor.id,
    );

    /* Concluir aula pode fechar um curso, uma trilha ou uma contagem — os três
       critérios de badge que dependem de progresso (F6-01).

       Só ao CONCLUIR, não ao desmarcar: badge conquistado não se perde porque
       alguém desmarcou uma aula. Revogar é decisão de gente, não efeito
       colateral de um clique.

       `evaluateBadges` nunca lança: um badge que falha não pode impedir a
       conclusão que o gerou. */
    if (command.complete && command.actor.tenantId) {
      await evaluateBadges(command.actor.id, command.actor.tenantId);

      /* Competência vem da conclusão do CURSO, não da aula (F6-02).
         
         Um curso desenvolve a competência inteira; uma aula solta dele, não —
         conceder por aula daria "sabe operar uma ETA" a quem viu o primeiro
         vídeo. Por isso a checagem: só quando a última aula fecha o curso.
         
         `grantCompetenciesForCourse` nunca lança, como o badge. */
      /* O LRS registra o que a plataforma faz, não só o que vem de fora
         (F6-03). Sem isto, um relatório de xAPI teria só metade da história. */
      await emitStatement({
        tenantId: command.actor.tenantId,
        userId: command.actor.id,
        verb: "completed",
        objectPath: `/aulas/${command.lessonId}`,
        objectName: context.lessonTitle,
        courseId: context.courseId,
        lessonId: command.lessonId,
        result: { completion: true },
      });

      if (await isCourseComplete(context.enrollmentId, context.courseId)) {
        await grantCompetenciesForCourse(
          command.actor.id,
          command.actor.tenantId,
          context.courseId,
        );

        /* Concluir o CURSO é outro statement, com outro objeto: quem consulta
           o LRS pergunta "quem completou este curso", e a soma de aulas não
           responde isso. */
        await emitStatement({
          tenantId: command.actor.tenantId,
          userId: command.actor.id,
          verb: "completed",
          objectPath: `/cursos/${context.courseSlug}`,
          objectName: context.courseTitle,
          courseId: context.courseId,
          result: { completion: true },
        });
      }
    }

    return { status: 200, watchedSeconds: context.watchedSeconds, completed: command.complete };
  }

  const pedido = command.watchedSeconds ?? Number.NaN;

  /* A POSIÇÃO NÃO PODE ANDAR MAIS RÁPIDO QUE O RELÓGIO.

     Entre dois registros, o avanço é limitado pelo tempo real decorrido vezes
     a velocidade máxima que o player oferece. Pular do segundo 10 para o 3000
     numa requisição é cortado porque é fisicamente impossível — e é
     exatamente o que arrastar a barra até o fim, ou mandar a duração inteira
     por `curl`, tentaria fazer.

     Corta em vez de recusar: o player reenvia a posição a cada janela, e o
     corte se corrige sozinho no envio seguinte, quando o relógio já andou.
     Recusar devolveria erro a quem assiste com rede ruim.

     Sem registro anterior, o decorrido é ZERO — e não "desde sempre". Tratar a
     primeira posição como se houvesse crédito acumulado abriria a porta que
     esta regra fecha: bastaria abrir a aula e mandar a duração. */
  const decorrido = context.progressUpdatedAt
    ? (Date.now() - context.progressUpdatedAt.getTime()) / 1000
    : 0;

  const avanco = avancoPossivel({
    de: context.watchedSeconds,
    para: pedido,
    decorridoSegundos: decorrido,
    travado: context.watchGuard,
  });

  /* CORTOU? NÃO GRAVA NADA.

     A tolerância existe para cobrir a PRIMEIRA posição de uma aula e o jitter
     da rede — não para ser sacada a cada chamada. Gravando o valor cortado, o
     carimbo de tempo avançaria e a requisição seguinte ganharia outra
     tolerância a partir do zero: cem envios instantâneos renderiam mil e
     quinhentos segundos de vídeo sem ninguém assistir a nada. Foi o que o
     teste pelo navegador mostrou — 81% de uma aula de 32 minutos em cem
     requisições, e o teste de unidade não pegou porque eu escolhi o limiar
     olhando o resultado.

     Não gravando, o carimbo continua onde estava, e todas as tentativas
     seguintes medem o decorrido a partir do MESMO instante. A tolerância passa
     a ser por âncora, não por chamada — e insistir deixa de render.

     Devolve 200, não erro: para quem tem rede ruim isto é um envio perdido, e
     o player reenvia na janela seguinte. */
  if (avanco.cortado) {
    return {
      status: 200,
      watchedSeconds: context.watchedSeconds,
      completed: context.alreadyCompleted,
    };
  }

  const target = avanco.aceito;

  const decision = decideProgress(
    { lessonId: command.lessonId, watchedSeconds: target },
    context.durationSeconds,
    context.watchedSeconds,
  );

  if (!decision.accept) {
    /* "Não avançou" não é erro: o player envia posição periodicamente, e
       responder 400 a cada vídeo pausado encheria o console de falha falsa.

       Mas a POSIÇÃO ainda precisa ser gravada. Quem volta para rever um trecho
       e sai não avançou o consumo — e é exatamente essa a pessoa que retomaria
       no lugar errado se a requisição fosse descartada inteira. O consumo fica
       como está (`GREATEST` no upsert protege), só a posição anda para trás. */
    if (decision.reason === "no_progress") {
      const posicao = Math.max(0, Math.min(Math.round(target), context.durationSeconds));

      await saveProgress(
        context.enrollmentId,
        command.lessonId,
        context.watchedSeconds,
        false,
        posicao,
      );

      return { status: 200, watchedSeconds: context.watchedSeconds, completed: context.alreadyCompleted };
    }

    return { status: 400, error: "Posição inválida." };
  }

  /* O consumo só conclui a aula quando o modo dela permite. Aula `manual`
     (leitura, encontro presencial) espera alguém marcar — se o consumo a
     concluísse, o modo não teria efeito nenhum. E o que já foi concluído não
     é reconcluído: reescrever a data apagaria o registro real. */
  const concluiAgora =
    decision.completed && context.completionMode === "auto" && !context.alreadyCompleted;

  const saved = await saveProgress(
    context.enrollmentId,
    command.lessonId,
    decision.watchedSeconds,
    concluiAgora,
    /* Onde o player está agora. Difere do consumo quando a pessoa voltou para
       rever um trecho — e é dali que ela deve retomar. */
    command.watchedSeconds,
  );

  return {
    status: 200,
    watchedSeconds: saved,
    completed: concluiAgora || context.alreadyCompleted,
  };
}
