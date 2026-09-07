import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guarda do isolamento entre clientes.
 *
 * Uma consulta que lê tabela raiz sem `tenant_id` não dá erro: ela devolve o
 * dado de outra empresa. Não há teste de runtime que pegue isso de forma
 * confiável — seria preciso um segundo tenant povoado em cada cenário — mas a
 * FORMA da consulta dá para auditar, e é onde o esquecimento aparece.
 *
 * Este teste falha o build quando alguém acrescenta uma leitura sem recorte.
 * É a rede que sustenta as fases seguintes: quiz, gradebook e fórum vão somar
 * dezenas de consultas novas, e revisar uma a uma no olho não escala.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(AQUI, "..");

/**
 * Tabelas que carregam `tenant_id` próprio.
 *
 * É a lista REAL do banco, e não um recorte do que existia quando o guarda foi
 * escrito. Nasceu com cinco tabelas (migração 003) e ficou parada enquanto o
 * schema crescia — o guarda passava a cada fase nova sem olhar as tabelas que
 * cada uma trazia. Uma lista incompleta aqui não falha: ela aprova em silêncio
 * exatamente a consulta que deveria reprovar.
 *
 * Para conferir contra o banco:
 *   SELECT table_name FROM information_schema.columns
 *    WHERE column_name = 'tenant_id' AND table_schema = 'public';
 *
 * As demais herdam por chave estrangeira — `lessons` pertence a um módulo, que
 * pertence a um curso — e o recorte delas vem do JOIN. Exigir `tenant_id` ali
 * seria pedir uma coluna que não existe.
 */
const RAIZ = [
  "users",
  "courses",
  "tracks",
  "events",
  "audit_log",
  "api_keys",
  "assignments",
  "badges",
  "competencies",
  "competency_evidence",
  "competency_frameworks",
  "cmi5_sessions",
  "cmi5_units",
  "course_categories",
  "ldap_directories",
  "learning_plans",
  "lti_keys",
  "lti_nonces",
  "lti_tools",
  "course_classes",
  "email_templates",
  "forum_topics",
  "grade_entries",
  "interactive_content",
  "login_attempts",
  "org_units",
  "question_categories",
  "questions",
  "quizzes",
  "rubrics",
  "saml_providers",
  "saml_requests",
  "scorm_packages",
  "sso_identities",
  "sso_login_states",
  "sso_providers",
  "tags",
  "tenant_features",
  "unlock_rules",
  "webhooks",
  "xapi_statements",
];

/**
 * Consultas que podem ler tabela raiz sem recorte, com o motivo.
 *
 * A lista é curta de propósito: cada entrada é uma decisão, não uma exceção de
 * conveniência. Crescer aqui sem justificativa é o sinal de que o isolamento
 * está sendo furado aos poucos.
 */
const PERMITIDAS = [
  /**
   * Consulta ancorada num ID.
   *
   * Se o WHERE fixa uma chave — `id = $1`, `c.lesson_id = $1` —, o recorte vem
   * do caminho: para ter aquele UUID é preciso já ter passado por uma consulta
   * com tenant, e `can()` confere o tenant do recurso antes de qualquer outra
   * regra. Exigir `tenant_id` também aqui obrigaria a carregá-lo por argumento
   * em cadeias que a chave estrangeira já fecha.
   *
   * O que este teste protege é a consulta que LISTA — `FROM users ORDER BY`,
   * `FROM courses WHERE status = 'published'` —, que sem recorte varre o banco
   * inteiro e devolve o dado de todo mundo.
   */
  /\bWHERE\b[\s\S]*?\b\w*\.?\w*id\s*=\s*\$\d/i,

  /* Sessão: resolve o token e traz o tenant no mesmo JOIN — é justamente a
     consulta que DESCOBRE de quem é a requisição. */
  /\bFROM\s+sessions\b/i,

  /* Resolução de tenant: `tenants` não tem `tenant_id`, ela É o tenant. */
  /\bFROM\s+tenants\b/i,

  /* Escrita em tabela filha: o pai foi localizado por id e conferido pela
     permissão antes de a escrita acontecer. */
  /\bINSERT INTO\s+(?:comments|comment_votes|lesson_progress|enrollments)\b/i,

  /**
   * Tentativas de login: acontecem ANTES de existir um tenant.
   *
   * Quem tenta entrar ainda não foi identificado — não há de quem recortar. E o
   * bloqueio por IP precisa contar as tentativas de TODOS os clientes: recortar
   * por tenant daria a quem ataca um jeito trivial de zerar o contador, bastando
   * alternar o cliente a cada tentativa.
   */
  /\b(?:FROM|INSERT INTO)\s+login_attempts\b/i,

  /**
   * Tópico tocado pelo id da resposta recém-criada.
   *
   * `UPDATE forum_topics WHERE id = (SELECT topic_id FROM nova)` — o id vem da
   * CTE que acabou de inserir, e a resposta só existe porque o chamador
   * autorizou o tópico antes. É a mesma garantia da regra "ancorada num id"
   * acima; o que muda é a origem do id, que vem de uma CTE e não de `$1`.
   */
  /\bUPDATE\s+forum_topics\s+SET[\s\S]*?\bWHERE\s+id\s*=\s*\(\s*SELECT\b/i,

  /**
   * Limpeza de estados de login vencidos.
   *
   * O corte é por TEMPO, não por cliente: um `state` de dez minutos atrás não
   * serve mais para ninguém, de tenant nenhum. Recortar por cliente obrigaria a
   * varrer a lista de clientes para apagar lixo, e deixaria para trás o lixo de
   * quem foi excluído.
   *
   * A regra é estreita de propósito — só o DELETE por `expires_at`. Qualquer
   * outra leitura dessas tabelas continua exigindo recorte, que e o que
   * impede um `state` de um cliente ser gasto por outro.
   */
  /\bDELETE FROM\s+(?:sso_login_states|saml_requests)\s+WHERE\s+expires_at\s*</i,
];

async function arquivosTs(dir: string): Promise<string[]> {
  const saida: string[] = [];

  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...(await arquivosTs(full)));
      continue;
    }
    if (entrada.name.endsWith(".ts") && !entrada.name.includes(".test.")) saida.push(full);
  }

  return saida;
}

