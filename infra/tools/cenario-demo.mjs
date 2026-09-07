/**
 * O cenário da apresentação.
 *
 * POR QUE ISTO EXISTE
 *
 * A trava do player é real e os vídeos reais têm de 56 a 85 minutos. Ninguém
 * conclui um curso ao vivo, e sem conclusão não há prova, não há reprovação,
 * não há pedido de reteste e não há certificado. A plataforma inteira ficaria
 * com as telas mais importantes inalcançáveis numa demonstração de meia hora.
 *
 * Afrouxar a trava para caber na apresentação seria mentir sobre o produto. O
 * caminho honesto é o outro: gravar o progresso que uma pessoa REALMENTE teria
 * depois de assistir, e demonstrar o que vem depois disso.
 *
 * O QUE ELE ESCREVE, E O QUE NÃO ESCREVE
 *
 * Escreve exatamente as mesmas linhas que o uso normal escreveria: aula
 * concluída em `lesson_progress`, tentativa em `quiz_attempts` com as
 * respostas em `quiz_answers`, nota em `grade_entries`, pedido em
 * `quiz_retake_requests`. Nada de coluna especial de "isto é demonstração":
 * uma linha que a aplicação não saberia produzir demonstraria uma tela que a
 * aplicação não sabe chegar.
 *
 * NÃO mexe em curso, em prova, em gabarito nem em usuário. Só em progresso.
 *
 * IDEMPOTENTE. Todo id é derivado do texto, e toda escrita tem `ON CONFLICT`.
 * Rodar de novo não duplica tentativa nem empilha pedido. Só `grade_entries`
 * é diferente, porque o gatilho da migração 012 proíbe atualizar nota lançada:
 * ali o conflito é `DO NOTHING`, e a entrada original fica.
 *
 * Uso: node infra/tools/cenario-demo.mjs [projeto]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const projeto = process.argv[2] ?? "nerdlms-local";

/* Mesmo esquema de `import-cursos.mjs`: id derivado do texto, para o
   `ON CONFLICT` reconhecer a linha numa segunda execução. */
