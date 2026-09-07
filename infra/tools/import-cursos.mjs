/**
 * Traz os cursos reais para o banco.
 *
 * SEPARADO DO SEED DE HOMOLOGAÇÃO, e de propósito. O `hml.sql` recusa rodar
 * fora de homologação — as senhas dele são derivadas do login — e conteúdo real
 * precisa poder ir para produção. São coisas de naturezas diferentes que
 * moravam no mesmo lugar apenas por não haver outro.
 *
 * IDEMPOTENTE. Cada objeto tem id derivado do código do procedimento, e toda
 * escrita é `ON CONFLICT DO UPDATE`. Rodar de novo depois de corrigir o
 * gabarito atualiza as alternativas sem duplicar curso nem perder matrícula.
 *
 * O QUE ELE NÃO FAZ: enviar vídeo. Isso é `upload-cursos.mjs`, e a separação é
 * proposital — o vídeo demora e falha por rede, o banco não. Juntar os dois
 * faria uma falha de upload desfazer a importação inteira.
 *
 * Uso: node infra/tools/import-cursos.mjs [projeto]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const projeto = process.argv[2] ?? "nerdlms-local";

const { cursos } = JSON.parse(
  readFileSync(join(raiz, "infra", "db", "content", "cursos.json"), "utf8"),
);

/**
 * Id derivado do texto, e não sorteado.
 *
 * É o que torna a importação repetível: o mesmo código de procedimento produz
 * sempre o mesmo uuid, e o `ON CONFLICT` reconhece a linha. Com id aleatório,
 * rodar duas vezes criaria dois catálogos.
 *
 * A versão 5 do uuid é exatamente isto — nome mais espaço de nomes viram um
 * hash. Aqui a implementação é direta porque a dependência não vale o ganho.
 */
