import "server-only";

import { findComments } from "@nerdlms/backend/courses/comment-repository.ts";
import { findMaterials } from "@nerdlms/backend/courses/material-repository.ts";
import { findEnrollmentId } from "@nerdlms/backend/assessment/enrollment-lookup.ts";
import {
  find2004Tracking,
  findPackageByLesson,
  findTracking,
} from "@nerdlms/backend/scorm/scorm-repository.ts";
import type { ScormInitial } from "@/features/lesson/scorm-player.tsx";
import { presignDownload } from "@nerdlms/backend/storage/object-storage.ts";
import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { lessonView, type LessonView } from "@nerdlms/core/courses/lesson.ts";
import { lessonUnlockState } from "@nerdlms/core/courses/unlock.ts";
import { findLessonRules } from "@nerdlms/backend/courses/unlock-repository.ts";
import type { Comment, Course, Enrollment, LessonMaterial, User } from "@nerdlms/core/courses/types.ts";

/** Hoje em ISO local, para a regra de data. */
function hojeISO(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** Aula existente, mas ainda fechada para esta pessoa. */
export interface LessonBlocked {
  blocked: true;
  reason: string;
  courseId: string;
}

/**
 * O pacote SCORM da aula, pronto para o player.
 *
 * Devolve objeto vazio quando não é SCORM — o `spread` no chamador some
 * sozinho, e a alternativa seria um `if` que duplicaria o retorno inteiro.
 */
async function scormFor(
  lessonId: string,
  enrollment: Enrollment,
  learnerId: string,
  podeEditar: boolean,
): Promise<{ scorm?: { src: string; initial: ScormInitial } }> {
  const pacote = await findPackageByLesson(lessonId);
  if (!pacote) return {};

  /* O ACOMPANHAMENTO PERTENCE À MATRÍCULA.

     `scorm_tracking` é gravado por matrícula: é onde ficam o progresso, a nota
     e o `suspend_data`. Sem matrícula não há onde gravar.

     Quem faz o curso PRECISA de matrícula — abrir o conteúdo sem ela deixaria
     o pacote rodando e nada sendo registrado, e a pessoa descobriria ao voltar
     e encontrar tudo do zero.

     Quem EDITA o curso, não: ele precisa conferir o que publicou, e conferir
     não é fazer o curso. Aí o conteúdo abre em pré-visualização — roda igual,
     e o que ele fizer não é gravado em lugar nenhum. Sem isto, publicar um
     pacote e olhar o resultado exigiria se matricular no próprio curso, o que
     sujaria os relatórios de conclusão com o nome do instrutor. */
  const enrollmentId = await findEnrollmentId(enrollment.courseId, learnerId);
  if (!enrollmentId && !podeEditar) return {};

  const src = await presignDownload(`${pacote.storagePrefix}${pacote.entryPoint}`);

  /* A versão do pacote decide o vocabulário inteiro — qual API o player
     instala, quais colunas o servidor grava. Ler o acompanhamento errado
     devolveria campos nulos, e o conteúdo começaria do zero achando que nunca
     foi aberto. */
  /* Sem matrícula é pré-visualização: o conteúdo começa do zero e o que
     acontecer nele não tem onde ser gravado. Buscar o acompanhamento de uma
     matrícula que não existe traria o estado de outra pessoa ou um erro. */
  const initial: ScormInitial = !enrollmentId
    ? pacote.version === "2004"
      ? {
          version: "2004",
          state: {
            completionStatus: "not attempted",
            successStatus: "unknown",
            totalTimeSeconds: 0,
            exit: "",
          },
        }
      : { version: "1.2", state: { lessonStatus: "not attempted", totalTimeSeconds: 0 } }
    : pacote.version === "2004"
      ? { version: "2004", state: await find2004Tracking(pacote.id, enrollmentId) }
      : { version: "1.2", state: await findTracking(pacote.id, enrollmentId) };

  return { scorm: { src, initial } };
}

export interface LessonPageData {
  student: User;
  course: Course;
  view: LessonView;
  mediaSrc: string;
  materials: LessonMaterial[];
  comments: Comment[];
  scorm?: { src: string; initial: ScormInitial };
}

/**
 * Camada de dados da aula.
 *
 * Retorna null para aula inexistente E para aula sem matrícula — a resposta
 * precisa ser indistinguível, senão o 404 vira um oráculo que revela quais
 * aulas existem.
 *
 * `mediaSrc` será a URL assinada com TTL curto emitida aqui, depois de
 * confirmada a matrícula ( / ). Até lá aponta para o arquivo
 * de demonstração, que só existe em desenvolvimento.
 */
export async function getLessonPageData(
  lessonId: string,
): Promise<LessonPageData | LessonBlocked | null> {
  const user = await requireUser();
  const [courses, mine] = await Promise.all([findAllCourses(user.tenant.id), findEnrollments(user.id)]);

  const actor = actorOf(user);

  for (const course of courses) {
    /* O filtro era por matrícula, e isso virava 404 em toda aula de curso que
       a pessoa ainda não cursava — inclusive para instrutor, gestor e admin,
       que não têm matrícula em curso nenhum. Quem manda é a permissão de
       leitura: rascunho continua invisível para quem não é o autor, e trocar
       o id na URL segue sem abrir o que o papel não pode ver.
       A matrícula passa a decidir o progresso mostrado — e, em curso
       arquivado, também o acesso: quem já cursava continua entrando. */
    const matriculado = mine.some((item) => item.courseId === course.id);

    if (
      !can(actor, "read", {
        kind: "course",
        authorId: course.authorId,
        status: course.status,
        enrolled: matriculado,
      })
    ) {
      continue;
    }

    const enrollment: Enrollment = mine.find((item) => item.courseId === course.id) ?? {
      courseId: course.id,
      learnerId: user.id,
      enrolledBy: "self",
      progress: {},
    };

    const view = lessonView(course, enrollment, lessonId);
    if (view) {
      /* Liberação progressiva (F2-05): a aula bloqueada não abre nem por URL
         direta. Sem esta checagem no SERVIDOR, esconder o link na trilha seria
         decoração — bastaria digitar o endereço.

         Instrutor e admin passam: quem edita o curso precisa ver o conteúdo
         inteiro para revisá-lo, e a regra existe para guiar o aluno. */
      const ehAluno = user.role === "learner";

      if (ehAluno && matriculado) {
        const regras = await findLessonRules(lessonId);
        const estado = lessonUnlockState(course, enrollment, lessonId, regras, hojeISO());

        if (!estado.unlocked) {
          return { blocked: true, reason: estado.reason, courseId: course.id };
        }
      }

      return {
        student: toDisplayUser(user),
        course,
        view,
        /* URL assinada quando a aula tem arquivo; o clipe de demonstração
           cobre as aulas do seed, que ainda não têm vídeo próprio. A
           assinatura é emitida DEPOIS da checagem de permissão acima, e vale
           uma hora — o arquivo não é público em momento algum. */
        mediaSrc: view.lesson.mediaKey
          ? await presignDownload(view.lesson.mediaKey)
          : "/media/aula-demo.mp4",
        /* Vinha do mock até a F1-04. O download não sai daqui: a tela recebe
           só nome, tipo e tamanho, e a URL assinada é emitida por rota
           própria, no clique — assinar tudo de antemão criaria links válidos
           para arquivos que ninguém vai abrir. */
        /* O pacote SCORM, quando a aula é uma. A URL do ponto de entrada é
           assinada como o vídeo: o conteúdo não é público, e os arquivos
           internos que ele carrega saem do mesmo prefixo. */
        ...(await scormFor(
          lessonId,
          enrollment,
          user.id,
          can(actorOf(user), "update", {
            kind: "course",
            authorId: course.authorId,
            status: course.status === "published" ? "published" : "draft",
          }),
        )),
        materials: await findMaterials(lessonId),
        comments: await findComments(lessonId, user.id),
      };
    }
  }

  return null;
}
