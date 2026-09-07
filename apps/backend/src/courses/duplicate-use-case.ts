import { can, type Actor } from "@nerdlms/core/auth/permissions.ts";
import { slugify } from "@nerdlms/core/courses/metadata.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import { findCourseOwnership } from "./course-editor-repository.ts";
import { duplicateCourse, findSlugsLike } from "./duplicate-repository.ts";

/**
 * Duplicar curso — F2-07.
 *
 * Quem duplica vira AUTOR da cópia, mesmo copiando curso de outra pessoa: a
 * cópia é trabalho novo, e deixá-la com o autor original daria a alguém um
 * curso que não escreveu e não pode editar.
 *
 * Por isso a permissão exigida é `create`, não `update`: duplicar não altera o
 * original, e um instrutor pode partir do curso de um colega para fazer o seu
 * — que é justamente o caso de uso de "curso duplicável" do guia §3.
 */

export interface DuplicateCommand {
  actor: Actor;
  actorName: string;
  courseId: string;
  /** Título da cópia. Vazio usa "<original> (cópia)". */
  title?: string;
}

export type DuplicateOutcome =
  | { status: 201; courseId: string; modules: number; lessons: number }
  | { status: 400 | 403 | 404; error: string };

export async function duplicateCourseUseCase(
  command: DuplicateCommand,
): Promise<DuplicateOutcome> {
  if (!can(command.actor, "create", { kind: "course", authorId: command.actor.id, status: "draft" })) {
    return { status: 403, error: "Sem permissão para criar cursos." };
  }

  const ownership = await findCourseOwnership(command.courseId);
  if (!ownership) return { status: 404, error: "Curso não encontrado." };

  /* Ler o curso a copiar exige poder LÊ-LO. Um rascunho alheio continua
     invisível: sem esta checagem, duplicar seria um jeito de ler o que ainda
     não foi publicado. */
  if (
    !can(command.actor, "read", {
      kind: "course",
      authorId: ownership.authorId,
      status: ownership.status,
    })
  ) {
    return { status: 404, error: "Curso não encontrado." };
  }

  const titulo = command.title?.trim() || `${ownership.title} (cópia)`;

  const base = slugify(titulo);
  if (!base) return { status: 400, error: "O título precisa conter letras ou números." };

  /* Slug livre. O índice único (tenant_id, slug) recusaria o repetido, e
     tentar-e-falhar daria uma mensagem que o instrutor não sabe resolver —
     ele não escolheu o slug. */
  const usados = new Set(await findSlugsLike(ownership.tenantId, base));
  let slug = base;
  for (let n = 2; usados.has(slug) && n < 100; n += 1) slug = `${base}-${n}`;

  const resultado = await duplicateCourse(command.courseId, slug, titulo, command.actor.id);
  if (!resultado) return { status: 400, error: "Não foi possível duplicar o curso." };

  await recordAudit({
    actorId: command.actor.id,
    actorName: command.actorName,
    action: "course_created",
    target: `${titulo} (cópia de ${ownership.title})`,
    outcome: "allowed",
  });

  return {
    status: 201,
    courseId: resultado.courseId,
    modules: resultado.modules,
    lessons: resultado.lessons,
  };
}