function uuidDe(chave) {
  const h = createHash("sha1").update(`nerdlms:cenario:${chave}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const lit = (v) =>
  v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

function psql(sql, { silencioso = true } = {}) {
  return execFileSync(
    "docker",
    ["exec", "-i", `${projeto}-db-1`, "psql", "-U", "lms_migrator", "-d", "lms",
     "-v", "ON_ERROR_STOP=1", ...(silencioso ? ["-At", "-F", "|", "-q"] : ["-q"])],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] },
  );
}

const linhas = (saida) =>
  saida.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split("|"));

/* ------------------------------------------------------------------ */

const ALUNO = "user.mock@exemplo.com";
const INSTRUTOR = "instructor.mock@exemplo.com";

/* As cinco contas de papel. São elas que ganham matrícula em todos os cursos:
   sem matrícula, a tela de curso abre com progresso zerado e nenhuma delas
   consegue demonstrar o percurso. */
const CONTAS_DE_DEMONSTRACAO = [
  "user.mock@exemplo.com",
  "instructor.mock@exemplo.com",
  "instructor2.mock@exemplo.com",
  "manager.mock@exemplo.com",
  "admin.mock@exemplo.com",
];

/**
 * Um estado por curso, e juntos eles cobrem TODAS as telas que a regra produz.
 *
 * A escolha não é decorativa. Quem apresenta precisa poder mostrar, na mesma
 * sessão e sem esperar vídeo nenhum: o botão que não libera, o que libera, a
 * reprovação com saída, a espera pela decisão de outra pessoa, e a aprovação
 * com o documento no fim. Faltando um, aquela parte do produto vira promessa.
 */
const CENARIO = [
  {
    slug: "1007-pe-00022-bra-i",
    estado: "intocado",
    mostra: 'prova travada, "Falta 1 aula para liberar"',
  },
  {
    slug: "1001-pr-0006-bra-i",
    estado: "aulas-concluidas",
    mostra: "prova liberada, ninguém tentou ainda",
  },
  {
    slug: "1014-pe-0004-bra-i",
    estado: "reprovado",
    percentualAlvo: 40,
    mostra: "reprovado com 4,0, botão de solicitar reteste",
  },
  {
    slug: "1022-pe-00022-bra-i",
    estado: "reprovado-com-pedido",
    percentualAlvo: 60,
    justificativa:
      "Tive dificuldade com as questões sobre acionamento da brigada. " +
      "Revi a aula e gostaria de uma segunda chance.",
    mostra: "pedido pendente, aparece na fila do instrutor",
  },
  {
    slug: "consicencia-negra",
    estado: "aulas-concluidas",
    mostra: "curso sem prova, concluído só com a aula",
  },
  {
    slug: "myahgora",
    estado: "intocado",
    mostra: "curso sem prova, ainda não começado",
  },
  {
    slug: "1001-pe-0003-bra-i",
    estado: "aprovado",
    percentualAlvo: 100,
    mostra: "aprovado com 10,0, certificado emitível",
  },
];

/* ------------------------------------------------------------------ */

const ctx = linhas(
  psql(`SELECT
          (SELECT id FROM users WHERE email = ${lit(ALUNO)}),
          (SELECT id FROM users WHERE email = ${lit(INSTRUTOR)}),
          (SELECT tenant_id FROM users WHERE email = ${lit(ALUNO)});`),
)[0];

const [alunoId, instrutorId, tenantId] = ctx ?? [];

if (!alunoId || !instrutorId || !tenantId) {
  console.error(
    `Não achei as contas de demonstração (${ALUNO} / ${INSTRUTOR}).\n` +
      "Rode `node infra/tools/seed-usuarios.mjs` antes.",
  );
  process.exit(1);
}

/**
 * As matrículas das cinco contas de demonstração, em todos os cursos.
 *
 * Antes elas vinham do seed de homologação, junto com o conteúdo fictício.
 * Quando o catálogo passou a ser só o real, o seed deixou de ser rodado e as
 * matrículas sumiram com ele: as contas existiam e nenhuma tinha curso.
 *
 * O id deriva do par pessoa/curso, e não é sorteado, para a segunda execução
 * reconhecer a linha em vez de criar outra matrícula para a mesma pessoa.
 */
psql(`
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, created_at)
SELECT uuid_in(md5('nerdlms:matricula:' || c.id || ':' || u.id)::cstring::cstring),
       c.id, u.id, u.id, now() - interval '20 days'
  FROM courses c
  CROSS JOIN users u
 WHERE c.tenant_id = ${lit(tenantId)}
   AND u.email IN (${CONTAS_DE_DEMONSTRACAO.map(lit).join(", ")})
ON CONFLICT (id) DO NOTHING;`);

const matriculas = linhas(
  psql(`SELECT count(*) FROM enrollments WHERE learner_id IN
          (SELECT id FROM users WHERE email IN
            (${CONTAS_DE_DEMONSTRACAO.map(lit).join(", ")}));`),
)[0];

console.log(`${matriculas?.[0] ?? 0} matrículas garantidas.\n`);

/**
 * Apaga as tentativas de prova de um curso, para ele voltar ao estado descrito.
 *
 * `quiz_attempts` aceita remoção; `grade_entries`, não. Quando sobra nota
 * lançada, o curso continua contando como avaliado por mais que a tentativa
 * suma, e o cenário deixa de valer. A função devolve quantas notas ficaram,
 * para quem chama poder avisar.
 */
function limparProva(slug, matriculaId) {
  psql(`
DELETE FROM quiz_answers
 WHERE attempt_id IN (
   SELECT qa.id FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     JOIN courses c ON c.id = q.course_id
    WHERE c.slug = ${lit(slug)} AND qa.enrollment_id = ${lit(matriculaId)});

DELETE FROM quiz_attempts qa
 USING quizzes q, courses c
 WHERE q.id = qa.quiz_id AND c.id = q.course_id
   AND c.slug = ${lit(slug)} AND qa.enrollment_id = ${lit(matriculaId)};`);

  const restou = linhas(
    psql(`SELECT count(*) FROM grade_entries ge
            JOIN quizzes q ON q.id = ge.quiz_id
            JOIN courses c ON c.id = q.course_id
           WHERE c.slug = ${lit(slug)} AND ge.enrollment_id = ${lit(matriculaId)};`),
  )[0];

  return Number(restou?.[0] ?? 0);
}

/** Progresso de aula de um curso, para o estado "intocado" valer de verdade. */
function limparAulas(slug, matriculaId) {
  psql(`
DELETE FROM lesson_progress lp
 USING lessons l, modules m, courses c
 WHERE l.id = lp.lesson_id AND m.id = l.module_id AND c.id = m.course_id
   AND c.slug = ${lit(slug)} AND lp.enrollment_id = ${lit(matriculaId)};`);
}

const sql = ["BEGIN;"];
const resumo = [];
const avisos = [];

for (const alvo of CENARIO) {
  /* A matrícula do aluno neste curso, necessária tanto para limpar quanto
     para escrever. */
  const matricula = linhas(
    psql(`SELECT e.id FROM enrollments e
            JOIN courses c ON c.id = e.course_id
           WHERE c.slug = ${lit(alvo.slug)} AND e.learner_id = ${lit(alunoId)};`),
  )[0];

  if (alvo.estado === "intocado") {
    /* Intocado precisa SER intocado. Antes o script apenas não escrevia, e o
       curso guardava o que alguém tivesse feito na plataforma. */
    if (matricula) {
      limparAulas(alvo.slug, matricula[0]);
      const notas = limparProva(alvo.slug, matricula[0]);
      if (notas > 0) {
        avisos.push(
          `${alvo.slug}: ${notas} nota(s) lançada(s) permanecem. ` +
            "grade_entries é somente-inserção, e o curso vai aparecer como avaliado.",
        );
      }
    }
    resumo.push([alvo.slug, "intocado", alvo.mostra]);
    continue;
  }

  const dados = linhas(
    psql(`SELECT e.id, c.id, coalesce(q.id::text, '')
            FROM courses c
            JOIN enrollments e ON e.course_id = c.id AND e.learner_id = ${lit(alunoId)}
            LEFT JOIN quizzes q ON q.course_id = c.id
           WHERE c.slug = ${lit(alvo.slug)};`),
  )[0];

  if (!dados) {
    console.error(`Sem matrícula do aluno em ${alvo.slug}. Pulei.`);
    continue;
  }

  const [matriculaId, cursoId, provaId] = dados;

  /* AS AULAS. `watched_seconds` recebe a duração inteira porque é o que a
     trava do player exigiria: cobertura de 90% do vídeo. Gravar menos
     produziria uma linha que a própria regra do produto recusaria. */
  sql.push(`
INSERT INTO lesson_progress
       (enrollment_id, lesson_id, watched_seconds, last_position_seconds,
        completed_at, completion_source, completed_by)
SELECT ${lit(matriculaId)}, l.id, l.duration_seconds, l.duration_seconds,
       now() - interval '3 days', 'auto', ${lit(alunoId)}
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
 WHERE m.course_id = ${lit(cursoId)}
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds       = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at          = coalesce(lesson_progress.completed_at, EXCLUDED.completed_at),
  completion_source     = coalesce(lesson_progress.completion_source, EXCLUDED.completion_source),
  completed_by          = coalesce(lesson_progress.completed_by, EXCLUDED.completed_by);`);

  if (alvo.estado === "aulas-concluidas") {
    /* Aulas feitas e prova NÃO feita: é o estado que demonstra o botão
       liberado. Uma tentativa deixada por alguém o transforma em aprovado. */
    const notas = limparProva(alvo.slug, matriculaId);
    if (notas > 0) {
      avisos.push(
        `${alvo.slug}: ${notas} nota(s) lançada(s) permanecem. ` +
          "grade_entries é somente-inserção, e a prova vai aparecer como feita.",
      );
    }
    resumo.push([alvo.slug, "aulas concluídas", alvo.mostra]);
    continue;
  }

  if (!provaId) {
    console.error(`${alvo.slug} não tem prova, não dá para reprovar. Pulei.`);
    continue;
  }

  /* A TENTATIVA REPROVADA, com respostas de verdade.

     As questões vêm ordenadas, com os pontos e a alternativa certa. Acerto as
     primeiras até chegar perto do alvo e erro o resto: a soma dos pontos das
     respostas bate com `score_points` da tentativa. Gravar um percentual que
     as respostas não explicam daria uma tela de revisão contradizendo a nota. */
  const questoes = linhas(
    psql(`SELECT qq.question_id, qq.points,
                 (SELECT id FROM question_options WHERE question_id = qq.question_id
                   AND is_correct ORDER BY position LIMIT 1),
                 (SELECT id FROM question_options WHERE question_id = qq.question_id
                   AND NOT is_correct ORDER BY position LIMIT 1)
            FROM quiz_questions qq
           WHERE qq.quiz_id = ${lit(provaId)}
           ORDER BY qq.position;`),
  );

  const total = questoes.reduce((s, [, p]) => s + Number(p), 0);
  const desejado = (total * alvo.percentualAlvo) / 100;

  let ganhos = 0;
  const respostas = questoes.map(([questaoId, pontos, certa, errada]) => {
    const vale = Number(pontos);
    const acerta = ganhos + vale <= desejado + 1e-9 && certa;
    if (acerta) ganhos += vale;
    return { questaoId, escolhida: acerta ? certa : (errada ?? certa), ganho: acerta ? vale : 0 };
  });

  const percentual = total > 0 ? (ganhos / total) * 100 : 0;
  const tentativaId = uuidDe(`tentativa:${alvo.slug}:${matriculaId}`);

  sql.push(`
INSERT INTO quiz_attempts
       (id, quiz_id, enrollment_id, attempt_number, started_at, submitted_at,
        score_points, score_percent, passed, needs_review)
VALUES (${lit(tentativaId)}, ${lit(provaId)}, ${lit(matriculaId)}, 1,
        now() - interval '2 days',
        now() - interval '2 days' + interval '11 minutes',
        ${ganhos.toFixed(2)}, ${percentual.toFixed(2)}, ${alvo.estado === "aprovado"}, false)
ON CONFLICT (id) DO UPDATE SET
  score_points = EXCLUDED.score_points, score_percent = EXCLUDED.score_percent,
  passed = EXCLUDED.passed, submitted_at = EXCLUDED.submitted_at;`);

  for (const r of respostas) {
    sql.push(`
INSERT INTO quiz_answers (id, attempt_id, question_id, response, points_awarded, auto_graded)
VALUES (${lit(uuidDe(`resposta:${tentativaId}:${r.questaoId}`))}, ${lit(tentativaId)},
        ${lit(r.questaoId)}, ${lit(JSON.stringify([r.escolhida]))}::jsonb,
        ${r.ganho.toFixed(2)}, true)
ON CONFLICT (id) DO UPDATE SET
  response = EXCLUDED.response, points_awarded = EXCLUDED.points_awarded;`);
  }

  /* A NOTA NO BOLETIM. É ela que o certificado consulta, e não a tentativa.
     `DO NOTHING` porque o gatilho da migração 012 proíbe atualizar nota
     lançada: repetir a execução não pode reescrever histórico. */
  sql.push(`
INSERT INTO grade_entries
       (id, tenant_id, enrollment_id, quiz_id, points_earned, points_possible,
        weight, reason, created_at)
VALUES (${lit(uuidDe(`nota:${tentativaId}`))}, ${lit(tenantId)}, ${lit(matriculaId)},
        ${lit(provaId)}, ${ganhos.toFixed(2)}, ${total.toFixed(2)}, 1,
        'Correção automática da prova', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;`);

  if (alvo.estado === "reprovado" || alvo.estado === "aprovado") {
    const nota = (percentual / 10).toFixed(1).replace(".", ",");
    resumo.push([alvo.slug, `${alvo.estado} ${nota}`, alvo.mostra]);
    continue;
  }

  /* O PEDIDO PENDENTE. O índice parcial da migração 038 já garante um pedido
     em aberto por prova e matrícula, então o conflito aqui é o mesmo que a
     aplicação encontraria se alguém clicasse duas vezes. */
  sql.push(`
INSERT INTO quiz_retake_requests
       (id, tenant_id, quiz_id, enrollment_id, learner_note, status, created_at)
VALUES (${lit(uuidDe(`pedido:${tentativaId}`))}, ${lit(tenantId)}, ${lit(provaId)},
        ${lit(matriculaId)}, ${lit(alvo.justificativa)}, 'pending',
        now() - interval '1 day')
ON CONFLICT DO NOTHING;`);

  resumo.push([
    alvo.slug,
    `reprovado ${(percentual / 10).toFixed(1).replace(".", ",")}, pedido pendente`,
    alvo.mostra,
  ]);
}

sql.push("COMMIT;");

psql(sql.join("\n"), { silencioso: false });

const larguraA = Math.max(...resumo.map((r) => r[0].length));
const larguraB = Math.max(...resumo.map((r) => r[1].length));

console.log(`\nCenário aplicado para ${ALUNO}:\n`);
for (const [slug, estado, mostra] of resumo) {
  console.log(`  ${slug.padEnd(larguraA)}  ${estado.padEnd(larguraB)}  ${mostra}`);
}
console.log(
  `\n  A fila de retestes fica em /instrutor/correcao, para ${INSTRUTOR}.\n`,
);

if (avisos.length > 0) {
  console.log("  O cenário não pôde ser restaurado por inteiro:\n");
  for (const aviso of avisos) console.log(`    ${aviso}`);
  console.log(
    "\n  Nota lançada não se apaga, e é a mesma regra que protege o histórico\n" +
      "  de um aluno real. Para um cenário limpo, recrie o banco:\n" +
      "    npm run down && docker volume rm nerdlms-local_db-data && npm run up\n" +
      "    npm run migrate && node infra/tools/seed-usuarios.mjs\n" +
      "    node infra/tools/import-cursos.mjs && node infra/tools/cenario-demo.mjs\n",
  );
}
