import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import {
  cargaDoCertificado,
  cargaPorExtenso,
  programaDoCurso,
} from "@nerdlms/core/reports/certificate-verso.ts";
import { buildCertificate, certificateCode } from "@nerdlms/core/reports/certificate.ts";
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import { courseGrade, meetsCertificateGrade } from "@nerdlms/core/assessment/gradebook.ts";
import { findGrades } from "../assessment/assignment-repository.ts";
import { notify } from "../notifications/notify.ts";

import { courseSignature } from "../auth/users-repository.ts";
import { findAllCourses, findEnrollments } from "../courses/courses-repository.ts";
import { query } from "../db/pool.ts";

/**
 * Emissão de certificado.
 *
 * A regra que sustenta o documento: **só emite quem concluiu**. Um certificado
 * de curso incompleto não vale nada, e emitir de qualquer forma transformaria o
 * PDF em enfeite.
 */

export interface CertificateCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
}

export type CertificateOutcome =
  | { status: 200; pdf: Uint8Array; filename: string }
  | { status: 403 | 404; error: string };

/**
 * O que se escreve sob o nome de quem assina.
 *
 * O papel guardado no banco é vocabulário de sistema — `instructor`, `admin` —
 * e não cabe num documento impresso. "Instrutor responsável" diz o que a
 * assinatura significa: alguém responde pelo que foi ensinado, e não apenas
 * ministrou a aula.
 */
const TITULO_DE: Record<string, string> = {
  instructor: "Instrutor responsável",
  manager: "Gestor responsável",
  admin: "Responsável pelo treinamento",
  learner: "Responsável pelo curso",
};

