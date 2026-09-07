import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guarda de regressão sobre o SQL do login.
 *
 * O repositório fala com o banco, então não dá para testá-lo sem PostgreSQL.
 * O que dá para verificar sem banco é a FORMA da consulta — e foi exatamente
 * aí que morava o defeito: `citext` ignora maiúsculas, mas o resultado de
 * `coluna || 'texto'` é `text`, e a comparação volta a ser sensível.
 *
 * Na prática: `USER.MOCK@NERDRESOLVEENERGY.COM` entrava (comparação direta com a
 * coluna citext) e `USER.MOCK` não (passava pela concatenação). O cast de
 * volta para `citext` é o que iguala os dois caminhos, e este teste existe
 * para que ninguém o remova sem perceber.
 */

const aqui = dirname(fileURLToPath(import.meta.url));

async function sqlDoRepositorio(): Promise<string> {
  return readFile(join(aqui, "users-repository.ts"), "utf8");
}

/** Só o conteúdo dos template literals com cara de consulta. */
function consultas(code: string): string[] {
  return [...code.matchAll(/`([^`]*(?:SELECT|UPDATE|DELETE|INSERT)[^`]*)`/gi)].map(
    (match) => match[1] ?? "",
  );
}

describe("SQL do login, insensível a maiúsculas no identificador", () => {
  test("toda concatenação com `email` volta para citext", async () => {
    /* O parêntese é opcional no padrão de propósito: é justamente ele que a
       correção introduz. Casar só a forma sem parênteses faria o teste parar
       de encontrar a consulta depois do conserto — e um teste que não acha o
       que audita passa por engano, em vez de proteger. */
    const encontradas = consultas(await sqlDoRepositorio()).filter((sql) =>
      /\bemail\s*=\s*\(?\s*\$\d+\s*\|\|/i.test(sql),
    );

    assert.ok(
      encontradas.length > 0,
      "esperava achar a consulta que aceita login curto, o teste ficou órfão",
    );

    for (const sql of encontradas) {
      assert.match(
        sql,
        /::citext/i,
        "concatenação com email (citext) sem cast de volta: " +
          "`USER.MOCK` deixaria de entrar enquanto `USER.MOCK@NERDRESOLVEENERGY.COM` entraria",
      );
    }
  });

  test("a busca por identificador não usa lower() à toa", async () => {
    /* `citext` já resolve. Um `lower()` aqui indicaria que alguém não
       percebeu isso e resolveu o sintoma por fora — e `lower(coluna)` impede
       o índice de ser usado, o que com 27 mil pessoas pesa. */
    const code = await sqlDoRepositorio();
    for (const sql of consultas(code)) {
      assert.ok(
        !/lower\s*\(\s*email\s*\)/i.test(sql),
        "email é citext: `lower(email)` é redundante e impede o uso do índice",
      );
    }
  });

  test("a senha não passa por normalização de caixa", async () => {
    /* Se alguém um dia aplicar a mesma ideia à senha, a entropia despenca:
       "NerdResolve2026!" e "nerdlms2026!" passariam a ser a mesma senha. */
    const code = await sqlDoRepositorio();
    assert.ok(
      !/lower\s*\(\s*password_hash\s*\)/i.test(code),
      "hash de senha não pode ser normalizado",
    );
  });
});
