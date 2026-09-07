import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { slugify, uniqueSlug } from "./slug.ts";

describe("Slug de curso", () => {
  test("tira acento em vez de tirar a letra", () => {
    // "ção" precisa virar "cao": remover o caractere inteiro daria "c",
    // e o slug deixaria de parecer com o título.
    assert.equal(slugify("Segurança em Operações de Campo"), "seguranca-em-operacoes-de-campo");
    assert.equal(slugify("Manutenção"), "manutencao");
  });

  test("pontuação e espaço viram um hífen só", () => {
    assert.equal(slugify("Água  —  potável (parte 1)"), "agua-potavel-parte-1");
  });

  test("não começa nem termina com hífen", () => {
    assert.equal(slugify("  ...Introdução!  "), "introducao");
  });

  test("título só de símbolo devolve vazio", () => {
    // Quem chama decide o que fazer; o slug não inventa nome.
    assert.equal(slugify("😀🎉"), "");
    assert.equal(slugify("---"), "");
  });

  test("corta em 80 e não deixa hífen na ponta", () => {
    const longo = slugify("palavra ".repeat(30));
    assert.ok(longo.length <= 80);
    assert.ok(!longo.endsWith("-"));
  });

  test("mantém números", () => {
    assert.equal(slugify("NR 33 — Espaço Confinado"), "nr-33-espaco-confinado");
  });
});

describe("Slug único", () => {
  test("sem colisão, usa o slug direto", () => {
    assert.equal(uniqueSlug("Integração", []), "integracao");
  });

  test("colidindo, numera a partir de 2", () => {
    // Começa em 2 porque o primeiro é o sem sufixo — um "-1" implicaria a
    // existência de um "-0".
    assert.equal(uniqueSlug("Integração", ["integracao"]), "integracao-2");
    assert.equal(uniqueSlug("Integração", ["integracao", "integracao-2"]), "integracao-3");
  });

  test("pula os números já usados", () => {
    assert.equal(
      uniqueSlug("Integração", ["integracao", "integracao-2", "integracao-4"]),
      "integracao-3",
    );
  });

  test("título sem forma legível cai para 'curso'", () => {
    // Sem isto o slug ficaria vazio e a URL seria /cursos/ — que é outra tela.
    assert.equal(uniqueSlug("😀", []), "curso");
    assert.equal(uniqueSlug("😀", ["curso"]), "curso-2");
  });
});