export async function certificateUseCase(
  command: CertificateCommand,
): Promise<CertificateOutcome> {
  /* Sem tenant no ator não há o que emitir: o certificado é de um curso, e
     curso pertence a um cliente. Recusar é mais honesto que buscar sem
     recorte e devolver o catálogo de todo mundo. */
  if (!command.actor.tenantId) return { status: 404, error: "Curso não encontrado." };

  const [courses, mine] = await Promise.all([
    findAllCourses(command.actor.tenantId),
    findEnrollments(command.actor.id),
  ]);

  const course = courses.find((item) => item.id === command.courseId);
  const enrollment = mine.find((item) => item.courseId === command.courseId);

  /* Sem matrícula, o curso "não existe" para esta pessoa — mesma resposta de
     curso inexistente, para não revelar o catálogo por tentativa (§18). */
  if (!course || !enrollment) {
    return { status: 404, error: "Curso não encontrado." };
  }

  const summary = courseProgress(course, enrollment);
  if (summary.status !== "completed") {
    return {
      status: 403,
      error: `Conclua as ${summary.total} aulas para emitir o certificado. Faltam ${summary.total - summary.completed}.`,
    };
  }

  /* NOTA MÍNIMA — F3-09.

     Concluir as aulas deixa de bastar quando o curso exige nota. Sem esta
     checagem, o certificado sairia para quem assistiu tudo e reprovou na prova
     — que é exatamente o caso que a exigência existe para impedir.

     Cursos sem exigência declarada seguem como antes: `minGradePercent` nulo
     mantém o comportamento de hoje, e um curso existente não passa a exigir
     prova que ele não tem. */
  if (course.minGradePercent !== undefined) {
    const enrollmentRows = await query<{ id: string }>(
      `SELECT id FROM enrollments WHERE course_id = $1 AND learner_id = $2 LIMIT 1`,
      [command.courseId, command.actor.id],
    );

    const notas = enrollmentRows[0] ? await findGrades(enrollmentRows[0].id) : [];
    const nota = courseGrade(notas);

    if (!meetsCertificateGrade(course.minGradePercent, nota)) {
      return {
        status: 403,
        error:
          nota === null
            ? `Este curso exige nota mínima de ${course.minGradePercent}%. Faça a avaliação para emitir o certificado.`
            : `Sua nota é ${nota}% e o mínimo deste curso é ${course.minGradePercent}%.`,
      };
    }
  }

  /* O id da matrícula gera o código; buscá-lo aqui evita expor a coluna no
     tipo do domínio só por causa do certificado. */
  const rows = await query<{ id: string; completed_at: Date | null }>(
    `SELECT e.id, max(lp.completed_at) AS completed_at
       FROM enrollments e
       LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id
      WHERE e.course_id = $1 AND e.learner_id = $2
      GROUP BY e.id`,
    [command.courseId, command.actor.id],
  );

  const row = rows[0];
  const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const durationSeconds = course.modules
    .flatMap((module) => module.lessons)
    .reduce((total, lesson) => total + lesson.durationSeconds, 0);

  /* Quem assina: o instrutor responsável pelo curso.

     A busca NÃO pode derrubar a emissão. Curso sem autor, autor removido,
     assinatura nunca enviada — nos três casos o certificado sai, com a
     atribuição da plataforma, como saía antes desta mudança. Um documento que
     a pessoa conquistou não deve depender de alguém ter lembrado de subir um
     arquivo. */
  const assinante = await courseSignature(command.courseId);

  /* O verso: conteúdo programático e a ficha que uma auditoria pede.

     A carga prefere a DECLARADA no curso, e cai na soma dos vídeos quando não
     há. As duas medem coisas diferentes, e é a declarada que a área de
     treinamento defende. */
  const carga = cargaDoCertificado(course.workloadMinutes, durationSeconds);
  const programa = programaDoCurso(course);

  /* O endereço de conferência sai do DOMÍNIO DECLARADO PELA INSTALAÇÃO.

     O rodapé trazia um endereço escrito à mão no gerador, e ele não resolve.
     Quem recebe o documento e tenta conferir o código bate numa porta fechada,
     e a conclusão razoável é que o certificado não vale — o oposto do que o
     rodapé existe para provar.

     Nulo quando o cliente ainda não declarou domínio, e nesse caso o
     certificado imprime uma orientação em vez de um endereço inventado. */
  const emissor = await dadosDoEmissor(command.actor.tenantId);

  const pdf = buildCertificate({
    learnerName: command.actorName,
    courseTitle: course.title,
    lessons,
    durationSeconds,
    programa: {
      itens: programa.itens,
      total: programa.total,
      truncado: programa.truncado,
      carga: cargaPorExtenso(carga.minutos),
    },
    validacaoUrl: emissor.validacaoUrl,
    ...(emissor.nome ? { issuer: emissor.nome } : {}),
    completedAt: (row?.completed_at ?? new Date()).toISOString(),
    code: certificateCode(row?.id ?? command.courseId),
    signer: assinante
      ? {
          name: assinante.name,
          title: TITULO_DE[assinante.role] ?? TITULO_DE.instructor!,
          image: assinante.image,
        }
      : null,
  });

  /* Avisa que o certificado saiu (F4-03).

     Depois de gerar, não antes: um aviso de certificado que a geração recusou
     mandaria a pessoa a uma página vazia.

     O aviso repete a cada download — quem baixa duas vezes recebe dois. Vale
     aceitar: o alternativo seria uma tabela de "já avisei", e o certificado é
     baixado uma vez na prática. */
  await notify({
    userId: command.actor.id,
    kind: "certificate_issued",
    title: `Seu certificado de ${course.title} está pronto`,
    body: `Você concluiu ${course.title} e o certificado já pode ser baixado.`,
    link: `/cursos/${course.slug}`,
    values: { curso: course.title },
  });

  return {
    status: 200,
    pdf,
    filename: `certificado-${course.slug}.pdf`,
  };
}

export interface VerifiedCertificate {
  learnerName: string;
  courseTitle: string;
  lessons: number;
  durationSeconds: number;
  completedAt: string;
  code: string;
}

/**
 * Confere um código de verificação.
 *
 * O certificado promete que o código pode ser conferido; sem esta consulta a
 * promessa era vazia. Quem recebe o PDF — um gestor, um cliente — precisa de
 * um jeito de saber se aquilo é real.
 *
 * É PÚBLICO, sem sessão: quem confere um certificado normalmente não tem
 * conta na plataforma. Por isso devolve só o que já está impresso no papel —
 * nome, curso, carga e data. Nada de e-mail, id ou progresso: o documento não
 * traz esses dados, e a conferência não pode revelar mais que ele.
 *
 * O código sai dos 12 primeiros dígitos hexadecimais do id da matrícula, então
 * a consulta compara pelo mesmo recorte. Não é adivinhável na prática (são
 * 16^12 combinações), e um código inválido responde exatamente como um código
 * de curso não concluído: `null`.
 */
