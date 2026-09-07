/**
 * Metadados de curso e categorias — F2-01 e F2-03.
 *
 * Funções puras: a mesma regra vale no editor (validando antes de gravar), na
 * página do curso (exibindo) e no catálogo (filtrando).
 */

import type { CourseCategory, CourseCategoryRef, CourseLevel } from "./types.ts";

export const LEVEL_LABEL: Record<CourseLevel, string> = {
  basic: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

/**
 * Carga horária declarada, para leitura.
 *
 * Devolve `null` quando não há carga: a tela mostra outra coisa nesse caso, e
 * "0h" faria um curso sem metadado parecer um curso vazio.
 */
export function formatWorkload(minutes: number | undefined): string | null {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null;

  const horas = Math.floor(minutes / 60);
  const resto = Math.round(minutes % 60);

  if (horas === 0) return `${resto}min`;
  /* "1h" e não "1h00": o zero à direita não informa nada. */
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

/**
 * Texto → slug.
 *
 * Devolve `null` quando não sobra nada utilizável. Um slug vazio violaria o
 * `CHECK (slug ~ '^[a-z0-9-]+$')` do banco, e um erro de restrição é uma
 * resposta pior do que "escolha outro nome".
 */
export function slugify(texto: string): string | null {
  const limpo = texto
    .normalize("NFD")
    /* Remove os diacríticos que o NFD separou das letras. */
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return limpo === "" ? null : limpo;
}

/**
 * Forma canônica de uma tag, para comparação.
 *
 * "NR-10", "NR10" e "nr 10" são a mesma tag escrita de três jeitos. Sem esta
 * normalização o instrutor cria as três sem perceber, e o filtro do catálogo
 * passa a devolver um terço dos cursos em cada uma.
 *
 * Separadores somem inteiramente aqui — ao contrário do slug, onde viram
 * hífen: "nr10" e "nr-10" precisam COLIDIR, e com hífen não colidiriam.
 */
export function normalizeTagName(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Um objetivo por linha, sem as vazias. */
export function objectiveLines(texto: string | undefined): string[] {
  if (!texto) return [];
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "");
}

export interface MetadataInput {
  code?: string | undefined;
  workloadMinutes?: number | undefined;
  language?: string | undefined;
  startsOn?: string | undefined;
  endsOn?: string | undefined;
}

/**
 * O que impede de gravar.
 *
 * Espelha os CHECKs da migration 007 de propósito. A duplicação é deliberada:
 * o banco é a garantia, e esta função é a mensagem — sem ela o instrutor
 * receberia um erro de restrição em vez de "o encerramento não pode ser antes
 * do início".
 */
export function validateMetadata(input: MetadataInput): string[] {
  const erros: string[] = [];

  if (input.code !== undefined && input.code !== "") {
    if (input.code !== input.code.trim() || /\s/.test(input.code)) {
      erros.push("O código não pode conter espaços.");
    }
  }

  if (input.workloadMinutes !== undefined) {
    if (!Number.isFinite(input.workloadMinutes) || input.workloadMinutes <= 0) {
      erros.push("A carga horária precisa ser maior que zero.");
    }
  }

  if (input.language !== undefined && input.language !== "") {
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(input.language)) {
      erros.push("O idioma precisa estar no formato pt-BR ou en.");
    }
  }

  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
    /* Datas ISO comparam como texto — é a razão de o formato ser AAAA-MM-DD. */
    erros.push("A data de encerramento não pode ser anterior à de início.");
  }

  return erros;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  /** Cursos publicados NESTA categoria, sem contar as filhas. */
  courseCount: number;
}

/**
 * Linhas do banco → árvore de navegação.
 *
 * Duas garantias que parecem detalhe e não são:
 *
 * - **contagem acumulada**: quem clica em "Segurança" espera ver os cursos de
 *   "Segurança › Elétrica" também. Sem somar as descendentes, a categoria mãe
 *   aparece com menos cursos do que realmente oferece;
 *
 * - **nada some**. Uma categoria cujo pai não veio na consulta — apagado numa
 *   corrida, ou fora do recorte — vira raiz em vez de desaparecer. Sumir em
 *   silêncio esconderia cursos do catálogo, e ninguém saberia por quê.
 */
export function buildCategoryTree(rows: CategoryRow[]): CourseCategory[] {
  const porId = new Map<string, CourseCategory>();

  for (const row of rows) {
    porId.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      children: [],
      courseCount: row.courseCount,
    });
  }

  const raizes: CourseCategory[] = [];
  const posicao = new Map(rows.map((row) => [row.id, row.position]));

  for (const row of rows) {
    const no = porId.get(row.id)!;
    const pai = row.parentId ? porId.get(row.parentId) : undefined;

    if (pai && pai !== no) {
      no.parentName = pai.name;
      pai.children.push(no);
    } else {
      raizes.push(no);
    }
  }

  const ordenar = (lista: CourseCategory[]) => {
    lista.sort((a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0));
    for (const item of lista) ordenar(item.children);
  };

  ordenar(raizes);

  /* A soma sobe da folha para a raiz. `visitados` protege contra ciclo: dado
     corrompido não pode derrubar o catálogo inteiro numa recursão infinita. */
  const visitados = new Set<string>();

  const acumular = (no: CourseCategory): number => {
    if (visitados.has(no.id)) return 0;
    visitados.add(no.id);

    for (const filho of no.children) no.courseCount += acumular(filho);
    return no.courseCount;
  };

  for (const raiz of raizes) acumular(raiz);

  return raizes;
}

/** "Segurança › Elétrica" — a hierarquia legível numa linha. */
export function categoryPath(categoria: CourseCategoryRef): string {
  return categoria.parentName ? `${categoria.parentName} › ${categoria.name}` : categoria.name;
}
