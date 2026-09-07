/**
 * A resposta marcada como certa no banco é a do gabarito do cliente?
 *
 * POR QUE EXISTE
 *
 * A pergunta apareceu como "as respostas certas não são fictícias, sempre a
 * primeira?". A resposta é não — `parse-cursos.mjs` lê o gabarito escrito no
 * fim de cada `prova.txt` —, mas afirmar isso não vale nada sem conferir.
 * Este script compara as duas fontes, questão a questão.
 *
 * A COMPARAÇÃO É FROUXA, E TEM DE SER
 *
 * O gabarito foi digitado à mão e as alternativas vieram de uma exportação:
 * "Todas as Alternativas." e "Todas as alternativas;" são a MESMA resposta, e
 * comparar texto cru reprovaria metade por causa de um ponto e vírgula.
 *
 *   node infra/tools/conferir-gabarito.mjs "C:/.../CURSOS"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { query } from "../../apps/backend/src/db/pool.ts";

const origem = process.argv[2];

if (!origem) {
  console.error('uso: node infra/tools/conferir-gabarito.mjs "<pasta CURSOS>"');
  process.exit(1);
}

/** Sem acento, sem caixa, sem pontuação de fim, sem espaço sobrando. */
const chave = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.;:,]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * As respostas escritas no fim do arquivo.
 *
 * A marcação varia — `respostas:`, `resposta:`, `respostas corretas`, e num
 * deles nenhuma. O que não varia é a linha "Confirmo que eu assisti.", que
 * abre o gabarito em todos: ela é a resposta da questão de confirmação, e a
 * única linha que se repete idêntica nos cinco arquivos.
 */
function lerGabarito(caminho) {
  const linhas = readFileSync(caminho, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  /* O ÚLTIMO "Confirmo que eu assisti.": o primeiro é a alternativa da questão
     de confirmação, lá no meio do arquivo. */
  let inicio = -1;
  linhas.forEach((linha, i) => {
    if (chave(linha) === "confirmo que eu assisti") inicio = i;
  });

  if (inicio < 0) return [];

  return linhas
    .slice(inicio + 1)
    /* Um dos arquivos traz linhas de preenchimento antes das respostas
       ("Nome completo: seu nome completo"). Não são gabarito de questão. */
    .filter((l) => !/^(nome completo|fun[cç][aã]o|departamento|empresa)\s*:/i.test(l));
}

const cursos = await query(`
  SELECT c.slug, c.code, q.id AS quiz_id
    FROM quizzes q JOIN courses c ON c.id = q.course_id
   ORDER BY c.slug`);

let conferidas = 0;
let divergentes = 0;
let semGabarito = 0;

for (const curso of cursos) {
  /* A pasta usa o código em MAIÚSCULAS; o slug do curso é a versão minúscula. */
  const caminho = join(origem, "com-prova", (curso.code ?? curso.slug).toUpperCase(), "prova.txt");

  let gabarito;
  try {
    gabarito = lerGabarito(caminho);
  } catch {
    console.log(`  --  ${curso.slug}: sem prova.txt em ${caminho}`);
    continue;
  }

  const questoes = await query(
    `SELECT q.id, q.prompt, qq.position
       FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id
      WHERE qq.quiz_id = $1
      ORDER BY qq.position`,
    [curso.quiz_id],
  );

  console.log(`\n${curso.slug}: ${questoes.length} questão(ões), ${gabarito.length} no gabarito`);

  for (const [indice, questao] of questoes.entries()) {
    const opcoes = await query(
      `SELECT text, is_correct FROM question_options WHERE question_id = $1 ORDER BY position`,
      [questao.id],
    );

    const marcada = opcoes.find((o) => o.is_correct);
    const esperada = gabarito[indice];

    conferidas++;

    if (esperada === undefined) {
      semGabarito++;
      console.log(`  ??  ${questao.prompt.slice(0, 52)}: sem linha no gabarito`);
      continue;
    }

    if (chave(marcada?.text) === chave(esperada)) {
      console.log(`  ok  ${String(marcada.text).slice(0, 56)}`);
      continue;
    }

    divergentes++;
    console.log(`  !=  ${questao.prompt.slice(0, 46)}`);
    console.log(`        banco:    ${marcada?.text ?? "(nenhuma marcada)"}`);
    console.log(`        gabarito: ${esperada}`);
  }
}

console.log(
  `\n${conferidas} questão(ões) conferida(s): ${divergentes} divergente(s), ` +
    `${semGabarito} sem linha no gabarito.`,
);

process.exit(divergentes > 0 ? 1 : 0);
