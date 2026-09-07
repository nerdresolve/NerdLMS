import { query } from "../db/pool.ts";
import type { LessonMaterial } from "@nerdlms/core/courses/types.ts";

/**
 * Materiais de apoio da aula — F1-04.
 *
 * A tabela existe desde a 001 e estava vazia: a tela lia de um mock. Aqui ela
 * passa a ler do banco.
 *
 * O arquivo em si nunca é público. `storage_key` é a chave no object storage, e
 * o download sai por URL assinada com validade curta, emitida só depois de
 * confirmada a matrícula — o mesmo desenho do vídeo da aula.
 */

interface MaterialRow {
  id: string;
  name: string;
  kind: LessonMaterial["kind"];
  size_bytes: string;
  storage_key: string;
}

/**
 * Tamanho legível, no padrão pt-BR.
 *
 * O domínio expõe `sizeLabel` já formatado porque o número cru não serve para
 * nada na tela, e formatar em três lugares diferentes garantiria três formatos
 * diferentes.
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    /* Uma casa decimal: "2,4 MB" informa, "2,437 MB" só ocupa espaço. */
    return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
}

/** Os materiais de uma aula, na ordem em que foram enviados. */
export async function findMaterials(lessonId: string): Promise<LessonMaterial[]> {
  const rows = await query<MaterialRow>(
    `SELECT id, name, kind, size_bytes, storage_key
       FROM materials
      WHERE lesson_id = $1
      ORDER BY created_at`,
    [lessonId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    /* `size_bytes` é bigint, e o driver o entrega como string para não perder
       precisão em número grande. Converter aqui é seguro: nenhum material de
       apoio chega perto do limite do float. */
    sizeLabel: formatSize(Number(row.size_bytes)),
  }));
}

/**
 * A chave de storage de um material, se ele pertencer à aula informada.
 *
 * A aula entra na condição de propósito: sem ela, quem soubesse um id de
 * material baixaria o arquivo de qualquer aula, e a checagem de matrícula que
 * a rota faz sobre a AULA não protegeria nada.
 */
export async function findMaterialKey(
  lessonId: string,
  materialId: string,
): Promise<string | null> {
  const rows = await query<{ storage_key: string }>(
    `SELECT storage_key FROM materials WHERE id = $1 AND lesson_id = $2 LIMIT 1`,
    [materialId, lessonId],
  );

  return rows[0]?.storage_key ?? null;
}

export interface NewMaterial {
  lessonId: string;
  name: string;
  kind: LessonMaterial["kind"];
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
}

/** Registra um material recém-enviado. */
export async function insertMaterial(material: NewMaterial): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO materials (lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      material.lessonId,
      material.name,
      material.kind,
      material.sizeBytes,
      material.storageKey,
      material.uploadedBy,
    ],
  );

  return rows[0]!.id;
}

/** Remove o registro. O arquivo no storage é removido pelo chamador. */
export async function deleteMaterial(lessonId: string, materialId: string): Promise<boolean> {
  const rows = await query<{ storage_key: string }>(
    `DELETE FROM materials WHERE id = $1 AND lesson_id = $2 RETURNING storage_key`,
    [materialId, lessonId],
  );

  return rows.length > 0;
}

/**
 * O curso a que a aula pertence.
 *
 * Anexar material é editar o conteúdo do curso, e a permissão é sobre ele — a
 * aula sozinha não tem dono. Uma consulta só, com as duas junções, em vez de
 * pedir o módulo e depois o curso.
 */
export async function findLessonCourse(lessonId: string): Promise<string | null> {
  const rows = await query<{ course_id: string }>(
    `SELECT m.course_id
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE l.id = $1
      LIMIT 1`,
    [lessonId],
  );

  return rows[0]?.course_id ?? null;
}
