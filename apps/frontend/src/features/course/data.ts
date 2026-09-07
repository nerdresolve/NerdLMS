import "server-only";

import { findAllCourses, findEnrollments } from "@nerdlms/backend/courses/courses-repository.ts";
import { findQuizzes } from "@nerdlms/backend/assessment/quiz-repository.ts";
import { estadoDasProvas } from "@nerdlms/backend/assessment/retake-repository.ts";
import { acaoDoAluno, aprovado, notaDeDez, type AcaoDoAluno } from "@nerdlms/core/assessment/retake.ts";
import { estadoDoCurso, type EstadoDoCurso } from "@nerdlms/core/courses/completion.ts";
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import { courseOutline, type CourseOutline } from "@nerdlms/core/courses/outline.ts";
import { can } from "@nerdlms/core/auth/permissions.ts";
import { actorOf, requireUser, toDisplayUser } from "@/lib/auth/session.ts";
import type { Course, Enrollment, User } from "@nerdlms/core/courses/types.ts";

export interface CoursePageData {
  student: User;
  course: Course;
  /**
   * Quem pode editar o curso vê, na aba Sobre, o que falta preencher.
   *
   * O aluno não vê: a lista de campos em branco sugeriria que o curso está
   * incompleto, e ele não tem o que fazer com essa informação.
   */
  podeEditar: boolean;
  outline: CourseOutline;
  /** `false` quando a pessoa está só visitando: a tela troca o call to action. */
  enrolled: boolean;
  /** Estado do marcador. Sem matrícula não há onde guardar, então é `false`. */
  saved: boolean;
  /**
   * A prova do curso, quando há uma.
   *
   * A prova EXISTIA e nenhuma tela levava até ela: o caminho `/provas/[id]`
   * respondia, e não havia como chegar lá sem digitar o endereço. Recurso sem
   * porta de entrada é recurso que não existe para quem usa.
   */
  quiz: {
    id: string;
    title: string;
    /** Nota mínima na escala de dez, que é a escala da regra. */
    notaMinima: number;
    questions: number;
    /** O que este aluno pode fazer agora — ver `acaoDoAluno`. */
    acao: AcaoDoAluno["tipo"];
    /**
     * Quantas aulas ainda faltam para a prova liberar.
     *
     * Zero significa liberada. O número vem para a tela poder DIZER o que falta
     * em vez de só desabilitar o botão: "faltam 3 aulas" resolve, "indisponível"
     * manda a pessoa adivinhar.
     */
    aulasRestantes: number;
    /** Melhor nota já obtida, em escala de dez. Nulo se nunca fez. */
    melhorNota: number | null;
  } | null;
  /** O curso está fechado? Aulas em dia NÃO bastam quando há prova. */
  estado: EstadoDoCurso;
}

/**
 * Camada de dados da página de curso.
 *
 * Retorna null quando o curso não existe, quando o papel não pode lê-lo ou
 * quando não há matrícula — a resposta é a mesma nos três casos, para que um
 * curso inacessível não possa ser distinguido de um inexistente
 * (/§18).
 */
export async function getCoursePageData(slug: string): Promise<CoursePageData | null> {
  const user = await requireUser();
  const [courses, mine] = await Promise.all([findAllCourses(user.tenant.id), findEnrollments(user.id)]);
  const actor = actorOf(user);

  const course = courses.find((item) => item.slug === slug);
  if (!course) return null;

  /* `findEnrollments(user.id)` já recortou por pessoa, então basta achar o
     curso — filtrar por aluno de novo seria redundante e daria a impressão de
     que a consulta traz gente demais.

     Vem ANTES da checagem porque a permissão depende dela: curso arquivado
     continua legível para quem já o cursava. */
  const enrollment = mine.find((item) => item.courseId === course.id);

  // Rascunho só aparece para quem pode lê-lo; para os demais é como se não
  // existisse — nunca um 403 que confirme a existência do curso.
  if (
    !can(actor, "read", {
      kind: "course",
      authorId: course.authorId,
      status: course.status,
      enrolled: enrollment !== undefined,
    })
  ) {
    return null;
  }

  /* Sem matrícula a página ABRE, com o conteúdo do curso e progresso zerado.
     Antes devolvia `null` aqui, e isso virava 404: o catálogo lista todo curso
     publicado, mas clicar num que a pessoa ainda não cursava levava a "página
     não encontrada". Valia para o aluno em curso que não fazia e para
     instrutor, gestor e admin em TODOS os cursos, já que ninguém desses tem
     matrícula. A permissão de leitura foi checada logo acima; matrícula diz
     respeito a progresso, não a acesso. */
  const visitante: Enrollment = {
    courseId: course.id,
    learnerId: user.id,
    enrolledBy: "self",
    progress: {},
  };

  /* Só a primeira: o modelo aceita várias por curso, e a tela mostra a prova
     final. Quando houver mais de uma, isto vira lista — e a decisão de como
     apresentá-las é de quem desenhar essa tela, não deste recorte. */
  const provas = await findQuizzes(course.id);
  const prova = provas[0];

  /* O estado da prova DESTE aluno. Sem matrícula não há tentativa nem pedido,
     e o mapa vem vazio — que é a resposta certa para quem só visita. */
  const estadoDasSuasProvas = enrollment ? await estadoDasProvas(user.id) : new Map();
  const minhaProva = estadoDasSuasProvas.get(course.id);

  const aulas = courseProgress(course, enrollment ?? visitante);

  const acao = minhaProva
    ? acaoDoAluno({
        tentativasUsadas: minhaProva.tentativasUsadas,
        retestesAprovados: minhaProva.retestesAprovados,
        pedidoPendente: minhaProva.pedidoPendente,
        jaAprovado:
          minhaProva.melhorPercentual !== null && aprovado(minhaProva.melhorPercentual),
      })
    : { tipo: "fazer" as const };

  return {
    student: toDisplayUser(user),
    course,
    /* Quem pode editar o curso vê, na aba Sobre, o que ainda falta preencher.
       A mesma pergunta que o editor faria, respondida pela regra de domínio em
       vez de por uma comparação de papel na tela. */
    podeEditar: can(actor, "update", {
      kind: "course",
      authorId: course.authorId,
      status: course.status,
    }),
    outline: courseOutline(course, enrollment ?? visitante),
    enrolled: enrollment !== undefined,
    saved: enrollment?.saved === true,
    /* A MESMA regra do certificado. Se as duas divergissem, o curso fecharia
       por um caminho e o documento seria recusado pelo outro — que é
       exatamente o defeito que isto corrige. */
    estado: estadoDoCurso(aulas, {
      notaMinima: course.minGradePercent ?? null,
      melhorPercentual: minhaProva?.melhorPercentual ?? null,
    }),
    quiz: prova
      ? {
          id: prova.id,
          title: prova.title,
          notaMinima: notaDeDez(Number(prova.passingScore)),
          questions: prova.questionCount ?? 0,
          acao: acao.tipo,
          /* A prova é o fim do curso. O servidor já recusa quem não terminou
             as aulas; a tela precisa saber disso para não OFERECER o que será
             recusado — botão que leva a uma tela de erro é promessa quebrada. */
          aulasRestantes: Math.max(0, aulas.total - aulas.completed),
          melhorNota:
            minhaProva?.melhorPercentual === null || minhaProva?.melhorPercentual === undefined
              ? null
              : notaDeDez(minhaProva.melhorPercentual),
        }
      : null,
  };
}
