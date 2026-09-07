import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildCategoryTree,
  categoryPath,
  formatWorkload,
  LEVEL_LABEL,
  normalizeTagName,
  objectiveLines,
  slugify,
  validateMetadata,
} from "./metadata.ts";

describe("Carga horária declarada", () => {
  test("minutos viram horas legíveis", () => {
    assert.equal(formatWorkload(240), "4h");
    assert.equal(formatWorkload(90), "1h30");
    assert.equal(formatWorkload(45), "45min");
  });

  test("não inventa carga quando não há", () => {
    // Curso sem carga declarada mostra outra coisa na tela; devolver "0h" faria
    // parecer um curso vazio.
    assert.equal(formatWorkload(undefined), null);
    assert.equal(formatWorkload(0), null);
  });

  test("uma hora exata não vira '1h00'", () => {
    assert.equal(formatWorkload(60), "1h");
  });
});

describe("Slug", () => {
  test("acento e caixa somem", () => {
    assert.equal(slugify("Segurança do Trabalho"), "seguranca-do-trabalho");
  });

  test("pontuação vira hífen, sem repetir", () => {
    assert.equal(slugify("NR-10 / Elétrica!"), "nr-10-eletrica");
  });

  test("não sobra hífen nas pontas", () => {
    assert.equal(slugify("  --Água--  "), "agua");
  });

  test("texto sem letra nenhuma não vira slug vazio", () => {
    // Um slug vazio quebraria a restrição do banco (`slug ~ '^[a-z0-9-]+$'`).
    assert.equal(slugify("!!!"), null);
    assert.equal(slugify(""), null);
  });
});

describe("Tags — o mesmo assunto escrito de três formas", () => {
  test("normaliza para comparar", () => {
    // "NR-10", "NR10" e "nr 10" precisam colidir, senão viram três tags.
    const alvo = normalizeTagName("NR-10");
    assert.equal(normalizeTagName("nr 10"), alvo);
    assert.equal(normalizeTagName("  NR-10  "), alvo);
  });

  test("tags diferentes continuam diferentes", () => {
    assert.notEqual(normalizeTagName("NR-10"), normalizeTagName("NR-35"));
  });
});

describe("Validação dos metadados", () => {
  test("aceita o que está em branco", () => {
    // Todo campo é opcional: curso antigo não tem nada disso.
    assert.deepEqual(validateMetadata({}), []);
  });

  test("carga horária negativa ou zero é recusada", () => {
    assert.ok(validateMetadata({ workloadMinutes: -1 }).length > 0);
    assert.ok(validateMetadata({ workloadMinutes: 0 }).length > 0);
  });

  test("fim antes do início é recusado", () => {
    const erros = validateMetadata({ startsOn: "2026-05-10", endsOn: "2026-05-01" });
    assert.ok(erros.some((e) => e.includes("encerramento")));
  });

  test("mesmo dia é válido — curso de um dia existe", () => {
    assert.deepEqual(validateMetadata({ startsOn: "2026-05-10", endsOn: "2026-05-10" }), []);
  });

  test("idioma fora do formato BCP 47 é recusado", () => {
    // O CHECK do banco recusaria; falhar aqui dá mensagem em vez de erro 500.
    assert.ok(validateMetadata({ language: "português" }).length > 0);
    assert.deepEqual(validateMetadata({ language: "pt-BR" }), []);
    assert.deepEqual(validateMetadata({ language: "en" }), []);
  });

  test("código com espaço é recusado", () => {
    assert.ok(validateMetadata({ code: "NR 10 " }).length > 0);
  });
});

describe("Objetivos de aprendizagem", () => {
  test("uma linha por objetivo, sem vazias", () => {
    assert.deepEqual(objectiveLines("Identificar riscos\n\n  Aplicar a norma  \n"), [
      "Identificar riscos",
      "Aplicar a norma",
    ]);
  });

  test("texto ausente é lista vazia, não uma linha em branco", () => {
    assert.deepEqual(objectiveLines(undefined), []);
    assert.deepEqual(objectiveLines("   "), []);
  });
});

describe("Árvore de categorias", () => {
  const linhas = [
    { id: "c1", name: "Segurança", slug: "seguranca", parentId: null, position: 1, courseCount: 2 },
    { id: "c2", name: "Elétrica", slug: "eletrica", parentId: "c1", position: 1, courseCount: 3 },
    { id: "c3", name: "Altura", slug: "altura", parentId: "c1", position: 2, courseCount: 1 },
    { id: "c4", name: "Operação", slug: "operacao", parentId: null, position: 2, courseCount: 5 },
  ];

  test("monta a hierarquia a partir das linhas", () => {
    const arvore = buildCategoryTree(linhas);

    assert.equal(arvore.length, 2);
    assert.equal(arvore[0]?.name, "Segurança");
    assert.equal(arvore[0]?.children.length, 2);
    assert.equal(arvore[1]?.children.length, 0);
  });

  test("a contagem SOBE na árvore", () => {
    // Uma categoria mãe precisa mostrar o total dela e das filhas: quem clica
    // em "Segurança" espera ver os cursos de Elétrica e Altura também.
    const arvore = buildCategoryTree(linhas);
    assert.equal(arvore[0]?.courseCount, 6); // 2 próprios + 3 + 1
  });

  test("respeita a posição, não a ordem alfabética", () => {
    // Categoria é navegação, e o cliente escolhe a ordem de exibição.
    const arvore = buildCategoryTree(linhas);
    assert.deepEqual(
      arvore[0]?.children.map((c) => c.name),
      ["Elétrica", "Altura"],
    );
  });

  test("categoria órfã não some", () => {
    // Se o pai foi apagado numa corrida, a filha ainda precisa aparecer —
    // sumir silenciosamente esconderia cursos do catálogo.
    const arvore = buildCategoryTree([
      { id: "x", name: "Perdida", slug: "perdida", parentId: "nao-existe", position: 1, courseCount: 1 },
    ]);

    assert.equal(arvore.length, 1);
    assert.equal(arvore[0]?.name, "Perdida");
  });

  test("ciclo não trava a montagem", () => {
    // Dado corrompido não pode derrubar o catálogo inteiro.
    const arvore = buildCategoryTree([
      { id: "a", name: "A", slug: "a", parentId: "b", position: 1, courseCount: 0 },
      { id: "b", name: "B", slug: "b", parentId: "a", position: 1, courseCount: 0 },
    ]);

    assert.ok(Array.isArray(arvore));
  });
});

describe("Caminho da categoria", () => {
  test("mostra a hierarquia para o leitor", () => {
    assert.equal(categoryPath({ id: "c2", name: "Elétrica", slug: "eletrica", parentName: "Segurança" }), "Segurança › Elétrica");
  });

  test("categoria raiz aparece sozinha", () => {
    assert.equal(categoryPath({ id: "c1", name: "Segurança", slug: "seguranca" }), "Segurança");
  });
});

describe("Rótulo de nível", () => {
  test("os três níveis têm nome em português", () => {
    assert.equal(LEVEL_LABEL.basic, "Básico");
    assert.equal(LEVEL_LABEL.intermediate, "Intermediário");
    assert.equal(LEVEL_LABEL.advanced, "Avançado");
  });
});
