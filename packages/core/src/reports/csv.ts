/**
 * Geração de CSV.
 *
 * Sem biblioteca: a proposta exclui licenças de terceiros do escopo, e CSV é um
 * formato de texto com quatro regras. O que não é trivial — e é o motivo de
 * isto existir em vez de um `join(",")` — são o escape e a injeção de fórmula.
 */

/** Separador. Ponto e vírgula porque o Excel em pt-BR espera isso. */
const DELIMITER = ";";

/**
 * Caracteres que fazem o Excel tratar a célula como fórmula.
 *
 * Uma célula começando com `=`, `+`, `-` ou `@` é executada ao abrir a
 * planilha. Um nome de curso como `=HYPERLINK(...)` viraria código rodando na
 * máquina de quem exportou o relatório — é a injeção de fórmula (CSV
 * injection), e a defesa é prefixar com aspa simples.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Escapa uma célula: neutraliza fórmula, dobra aspas e envolve quando preciso. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const raw = String(value);
  const safe = FORMULA_START.test(raw) ? `'${raw}` : raw;

  /* Aspas, separador e quebra de linha exigem envolver a célula; a aspa
     interna vira aspa dupla. */
  if (safe.includes('"') || safe.includes(DELIMITER) || /[\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Monta o arquivo a partir do cabeçalho e das linhas.
 *
 * Usa CRLF porque é o que a especificação do CSV define e o que o Excel espera
 * em qualquer sistema.
 */
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(csvCell).join(DELIMITER)];
  for (const row of rows) lines.push(row.map(csvCell).join(DELIMITER));
  return lines.join("\r\n");
}

/**
 * BOM de UTF-8.
 *
 * Sem ele, o Excel abre o arquivo em codificação local e "Operações de Água"
 * vira "OperaÃ§Ãµes". Três bytes que decidem se o relatório é legível.
 */
export const UTF8_BOM = "﻿";

/** Nome de arquivo seguro, com data para não sobrescrever o anterior. */
export function reportFilename(prefix: string, isoDate: string): string {
  const day = isoDate.slice(0, 10);
  const safe = prefix.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9-]+/g, "-");
  return `${safe.toLowerCase()}-${day}.csv`;
}