function uuidDe(chave) {
  const h = createHash("sha1").update(`nerdlms:cursos:${chave}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const lit = (v) =>
  v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

const TENANT = "(SELECT id FROM tenants WHERE slug = 'exemplo')";
const AUTOR = `(SELECT id FROM users WHERE role IN ('instructor','admin') ORDER BY
                 CASE role WHEN 'instructor' THEN 0 ELSE 1 END, created_at LIMIT 1)`;

/**
 * Faixa de espera para as posições, durante a reimportação.
 *
 * Um curso não chega a mil aulas, e acima disso a faixa fica livre para
 * segurar as posições antigas enquanto as novas são inseridas.
 */
const DESLOCAMENTO = 10000;

const sql = ["BEGIN;"];

/* A CAPA É UM ÍNDICE, não uma imagem.

   O produto gera a capa por gradiente mais grafismo da marca, escolhidos por
   um número de 0 a 3. Importando tudo com o padrão da coluna, os sete cursos
   sairiam com a MESMA capa — um catálogo em que nada se distingue de longe.
   O rodízio aqui reproduz o que `createCourse` faz quando alguém cria um curso
   pela tela. */

cursos.forEach((curso, indice) => {
  const cursoId = uuidDe(`curso:${curso.codigo}`);
  const moduloId = uuidDe(`modulo:${curso.codigo}`);

  sql.push(`
INSERT INTO courses (id, tenant_id, slug, title, summary, author_id, status,
                     enrollment_mode, code, visibility, min_grade_percent, artwork)
VALUES (${lit(cursoId)}, ${TENANT}, ${lit(curso.slug)}, ${lit(curso.titulo)},
        ${lit(curso.resumo)}, ${AUTOR}, 'published', 'open', ${lit(curso.codigo)},
        'catalog', ${curso.prova ? 80 : "NULL"}, ${indice % 4})
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, slug = EXCLUDED.slug,
  code = EXCLUDED.code, min_grade_percent = EXCLUDED.min_grade_percent,
  artwork = EXCLUDED.artwork, updated_at = now();`);

  sql.push(`
INSERT INTO modules (id, course_id, title, position)
VALUES (${lit(moduloId)}, ${lit(cursoId)}, 'Treinamento', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;`);

  /* A duração vem MEDIDA do arquivo, pelo `duracao-mp4.mjs`.

     Ela alimenta a barra de progresso e a trava do player, que exige 90% da
     aula para concluir. Zero desliga a trava — `podeConcluirVideo` libera
     quando a duração é desconhecida, para não trancar quem não tem culpa por um
     campo vazio —, e é por isso que medir importa. Quando a leitura falha, o
     zero permanece e o parser avisa: melhor uma trava desligada e declarada que
     um número inventado, que faria a aula concluir cedo ou nunca. */
  /* AS POSIÇÕES SAEM DO CAMINHO ANTES DE QUALQUER INSERÇÃO.

     `lessons` tem índice único em (module_id, position), e isso colide de duas
     formas numa reimportação: a aula única antiga ocupa a posição 1 que a nova
     parte 1 quer, e uma reordenação faz duas aulas disputarem a mesma posição
     no meio do caminho.

     Deslocar primeiro resolve as duas de uma vez. Um curso não chega a mil
     aulas, então a faixa acima de `DESLOCAMENTO` fica livre de colisão com as
     novas, e o que continuar lá em cima ao fim é exatamente o que esta
     importação não reconhece mais.

     Deslocamento e não negativo: a coluna tem `CHECK (position > 0)`. */
  sql.push(`
UPDATE lessons SET position = position + ${DESLOCAMENTO}
 WHERE module_id = ${lit(moduloId)} AND position <= ${DESLOCAMENTO};`);

  /* UMA AULA POR ARQUIVO. O id deriva da chave no storage, e não da posição:
     numerar por posição faria a aula 3 virar a aula 2 se uma parte fosse
     retirada, e o progresso de quem já assistiu apontaria para o vídeo errado. */
  curso.aulas.forEach((aula, posicao) => {
    sql.push(`
INSERT INTO lessons (id, module_id, title, position, duration_seconds, kind,
                     media_key, completion_mode)
VALUES (${lit(uuidDe(`aula:${aula.mediaKey}`))}, ${lit(moduloId)}, ${lit(aula.titulo)},
        ${posicao + 1}, ${aula.duracaoSegundos ?? 0}, 'video',
        ${lit(aula.mediaKey)}, 'manual')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, media_key = EXCLUDED.media_key, position = EXCLUDED.position,
  duration_seconds = EXCLUDED.duration_seconds;`);
  });

  /* O que ficou na faixa de espera não veio desta importação.

     É o caso da aula única que existia antes do corte em partes: sem esta
     limpeza ela continuaria no curso ao lado das novas, contando no total e
     apontando para um vídeo que não está mais no storage. Ninguém conseguiria
     concluir o curso.

     `media_key IS NOT NULL` protege a aula de texto ou de documento que um
     instrutor tenha acrescentado pela tela: ela não veio deste importador e
     não pode sumir por causa dele. Ela volta para a numeração normal, depois
     das aulas de vídeo. */
  sql.push(`
DELETE FROM lessons
 WHERE module_id = ${lit(moduloId)}
   AND position > ${DESLOCAMENTO}
   AND media_key IS NOT NULL;

UPDATE lessons SET position = position - ${DESLOCAMENTO} + ${curso.aulas.length}
 WHERE module_id = ${lit(moduloId)} AND position > ${DESLOCAMENTO};`);

  if (!curso.prova) return;

  const provaId = uuidDe(`prova:${curso.codigo}`);
  const totalPontos = curso.prova.questoes.reduce((s, q) => s + q.pontos, 0);

  sql.push(`
INSERT INTO quizzes (id, tenant_id, course_id, title, description,
                     max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES (${lit(provaId)}, ${TENANT}, ${lit(cursoId)},
        ${lit(`Avaliação: ${curso.titulo}`)},
        ${lit(`${curso.prova.questoes.length} questões · ${totalPontos} pontos · aprovação a partir de 8,0`)},
        1, 80, 'best', false, false, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, updated_at = now();`);

  curso.prova.questoes.forEach((questao, iq) => {
    const questaoId = uuidDe(`questao:${curso.codigo}:${iq}`);

    /* A marca do gabarito provisório vai no campo de explicação, que é o que
       aparece para quem revisa a prova na administração. Some sozinha quando
       alguém corrigir o `corretaIndice` e reimportar. */
    const explicacao = questao.gabaritoProvisorio
      ? "GABARITO PROVISÓRIO — a exportação do formulário não trazia a resposta correta. Revisar antes de valer nota."
      : null;

    sql.push(`
INSERT INTO questions (id, tenant_id, course_id, kind, prompt, points, explanation)
VALUES (${lit(questaoId)}, ${TENANT}, ${lit(cursoId)}, 'single_choice',
        ${lit(questao.enunciado)}, ${questao.pontos}, ${lit(explicacao)})
ON CONFLICT (id) DO UPDATE SET
  prompt = EXCLUDED.prompt, points = EXCLUDED.points,
  explanation = EXCLUDED.explanation, updated_at = now();`);

    questao.alternativas.forEach((texto, ia) => {
      sql.push(`
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES (${lit(uuidDe(`alt:${curso.codigo}:${iq}:${ia}`))}, ${lit(questaoId)},
        ${lit(texto)}, ${ia === questao.corretaIndice}, ${ia + 1})
ON CONFLICT (id) DO UPDATE SET
  text = EXCLUDED.text, is_correct = EXCLUDED.is_correct, position = EXCLUDED.position;`);
    });

    sql.push(`
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES (${lit(provaId)}, ${lit(questaoId)}, ${iq + 1}, ${questao.pontos})
ON CONFLICT (quiz_id, question_id) DO UPDATE SET
  position = EXCLUDED.position, points = EXCLUDED.points;`);
  });
});

sql.push("COMMIT;");

execFileSync(
  "docker",
  ["exec", "-i", `${projeto}-db-1`, "psql", "-U", "lms_migrator", "-d", "lms",
   "-v", "ON_ERROR_STOP=1", "-q"],
  { input: sql.join("\n"), stdio: ["pipe", "inherit", "inherit"] },
);

const comProva = cursos.filter((c) => c.prova);
const questoes = comProva.reduce((s, c) => s + c.prova.questoes.length, 0);

console.log(`\n${cursos.length} cursos importados · ${comProva.length} com prova · ${questoes} questões`);

/* O AVISO SÓ APARECE SE FOR VERDADE.

   Ele era fixo, e continuou dizendo "gabarito provisório" depois que as
   respostas certas já estavam no arquivo. Aviso que não some quando o problema
   some ensina a ignorar avisos, e o próximo, real, passa junto.

   O sinal de provisório é a primeira alternativa marcada em TODAS as questões:
   é o que o parser escreve quando não encontra gabarito. Um arquivo real
   espalha as respostas. */
const naPrimeira = comProva.reduce(
  (s, c) => s + c.prova.questoes.filter((q) => q.corretaIndice === 0).length,
  0,
);

if (questoes > 0 && naPrimeira === questoes) {
  console.log(
    `\n  GABARITO PROVISÓRIO em ${questoes} questões: a primeira alternativa está` +
      `\n  marcada como correta em todas. Corrija \`corretaIndice\` em` +
      `\n  infra/db/content/cursos.json e rode este comando de novo, ele atualiza` +
      `\n  sem duplicar nada.\n`,
  );
} else {
  console.log(
    `\n  Gabarito do arquivo: ${questoes - naPrimeira} de ${questoes} questões têm` +
      `\n  a resposta certa fora da primeira alternativa.\n`,
  );
}