export async function verifyCertificateUseCase(
  rawCode: string,
): Promise<VerifiedCertificate | null> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(code)) return null;

  const rows = await query<{
    learner_name: string;
    course_id: string;
    tenant_id: string;
    completed_at: Date | null;
  }>(
    `SELECT u.full_name AS learner_name, e.course_id, u.tenant_id,
            max(lp.completed_at) AS completed_at
       FROM enrollments e
       JOIN users u ON u.id = e.learner_id
       LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id
      WHERE upper(left(replace(e.id::text, '-', ''), 12)) = $1
      GROUP BY e.id, u.full_name, u.tenant_id
      LIMIT 1`,
    [code],
  );

  const row = rows[0];
  if (!row) return null;

  /* A validação é pública e não tem sessão: o tenant vem da própria matrícula
     que o código identifica. É o único caminho — pedir tenant a quem confere
     um certificado inverteria o sentido da conferência. */
  const courses = await findAllCourses(row.tenant_id);
  const course = courses.find((item) => item.id === row.course_id);
  if (!course) return null;

  /* Confere a conclusão, não confia no código.
     Uma matrícula existe desde a inscrição, e o código deriva dela — sem esta
     checagem, um código montado a partir de uma matrícula em andamento
     validaria um certificado que nunca foi emitido. */
  const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const concluidas = await query<{ total: string }>(
    `SELECT count(*) AS total
       FROM lesson_progress lp
       JOIN enrollments e ON e.id = lp.enrollment_id
      WHERE upper(left(replace(e.id::text, '-', ''), 12)) = $1
        AND lp.completed_at IS NOT NULL`,
    [code],
  );

  if (Number(concluidas[0]?.total ?? 0) < lessons || lessons === 0) return null;

  /* E CONFERE A NOTA, quando o curso exige uma.

     A checagem das aulas sozinha deixou de bastar no dia em que o certificado
     passou a depender de prova: a emissão recusava por falta de nota e esta
     página diria "válido" para a mesma matrícula. Quem reprovasse poderia
     divulgar o código e a conferência confirmaria um documento que nunca foi
     emitido, que é o oposto do que ela existe para fazer.

     A regra é a MESMA de `meetsCertificateGrade`, usada na emissão. Duas
     definições de "concluiu" divergiriam, e a que ficasse para trás atestaria
     o que a outra nega. */
  if (course.minGradePercent !== undefined) {
    const matricula = await query<{ id: string }>(
      `SELECT e.id FROM enrollments e
        WHERE upper(left(replace(e.id::text, '-', ''), 12)) = $1
        LIMIT 1`,
      [code],
    );

    const notas = matricula[0] ? await findGrades(matricula[0].id) : [];

    if (!meetsCertificateGrade(course.minGradePercent, courseGrade(notas))) return null;
  }

  return {
    learnerName: row.learner_name,
    courseTitle: course.title,
    lessons,
    durationSeconds: course.modules
      .flatMap((module) => module.lessons)
      .reduce((total, lesson) => total + lesson.durationSeconds, 0),
    completedAt: (row.completed_at ?? new Date()).toISOString(),
    code,
  };
}

/**
 * O endereço de conferência desta instalação, ou nulo.
 *
 * Sem `https://` no papel: o rodapé é lido por uma pessoa, não clicado, e o
 * esquema só ocuparia espaço numa linha que já é apertada.
 */
async function dadosDoEmissor(
  tenantId: string,
): Promise<{ validacaoUrl: string | null; nome: string | null }> {
  const linhas = await query<{ domain: string | null; name: string | null }>(
    `SELECT domain, name FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId],
  );

  const dominio = linhas[0]?.domain?.trim();
  return {
    validacaoUrl: dominio ? `${dominio}/validar` : null,
    /* O nome vai impresso na linha de assinatura quando o curso não tem
       instrutor. Nulo aqui faz o certificado cair no nome do produto — ver
       `CertificateData.issuer`. */
    nome: linhas[0]?.name?.trim() || null,
  };
}
