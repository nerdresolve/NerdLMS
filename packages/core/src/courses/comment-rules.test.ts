import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { COMMENT_MAX_LENGTH, isHighlighted, validateComment } from "./comment-rules.ts";

describe("Publicação de comentário", () => {
  test("texto normal é aceito e vem aparado", () => {
    const decision = validateComment("  Boa explicação sobre retrolavagem.  ");
    assert.equal(decision.ok, true);
    assert.equal(decision.ok && decision.body, "Boa explicação sobre retrolavagem.");
  });

  test("vazio e só espaço são recusados", () => {
    // Vinte espaços é um comentário vazio. Aceitar encheria a aula de linhas
    // em branco que ninguém consegue apagar.
    for (const texto of ["", "   ", "\n\t ", "a"]) {
      const decision = validateComment(texto);
      assert.equal(decision.ok, false, JSON.stringify(texto));
      assert.equal(decision.ok === false && decision.reason, "empty", JSON.stringify(texto));
    }
  });

  test("acima do limite é recusado com mensagem, não com erro do banco", () => {
    const decision = validateComment("x".repeat(COMMENT_MAX_LENGTH + 1));
    assert.equal(decision.ok, false);
    assert.equal(decision.ok === false && decision.reason, "too_long");
  });

  test("exatamente no limite passa", () => {
    const decision = validateComment("x".repeat(COMMENT_MAX_LENGTH));
    assert.equal(decision.ok, true);
  });

  test("o autor do curso comenta como professor", () => {
    assert.equal(isHighlighted("u2", "u2"), true);
  });

  test("quem não escreveu o curso não recebe a tag", () => {
    // A tag é autoria de conteúdo, não hierarquia: nem o admin comenta como
    // professor num curso alheio (PRD §2, conflito 3).
    assert.equal(isHighlighted("u9", "u2"), false);
    assert.equal(isHighlighted("u1", "u2"), false);
  });
});
