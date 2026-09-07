/**
 * Verificação estrutural das migrações.
 *
 * NÃO é um parser de SQL: não há PostgreSQL neste ambiente. É o que dá para
 * verificar sem banco, e serve para pegar a classe de erro que mais custa —
 * referência a tabela ou coluna que não existe, e migração sem transação.
 *
 * Quando houver rede, `psql --single-transaction -f` num banco descartável
 * substitui isto com folga. Até lá, é melhor que nada e honesto sobre o limite.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db/migrations");

let failures = 0;

function check(condition, file, message) {
  if (condition) return;
  failures += 1;
  console.log(`  FALHA  ${file}: ${message}`);
}

/** Remove comentários e literais, para não confundir a análise. */
function strip(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, " CORPO ")
    .replace(/'(?:[^']|'')*'/g, "''");
}

const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
console.log(`Migrações (${files.length})\n`);

const declaredTables = new Set();
const declaredColumns = new Map();

for (const file of files) {
  const raw = await readFile(join(dir, file), "utf8");
  const sql = strip(raw);

  // Toda migração precisa ser atômica: metade aplicada é pior que nenhuma.
  check(/\bBEGIN\b/i.test(sql), file, "não abre transação (BEGIN)");
  check(/\bCOMMIT\b/i.test(sql), file, "não fecha transação (COMMIT)");

  // Parênteses e aspas balanceados.
  const abre = (sql.match(/\(/g) ?? []).length;
  const fecha = (sql.match(/\)/g) ?? []).length;
  check(abre === fecha, file, `parênteses desbalanceados (${abre} abrem, ${fecha} fecham)`);
  check((raw.match(/\$\$/g) ?? []).length % 2 === 0, file, "delimitador $$ desbalanceado");

  // Nada de senha literal na migração.
  check(!/PASSWORD\s+'/i.test(raw), file, "senha literal na migração — ela vem do ambiente");

  // Coleta tabelas e colunas declaradas.
  for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, table, body] = match;
    declaredTables.add(table);
    const columns = new Set();
    for (const line of body.split("\n")) {
      const column = line.trim().match(/^(\w+)\s+[a-z]/i);
      if (column && !/^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)$/i.test(column[1])) {
        columns.add(column[1]);
      }
    }
    declaredColumns.set(table, columns);
  }

  // Toda referência aponta para tabela e coluna existentes.
  for (const match of sql.matchAll(/REFERENCES\s+(\w+)\s*\((\w+)\)/g)) {
    const [, table, column] = match;
    check(declaredTables.has(table), file, `REFERENCES aponta para tabela inexistente: ${table}`);
    if (declaredColumns.has(table)) {
      check(
        declaredColumns.get(table).has(column),
        file,
        `REFERENCES ${table}(${column}) — coluna não declarada`,
      );
    }
  }

  // Índice sobre tabela existente.
  for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?\w+ ON (\w+)/g)) {
    check(declaredTables.has(match[1]), file, `índice sobre tabela inexistente: ${match[1]}`);
  }

  console.log(`  ${file} — ${(raw.length / 1024).toFixed(1)} kB`);
}

// Toda chave estrangeira precisa de índice do lado que referencia, senão a
// consulta por ela varre a tabela inteira — com 27 mil pessoas isso aparece.
const indexed = new Set();
for (const file of files) {
  const sql = strip(await readFile(join(dir, file), "utf8"));
  // `IF NOT EXISTS` é opcional aqui pelo mesmo motivo que já é aceito em
  // `CREATE TABLE` abaixo: as migrações precisam ser reaplicáveis.
  for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?\w+ ON (\w+) \(\s*(\w+)/g)) {
    indexed.add(`${match[1]}.${match[2]}`);
  }
  for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, table, body] = match;
    // Coluna que é a primeira da PK já está indexada.
    const pk = body.match(/PRIMARY KEY\s*\(\s*(\w+)/);
    if (pk) indexed.add(`${table}.${pk[1]}`);
    const inline = body.match(/^\s*(\w+)\s+\w+\s+PRIMARY KEY/m);
    if (inline) indexed.add(`${table}.${inline[1]}`);
  }
}

for (const file of files) {
  const sql = strip(await readFile(join(dir, file), "utf8"));
  for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, table, body] = match;
    for (const line of body.split("\n")) {
      const fk = line.trim().match(/^(\w+)\s+\w+.*REFERENCES/i);
      if (!fk) continue;
      check(
        indexed.has(`${table}.${fk[1]}`),
        file,
        `chave estrangeira sem índice: ${table}.${fk[1]} — consulta por ela varre a tabela`,
      );
    }
  }
}

console.log(
  failures === 0
    ? `\n${declaredTables.size} tabelas declaradas. Verificação estrutural passou.`
    : `\n${failures} problema(s) encontrado(s).`,
);
process.exit(failures === 0 ? 0 : 1);
