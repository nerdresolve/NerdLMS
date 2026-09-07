import type { Actor } from "@nerdlms/core/auth/permissions.ts";
import { buildCertificate, certificateCode } from "@nerdlms/core/reports/certificate.ts";
import { courseProgress } from "@nerdlms/core/courses/progress.ts";
import { courseGrade, meetsCertificateGrade } from "@nerdlms/core/assessment/gradebook.ts";
import { findGrades } from "../assessment/assignment-repository.ts";
import { notify } from "../notifications/notify.ts";

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

  const pdf = buildCertificate({
    learnerName: command.actorName,
    courseTitle: course.title,
    lessons,
    durationSeconds,
    completedAt: (row?.completed_at ?? new Date()).toISOString(),
    code: certificateCode(row?.id ?? command.courseId),
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