/** Os template literals com cara de consulta. */
function consultas(code: string): string[] {
  return [...code.matchAll(/`([^`]*\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[^`]*)`/gis)].map(
    (m) => m[1] ?? "",
  );
}

function leTabelaRaiz(sql: string): boolean {
  return RAIZ.some((tabela) =>
    new RegExp(String.raw`\b(?:FROM|INTO|UPDATE|JOIN)\s+${tabela}\b`, "i").test(sql),
  );
}

/** `true` quando a consulta precisa declarar tenant e não declara. */
function semRecorte(sql: string): boolean {
  if (!leTabelaRaiz(sql)) return false;
  if (/tenant_id/i.test(sql)) return false;
  return !PERMITIDAS.some((padrao) => padrao.test(sql));
}

describe("Isolamento entre clientes, a forma das consultas", () => {
  test("toda leitura de tabela raiz declara tenant_id", async () => {
    const suspeitas: string[] = [];

    for (const arquivo of await arquivosTs(SRC)) {
      const code = await readFile(arquivo, "utf8");

      for (const sql of consultas(code)) {
        if (!semRecorte(sql)) continue;

        suspeitas.push(
          `${arquivo.replace(/.*src[\\/]/, "")}: ${sql.replace(/\s+/g, " ").slice(0, 80)}`,
        );
      }
    }

    assert.deepEqual(
      suspeitas,
      [],
      `consulta lendo tabela raiz sem tenant_id:\n    ${suspeitas.join("\n    ")}`,
    );
  });

  test("a varredura reprova o que deve reprovar", () => {
    /* Um teste que nunca viu a falha que protege não protege nada. Estas são
       exatamente as formas que causaram vazamento antes do recorte existir. */
    assert.equal(semRecorte("SELECT id, full_name FROM users ORDER BY full_name"), true);
    assert.equal(semRecorte("SELECT slug FROM courses"), true);
    assert.equal(
      semRecorte("SELECT id FROM courses WHERE status = 'published' ORDER BY title"),
      true,
    );

    /* As tabelas que a lista RAIZ ganhou depois. Cada fase nova trouxe as suas,
       e enquanto a lista ficou parada o guarda aprovou em silêncio justamente o
       que existe para reprovar — uma chave de API lida sem recorte devolve a
       chave de outro cliente. */
    assert.equal(semRecorte("SELECT id, name FROM api_keys ORDER BY created_at DESC"), true);
    assert.equal(semRecorte("SELECT id, url, secret FROM webhooks WHERE active"), true);
    assert.equal(semRecorte("SELECT id, title FROM quizzes"), true);
    assert.equal(semRecorte("SELECT id FROM questions ORDER BY created_at"), true);
  });

  test("a varredura aprova o que deve aprovar", () => {
    assert.equal(semRecorte("SELECT id FROM users WHERE tenant_id = $1"), false);
    assert.equal(semRecorte("SELECT id FROM users WHERE id = $1"), false);
    assert.equal(
      semRecorte("SELECT c.id FROM lessons l JOIN courses c ON c.id = l.id WHERE l.id = $1"),
      false,
    );
    /* Tabela que não é raiz nunca entra na conta. */
    assert.equal(semRecorte("SELECT id FROM modules ORDER BY position"), false);
  });
});
