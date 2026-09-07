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
 * confirmada a matrícula — o mesmo desenho do vídeo da aula (DEC-009).
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

/**
 * Os materiais de uma aula, na ordem em que foram enviados.
 *
 * `lesson_id` aceita nulo desde a 043, e nulo é documento de biblioteca. A
 * igualdade já os exclui — `NULL = $1` nunca é verdadeiro —, e é isso que
 * mantém a biblioteca fora da lista de anexos da aula.
 */
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

/**
 * Registra um material recém-enviado, anexado a uma aula.
 *
 * `tenant_id` passou a ser coluna (migração 043) porque o material de
 * biblioteca não tem aula de onde derivá-lo. Aqui ele vem da própria aula, na
 * mesma inserção: pedi-lo por parâmetro obrigaria vinte chamadas a descobrir o
 * cliente antes, e uma delas esqueceria.
 */
export async function insertMaterial(material: NewMaterial): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO materials (lesson_id, tenant_id, name, kind, size_bytes, storage_key, uploaded_by)
     SELECT $1, c.tenant_id, $2, $3, $4, $5, $6
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE l.id = $1
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

/**
 * Remove o registro e devolve a CHAVE do arquivo, ou `null` se não havia nada.
 *
 * A chave devolvida é o que permite ao chamador apagar o objeto — antes esta
 * função respondia só "removeu?", o comentário dizia que o chamador limparia o
 * storage, e o chamador não tinha como: sem a chave, não há o que apagar.
 */
export async function deleteMaterial(
  lessonId: string,
  materialId: string,
): Promise<string | null> {
  const rows = await query<{ storage_key: string }>(
    `DELETE FROM materials WHERE id = $1 AND lesson_id = $2 RETURNING storage_key`,
    [materialId, lessonId],
  );

  return rows[0]?.storage_key ?? null;
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

/* ---------------------------------------------------------------------------
   Biblioteca de conteúdos
   ---------------------------------------------------------------------------

   Documento que vale por si — procedimento, norma, ficha de segurança — e não
   está pendurado em aula nenhuma. É a MESMA tabela: `lesson_id` nulo é o que
   distingue os dois usos, e assim o upload, o download assinado e a remoção
   continuam sendo um caminho só.
   --------------------------------------------------------------------------- */

export interface DocumentoDaBiblioteca {
  id: string;
  name: string;
  description: string | null;
  kind: LessonMaterial["kind"];
  sizeLabel: string;
  tema: string | null;
}

/** O acervo do cliente, em ordem de nome. */
export async function findBiblioteca(tenantId: string): Promise<DocumentoDaBiblioteca[]> {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    kind: LessonMaterial["kind"];
    size_bytes: string;
    tema: string | null;
  }>(
    `SELECT m.id, m.name, m.description, m.kind, m.size_bytes, cat.name AS tema
       FROM materials m
       LEFT JOIN course_categories cat ON cat.id = m.category_id
      WHERE m.tenant_id = $1
        AND m.lesson_id IS NULL
      ORDER BY m.name`,
    [tenantId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    sizeLabel: formatSize(Number(row.size_bytes)),
    tema: row.tema,
  }));
}

export interface NovoDocumento {
  tenantId: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  kind: LessonMaterial["kind"];
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
}

/** Publica um documento na biblioteca. */
export async function insertDocumento(doc: NovoDocumento): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO materials
       (tenant_id, lesson_id, name, description, category_id, kind, size_bytes,
        storage_key, uploaded_by)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      doc.tenantId,
      doc.name,
      doc.description,
      doc.categoryId,
      doc.kind,
      doc.sizeBytes,
      doc.storageKey,
      doc.uploadedBy,
    ],
  );

  return rows[0]!.id;
}

/**
 * A chave de storage de um documento da biblioteca.
 *
 * O `tenant_id` e o `lesson_id IS NULL` entram na condição pelo mesmo motivo
 * que a aula entra em `findMaterialKey`: sem eles, um id de material bastaria
 * para baixar o anexo de qualquer aula de qualquer cliente por esta rota.
 */
export async function findDocumentoKey(
  tenantId: string,
  materialId: string,
): Promise<string | null> {
  const rows = await query<{ storage_key: string }>(
    `SELECT storage_key
       FROM materials
      WHERE id = $1 AND tenant_id = $2 AND lesson_id IS NULL
      LIMIT 1`,
    [materialId, tenantId],
  );

  return rows[0]?.storage_key ?? null;
}

/** Remove o documento. O arquivo no storage é removido pelo chamador. */
export async function deleteDocumento(
  tenantId: string,
  materialId: string,
): Promise<string | null> {
  const rows = await query<{ storage_key: string }>(
    `DELETE FROM materials
      WHERE id = $1 AND tenant_id = $2 AND lesson_id IS NULL
      RETURNING storage_key`,
    [materialId, tenantId],
  );

  return rows[0]?.storage_key ?? null;
}
