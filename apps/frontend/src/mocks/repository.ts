/**
 * A costura entre as telas e a origem dos dados.
 *
 * Toda camada de dados de feature importa **daqui**, nunca de `data.ts`.
 * Quando o PostgreSQL entrar, este arquivo passa a consultar o
 * banco e `src/mocks/data.ts` é apagado — nenhuma tela muda.
 *
 * Enquanto isso, é um reexport puro. A indireção existe exatamente para que a
 * remoção do mock seja uma operação de um arquivo.
 *
 * **O que ainda sai daqui:** comentários, materiais, trilhas, eventos, avisos e
 * auditoria — as tabelas existem e nada escreve nelas. Curso, matrícula,
 * progresso e usuário já vêm do PostgreSQL.
 *
 * A ponte `mockIdOf` foi removida: o id da sessão é o id do banco, e não há
 * mais dois mundos para conciliar.
 *
 * O que ainda sai do mock traz id curto (`"c1"`, `"c1m3-l5"`), enquanto o que
 * vem do banco traz UUID. `tracks` e `materials` são consumidos junto com
 * dados do banco e precisam ser traduzidos aqui: sem isso a trilha não achava
 * nenhum curso (jornada vazia, "0 de 0") e nenhuma aula achava seus materiais.
 */

import { materials as rawMaterials, tracks as rawTracks } from "./data.ts";
import { uuidForMockId } from "./seed-ids.ts";

/** Trilhas com os cursos apontando para o id que o banco usa. */
export const tracks = rawTracks.map((track) => ({
  ...track,
  courseIds: track.courseIds.map((id) => uuidForMockId(id)),
}));

/** Materiais chaveados pelo id de aula do banco. */
export const materials = Object.fromEntries(
  Object.entries(rawMaterials).map(([lessonId, list]) => [uuidForMockId(lessonId), list]),
) as typeof rawMaterials;

export {
  admin,
  allCourses,
  allEnrollments,
  allUsers,
  auditEvents,
  classEnrollments,
  catalogOnly,
  comments,
  courses,
  enrollments,
  events,
  instructors,
  learners,
  manager,
  notifications,
  student,
} from "./data.ts";
