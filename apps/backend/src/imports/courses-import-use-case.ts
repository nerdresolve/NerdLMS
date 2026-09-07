import { type Actor } from "@nerdlms/core/auth/permissions.ts";
import { parseTable } from "@nerdlms/core/imports/csv-parse.ts";
import { planCoursesImport, type PlanoCursos } from "@nerdlms/core/imports/courses-import.ts";
import { uniqueSlug } from "@nerdlms/core/courses/slug.ts";

import { findCourseSlugs } from "../courses/course-editor-repository.ts";
import { recordAudit } from "../audit/audit-repository.ts";
import { withTransaction } from "../db/pool.ts";

/**
 * Importação de cursos e conteúdo — F5-05 (guia §24).
 *
 * Mesmo desenho das outras: conferir devolve a árvore sem gravar, aplicar
 * grava, e o plano é refeito no servidor.
 *
 * **O curso nasce como RASCUNHO.** Importar não publica: uma planilha traz a
 * estrutura, não os vídeos nem os documentos, e um curso publicado com aulas
 * vazias apareceria no catálogo para quem se matricular abrir e não achar
 * nada. Publicar continua sendo uma decisão de quem revisou o conteúdo.
 */

export interface CoursesImportCommand {
  actor: Actor;
  actorName: string;
  csv: string;
}

export type CoursesPreviewOutcome =
  | { status: 200; plano: PlanoCursos }
  | { status: 400 | 403; error: string };

/** Quem importa curso: instrutor e admin — os mesmos que criam curso. */
function autorizado(actor: Actor): boolean {
  return actor.role === "admin" || actor.role === "instructor";
}

export async function previewCoursesImport(
  command: CoursesImportCommand,
): Promise<CoursesPreviewOutcome> {
  if (!autorizado(command.actor)) {
    return { status: 403, error: "Sem permissão para importar cursos." };
  }

  if (!command.actor.tenantId) {
    return { status: 400, error: "Sessão sem cliente definido." };
  }

  const { headers, rows } = parseTable(command.csv);

  if (headers.length === 0) return { status: 400, error: "O arquivo está vazio." };
  if (rows.length === 0) {
    return { status: 400, error: "O arquivo só tem o cabeçalho, sem nenhuma linha." };
  }

  return { status: 200, plano: planCoursesImport(rows) };
}

export interface AppliedCourses {
  cursos: number;
  modulos: number;
  aulas: number;
  /** Os cursos criados, para a tela poder levar a pessoa até eles. */
  criados: Array<{ id: string; titulo: string; slug: string }>;
}

export type CoursesApplyOutcome =
  | { status: 200; resultado: AppliedCourses }
  | { status: 400 | 403; error: string };

export async function applyCoursesImport(
  command: CoursesImportCommand,
): Promise<CoursesApplyOutcome> {
  const conferido = await previewCoursesImport(command);
  if (conferido.status !== 200) return conferido;

  const tenantId = command.actor.tenantId!;

  /* Os slugs em uso são lidos UMA vez e o conjunto cresce em memória conforme
     os cursos são criados. Reler a cada curso perderia o que acabou de ser
     inserido nesta mesma importação, e duas linhas "NR-10" na mesma planilha
     colidiriam. */
  const slugsUsados = new Set(await findCourseSlugs(tenantId));

  const criados: AppliedCourses["criados"] = [];
  let modulos = 0;
  let aulas = 0;

  for (const curso of conferido.plano.cursos) {
    const slug = uniqueSlug(curso.titulo, slugsUsados);

    /* UMA TRANSAÇÃO POR CURSO.
     *
     * Não uma para a planilha inteira, nem nenhuma. Um curso é uma unidade:
     * curso + módulos + aulas ou nada — sem isto, uma aula recusada pelo banco
     * deixa no catálogo um curso pela metade, que quem se matricular abre e não
     * entende. Por curso, e não pela planilha toda, porque um curso ruim no fim
     * do arquivo não deve desfazer os cinco bons que já entraram. */
    const totais = await withTransaction(async (exec) => {
      const [criado] = await exec<{ id: string }>(
        `INSERT INTO courses (tenant_id, slug, title, summary, author_id, project, status, artwork)
         VALUES ($1, $2, $3, $4, $5, NULL, 'draft',
                 (SELECT count(*) % 4 FROM courses WHERE tenant_id = $1))
         RETURNING id`,
        [tenantId, slug, curso.titulo, curso.resumo, command.actor.id],
      );

      /* `project` nulo: um curso importado é do catálogo do cliente, não de
         um projeto específico — a planilha não traz essa informação. */
      const courseId = criado!.id;
      let modulosDoCurso = 0;
      let aulasDoCurso = 0;

      for (const modulo of curso.modulos) {
        const [moduloCriado] = await exec<{ id: string }>(
          `INSERT INTO modules (course_id, title, position)
           VALUES ($1, $2, (SELECT coalesce(max(position), 0) + 1 FROM modules WHERE course_id = $1))
           RETURNING id`,
          [courseId, modulo.titulo],
        );

        const moduleId = moduloCriado!.id;
        modulosDoCurso += 1;

        for (const aula of modulo.aulas) {
          await exec(
            `INSERT INTO lessons (module_id, title, duration_seconds, position,
                                  kind, text_content, external_url, page_count)
             VALUES ($1, $2, $3,
                     (SELECT coalesce(max(position), 0) + 1 FROM lessons WHERE module_id = $1),
                     $4, $5, $6, $7)`,
            [
              moduleId,
              aula.titulo,
              /* Minutos na planilha, segundos no banco: é a unidade que uma
                 pessoa escreve e a unidade que o produto conta. */
              Math.round(aula.duracaoMinutos * 60),
              aula.formato,
              aula.texto,
              aula.url,
              aula.paginas,
            ],
          );

          aulasDoCurso += 1;
        }
      }

      return { courseId, modulosDoCurso, aulasDoCurso };
    });

    /* O slug só é reservado DEPOIS do commit: reservá-lo antes faria um curso
       que não entrou empurrar o próximo para "-2" sem motivo. */
    slugsUsados.add(slug);

    criados.push({ id: totais.courseId, titulo: curso.titulo, slug });
    modulos += totais.modulosDoCurso;
    aulas += totais.aulasDoCurso;
  }

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "courses_imported",
    target: `${criados.length} ${criados.length === 1 ? "curso" : "cursos"}, ${aulas} ${aulas === 1 ? "aula" : "aulas"}`,
    outcome: "allowed",
  });

  return { status: 200, resultado: { cursos: criados.length, modulos, aulas, criados } };
}
