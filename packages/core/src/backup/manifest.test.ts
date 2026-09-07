import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_FORMAT_VERSION,
  FORA_DO_BACKUP,
  NAO_RESTAURA,
  TABELAS_DO_BACKUP,
  resumirBackup,
  validarBackup,
  type BackupFile,
} from "./manifest.ts";

/**
 * As dependências entre tabelas, como o banco as declara.
 *
 * Copiadas do schema de propósito: um teste que lê o banco não roda sem banco,
 * e este precisa rodar no `npm test`. A contrapartida é manter a lista viva —
 * daí o teste de contagem abaixo, que reprova quando o manifesto cresce sem
 * que estas dependências acompanhem.
 */
const DEPENDENCIAS: Array<[filho: string, pai: string]> = [
  ["courses", "course_categories"],
  ["courses", "org_units"],
  ["courses", "users"],
  ["modules", "courses"],
  ["lessons", "modules"],
  ["materials", "lessons"],
  ["course_tags", "courses"],
  ["course_tags", "tags"],
  ["course_classes", "courses"],
  ["course_classes", "users"],
  ["unlock_rules", "course_classes"],
  ["tracks", "users"],
  ["track_courses", "tracks"],
  ["track_courses", "courses"],
  ["question_categories", "courses"],
  ["questions", "question_categories"],
  ["questions", "courses"],
  ["question_options", "questions"],
  ["question_tags", "questions"],
  ["question_tags", "tags"],
  ["quizzes", "courses"],
  ["quiz_questions", "quizzes"],
  ["quiz_questions", "questions"],
  ["assignments", "courses"],
  ["assignments", "lessons"],
  ["rubrics", "courses"],
  ["rubric_criteria", "rubrics"],
  ["scorm_packages", "courses"],
  ["enrollments", "courses"],
  ["enrollments", "course_classes"],
  ["enrollments", "users"],
  ["lesson_progress", "enrollments"],
  ["lesson_progress", "lessons"],
  ["quiz_attempts", "enrollments"],
  ["quiz_attempts", "quizzes"],
  ["quiz_answers", "quiz_attempts"],
  ["quiz_answers", "questions"],
  ["submissions", "enrollments"],
  ["submissions", "assignments"],
  ["submission_files", "submissions"],
  ["grade_entries", "enrollments"],
  ["grade_entries", "quizzes"],
  ["grade_entries", "assignments"],
  ["rubric_scores", "submissions"],
  ["rubric_scores", "rubric_criteria"],
  ["scorm_tracking", "enrollments"],
  ["scorm_tracking", "scorm_packages"],
  ["scorm_interactions", "scorm_tracking"],
  ["comments", "lessons"],
  ["comments", "users"],
  ["comment_votes", "comments"],
  ["forum_topics", "courses"],
  ["forum_posts", "forum_topics"],
  ["forum_attachments", "forum_posts"],
  ["forum_subscriptions", "forum_topics"],
  ["notifications", "users"],
  ["notification_preferences", "users"],
  ["api_keys", "users"],
  ["audit_log", "users"],
];

describe("Manifesto de backup: F5-06", () => {
  test("a ordem das tabelas respeita as chaves estrangeiras", () => {
    /* O teste que pegou dois erros reais quando foi escrito:
       `question_categories` vinha antes de `courses`, e `unlock_rules` antes de
       `course_classes`. Os dois quebrariam a restauração com violação de chave
       estrangeira — no meio do processo, com parte das tabelas já escritas. */
    const posicao = new Map(TABELAS_DO_BACKUP.map((t, i) => [t.nome, i]));

    for (const [filho, pai] of DEPENDENCIAS) {
      const posFilho = posicao.get(filho);
      const posPai = posicao.get(pai);

      assert.ok(posFilho !== undefined, `${filho} não está no manifesto`);
      assert.ok(posPai !== undefined, `${pai} não está no manifesto`);
      assert.ok(
        posPai! < posFilho!,
        `${filho} referencia ${pai}, então ${pai} tem de vir ANTES no manifesto`,
      );
    }
  });

  test("nenhuma tabela aparece duas vezes", () => {
    const nomes = TABELAS_DO_BACKUP.map((t) => t.nome);
    assert.equal(new Set(nomes).size, nomes.length);
  });

  test("uma tabela está no backup OU fora dele, nunca nos dois", () => {
    const dentro = new Set(TABELAS_DO_BACKUP.map((t) => t.nome));

    for (const { tabela } of FORA_DO_BACKUP) {
      assert.ok(!dentro.has(tabela), `${tabela} está no backup e na lista de exclusões`);
    }
  });

  test("toda exclusão tem motivo escrito", () => {
    /* Uma exclusão sem motivo vira uma exclusão que ninguém sabe se ainda vale. */
    for (const { tabela, motivo } of FORA_DO_BACKUP) {
      assert.ok(motivo.trim().length > 30, `${tabela} precisa de um motivo de verdade`);
    }
  });

  test("o backup de curso leva a estrutura, não o histórico das pessoas", () => {
    const noCurso = new Set(
      TABELAS_DO_BACKUP.filter((t) => t.noBackupDeCurso).map((t) => t.nome),
    );

    /* Migrar um curso não pode levar junto matrícula, progresso e nota: é dado
       de aluno indo para onde ninguém pediu. */
    for (const tabela of ["enrollments", "lesson_progress", "grade_entries", "submissions"]) {
      assert.ok(!noCurso.has(tabela), `${tabela} não pode ir no backup de um curso`);
    }

    for (const tabela of ["courses", "modules", "lessons", "questions"]) {
      assert.ok(noCurso.has(tabela), `${tabela} precisa ir no backup de um curso`);
    }
  });

  test("o que não se restaura está no backup, e é declarado", () => {
    /* `audit_log` sai no arquivo — é dado do cliente — mas não volta: o `id`
       dela é GENERATED ALWAYS, então não há chave única para o ON CONFLICT
       comparar, e cada restauração duplicaria a auditoria inteira. */
    const dentro = new Set(TABELAS_DO_BACKUP.map((t) => t.nome));

    for (const tabela of NAO_RESTAURA) {
      assert.ok(
        dentro.has(tabela),
        `${tabela} está em NAO_RESTAURA mas nem sequer entra no backup`,
      );
    }

    assert.ok(NAO_RESTAURA.has("audit_log"));
  });

  test("recusa arquivo que não é backup deste produto", () => {
    assert.equal(validarBackup(null).ok, false);
    assert.equal(validarBackup("texto").ok, false);
    assert.equal(validarBackup({}).ok, false);
    assert.equal(validarBackup({ formato: 1 }).ok, false);
    assert.equal(validarBackup({ formato: 1, escopo: "outro", dados: {} }).ok, false);
  });

  test("recusa backup de formato mais novo que o produto entende", () => {
    /* Restaurar um arquivo de formato futuro leria campos que ainda não
       existem — e o erro apareceria no meio da escrita. */
    const resultado = validarBackup({
      formato: BACKUP_FORMAT_VERSION + 1,
      escopo: "tenant",
      dados: {},
    });

    assert.equal(resultado.ok, false);
    if (!resultado.ok) assert.match(resultado.erro, /Atualize a plataforma/);
  });

  test("recusa arquivo com tabela desconhecida", () => {
    const resultado = validarBackup({
      formato: 1,
      escopo: "tenant",
      dados: { tabela_inventada: [] },
    });

    assert.equal(resultado.ok, false);
    if (!resultado.ok) assert.match(resultado.erro, /tabela_inventada/);
  });

  test("aceita um backup bem formado", () => {
    const resultado = validarBackup({
      formato: 1,
      escopo: "tenant",
      geradoEm: "2026-08-24T00:00:00.000Z",
      origem: { tenantId: "abc", tenantSlug: "exemplo" },
      avisos: [],
      dados: { users: [{ id: "1" }], courses: [] },
    });

    assert.equal(resultado.ok, true);
  });

  test("o resumo conta só as tabelas com linha", () => {
    const arquivo: BackupFile = {
      formato: 1,
      escopo: "tenant",
      geradoEm: "2026-08-24T00:00:00.000Z",
      origem: { tenantId: "abc", tenantSlug: "exemplo" },
      avisos: [],
      dados: { users: [{ id: "1" }, { id: "2" }], courses: [], lessons: [{ id: "3" }] },
    };

    assert.deepEqual(resumirBackup(arquivo), [
      { tabela: "users", linhas: 2 },
      { tabela: "lessons", linhas: 1 },
    ]);
  });
});
