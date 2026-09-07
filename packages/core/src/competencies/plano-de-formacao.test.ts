import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  cadeiaDoPlano,
  exigenciasEfetivas,
  fechariaCiclo,
  formacaoDaPessoa,
  oQueFalta,
  resumoDoCargo,
  type Exigencia,
  type OQuePessoaTem,
  type PlanoHerdavel,
} from "./plano-de-formacao.ts";
import type { Evidence } from "./proficiency.ts";

const AGORA = new Date("2026-06-01T12:00:00Z");

const evidencia = (over: Partial<Evidence> = {}): Evidence => ({
  id: "e1",
  competencyId: "c1",
  level: 2,
  source: "course",
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: null,
  revokedAt: null,
  ...over,
});

const nada: OQuePessoaTem = { trilhasConcluidas: [], cursosConcluidos: [], evidencias: [] };

const PLANO: Exigencia[] = [
  { id: "1", tipo: "trilha", alvoId: "t1", nome: "Integração" },
  { id: "2", tipo: "curso", alvoId: "cur1", nome: "NR-10" },
  { id: "3", tipo: "competencia", alvoId: "c1", nome: "Operar ETA", nivelExigido: 2 },
];

describe("Plano de formação: as três exigências", () => {
  test("nada cumprido é 0%", () => {
    const f = formacaoDaPessoa(PLANO, nada, AGORA);

    assert.equal(f.cumpridas, 0);
    assert.equal(f.total, 3);
    assert.equal(f.percentual, 0);
    assert.equal(f.completa, false);
  });

  test("tudo cumprido é 100% e formada", () => {
    const f = formacaoDaPessoa(
      PLANO,
      { trilhasConcluidas: ["t1"], cursosConcluidos: ["cur1"], evidencias: [evidencia()] },
      AGORA,
    );

    assert.equal(f.cumpridas, 3);
    assert.equal(f.percentual, 100);
    assert.equal(f.completa, true);
  });

  test("uma de três é 33%", () => {
    const f = formacaoDaPessoa(PLANO, { ...nada, trilhasConcluidas: ["t1"] }, AGORA);
    assert.equal(f.percentual, 33);
  });

  test("a competência exige o NÍVEL, não a existência", () => {
    const abaixo = formacaoDaPessoa(
      PLANO,
      { ...nada, evidencias: [evidencia({ level: 1 })] },
      AGORA,
    );

    const item = abaixo.itens.find((i) => i.tipo === "competencia");
    assert.equal(item?.cumprida, false);
    assert.equal(item?.nivelAtual, 1);
  });

  test("competência vencida deixa de cumprir", () => {
    /* É a diferença entre competência e badge: quem operou uma ETA em 2019 e
       nunca mais voltou não opera hoje. */
    const vencida = formacaoDaPessoa(
      PLANO,
      { ...nada, evidencias: [evidencia({ expiresAt: "2026-01-01T00:00:00Z" })] },
      AGORA,
    );

    assert.equal(vencida.itens.find((i) => i.tipo === "competencia")?.cumprida, false);
  });

  test("trilha e curso são tudo ou nada", () => {
    /* Meia trilha não é meia formação: ou a pessoa está formada naquilo, ou
       não está. Somar frações daria um número que parece progresso e não
       autoriza nada. */
    const f = formacaoDaPessoa(
      [{ id: "1", tipo: "trilha", alvoId: "t1", nome: "Integração" }],
      { ...nada, trilhasConcluidas: [] },
      AGORA,
    );

    assert.equal(f.percentual, 0);
  });
});

describe("Plano de formação: plano vazio", () => {
  test("plano sem exigência NÃO é 100%", () => {
    /* Dizer que alguém está formado por um plano que não pede nada seria a
       pior resposta possível para quem confia no número. */
    const f = formacaoDaPessoa([], nada, AGORA);

    assert.equal(f.percentual, 0);
    assert.equal(f.completa, false);
    assert.equal(f.total, 0);
  });
});

describe("Plano de formação: o que falta", () => {
  test("trilha antes de curso antes de competência", () => {
    /* A trilha costuma conter os cursos soltos: começar por ela evita mandar
       alguém fazer um curso que a trilha já traria. */
    const f = formacaoDaPessoa(PLANO, nada, AGORA);

    assert.deepEqual(oQueFalta(f).map((i) => i.tipo), ["trilha", "curso", "competencia"]);
  });

  test("o que já foi cumprido não aparece", () => {
    const f = formacaoDaPessoa(PLANO, { ...nada, trilhasConcluidas: ["t1"] }, AGORA);

    assert.equal(oQueFalta(f).length, 2);
    assert.ok(!oQueFalta(f).some((i) => i.tipo === "trilha"));
  });

  test("dentro do mesmo tipo, ordem alfabética", () => {
    const plano: Exigencia[] = [
      { id: "1", tipo: "curso", alvoId: "b", nome: "Zelo" },
      { id: "2", tipo: "curso", alvoId: "a", nome: "Água" },
    ];

    const f = formacaoDaPessoa(plano, nada, AGORA);
    assert.deepEqual(oQueFalta(f).map((i) => i.nome), ["Água", "Zelo"]);
  });
});

describe("Plano de formação: resumo do cargo", () => {
  const pessoa = (nome: string, percentual: number, completa: boolean) => ({
    id: nome,
    nome,
    formacao: { itens: [], cumpridas: 0, total: 3, percentual, completa },
  });

  test("conta quantas estão formadas, e a média das pessoas", () => {
    const resumo = resumoDoCargo("Operador", [
      pessoa("Ana", 100, true),
      pessoa("Bruno", 50, false),
      pessoa("Célia", 0, false),
    ]);

    assert.equal(resumo.pessoas, 3);
    assert.equal(resumo.formadas, 1);
    assert.equal(resumo.percentualMedio, 50);
  });

  test("cargo sem ninguém não divide por zero", () => {
    const resumo = resumoDoCargo("Vago", []);

    assert.deepEqual(resumo, { cargo: "Vago", pessoas: 0, formadas: 0, percentualMedio: 0 });
  });
});

describe("Herança entre planos", () => {
  const plano = (
    id: string,
    nome: string,
    continuaId: string | null,
    exigencias: Exigencia[],
  ) => ({ id, nome, continuaId, exigencias });

  const curso = (id: string, nome = id): Exigencia => ({
    id: `i-${id}`,
    tipo: "curso",
    alvoId: id,
    nome,
  });

  const competencia = (id: string, nivel: number): Exigencia => ({
    id: `i-${id}-${nivel}`,
    tipo: "competencia",
    alvoId: id,
    nome: id,
    nivelExigido: nivel,
  });

  const mapa = (...planos: PlanoHerdavel[]) => new Map(planos.map((p) => [p.id, p]));

  test("o plano herda o que o de baixo exige", () => {
    const porId = mapa(
      plano("jr", "JR", null, [curso("integracao")]),
      plano("pleno", "PLENO", "jr", [curso("lideranca")]),
    );

    const efetivas = exigenciasEfetivas("pleno", porId);
    assert.deepEqual(efetivas.map((e) => e.alvoId).sort(), ["integracao", "lideranca"]);
  });

  test("a herdada DIZ de onde veio, a própria não", () => {
    /* Sem isso a pessoa tenta remover a exigência herdada aqui e não entende
       por que ela volta: ela se edita no plano de origem. */
    const porId = mapa(
      plano("jr", "JR", null, [curso("integracao")]),
      plano("pleno", "PLENO", "jr", [curso("lideranca")]),
    );

    const efetivas = exigenciasEfetivas("pleno", porId);
    const porAlvo = new Map(efetivas.map((e) => [e.alvoId, e]));

    assert.equal(porAlvo.get("lideranca")?.herdadaDe, undefined);
    assert.equal(porAlvo.get("integracao")?.herdadaDe, "JR");
  });

  test("a cadeia atravessa três níveis", () => {
    const porId = mapa(
      plano("jr", "JR", null, [curso("a")]),
      plano("pleno", "PLENO", "jr", [curso("b")]),
      plano("senior", "SÊNIOR", "pleno", [curso("c")]),
    );

    assert.deepEqual(exigenciasEfetivas("senior", porId).map((e) => e.alvoId).sort(), [
      "a",
      "b",
      "c",
    ]);
  });

  test("o repetido conta UMA vez, e como do plano mais próximo", () => {
    /* Contar duas vezes faria o percentual de quem cumpriu aquele curso subir
       por uma repetição que ninguém quis declarar. */
    const porId = mapa(
      plano("jr", "JR", null, [curso("integracao")]),
      plano("pleno", "PLENO", "jr", [curso("integracao")]),
    );

    const efetivas = exigenciasEfetivas("pleno", porId);
    assert.equal(efetivas.length, 1);
    assert.equal(efetivas[0]?.herdadaDe, undefined, "vale como exigência do próprio plano");
  });

  test("competência repetida em níveis diferentes vale o MAIOR", () => {
    /* O plano de cima exigir menos que o de baixo seria um retrocesso na
       carreira, e a leitura não deve ajudar a escrevê-lo. */
    const maiorEmCima = exigenciasEfetivas(
      "pleno",
      mapa(
        plano("jr", "JR", null, [competencia("eta", 1)]),
        plano("pleno", "PLENO", "jr", [competencia("eta", 3)]),
      ),
    );
    assert.equal(maiorEmCima[0]?.nivelExigido, 3);

    const maiorEmBaixo = exigenciasEfetivas(
      "pleno",
      mapa(
        plano("jr", "JR", null, [competencia("eta", 3)]),
        plano("pleno", "PLENO", "jr", [competencia("eta", 1)]),
      ),
    );
    assert.equal(maiorEmBaixo[0]?.nivelExigido, 3);
  });

  test("a cadeia vai do próprio até a raiz, nessa ordem", () => {
    /* É ela que a tela mostra como "continua: PLENO → JR", para ninguém se
       perder sobre de onde vem cada exigência. */
    const porId = mapa(
      plano("jr", "JR", null, []),
      plano("pleno", "PLENO", "jr", []),
      plano("senior", "SÊNIOR", "pleno", []),
    );

    assert.deepEqual(cadeiaDoPlano("senior", porId).map((p) => p.nome), [
      "SÊNIOR",
      "PLENO",
      "JR",
    ]);
  });

  test("a cadeia de um plano desconhecido é vazia", () => {
    assert.deepEqual(cadeiaDoPlano("sumiu", mapa()), []);
  });

  test("plano sem herança devolve só o que ele exige", () => {
    const porId = mapa(plano("solo", "Solo", null, [curso("a")]));
    assert.deepEqual(exigenciasEfetivas("solo", porId).map((e) => e.alvoId), ["a"]);
  });

  test("pai inexistente não quebra a leitura", () => {
    /* Acontece quando o plano pai é apagado: a coluna vira nula por `SET NULL`,
       mas um dado restaurado pela metade pode apontar para o nada. */
    const porId = mapa(plano("orfao", "Órfão", "sumiu", [curso("a")]));
    assert.deepEqual(exigenciasEfetivas("orfao", porId).map((e) => e.alvoId), ["a"]);
  });
});

describe("Herança: ciclos", () => {
  const plano = (id: string, continuaId: string | null) => ({
    id,
    nome: id,
    continuaId,
    exigencias: [{ id: `i-${id}`, tipo: "curso" as const, alvoId: id, nome: id }],
  });

  const mapa = (...planos: PlanoHerdavel[]) => new Map(planos.map((p) => [p.id, p]));

  test("a resolução não trava num ciclo", () => {
    /* O caso de uso recusa criar isto; a leitura ainda se protege, porque um
       dado pode chegar estragado por restauração de backup. Travar a tela seria
       a pior forma de descobrir. */
    const porId = mapa(plano("a", "b"), plano("b", "a"));

    const efetivas = exigenciasEfetivas("a", porId);
    assert.deepEqual(efetivas.map((e) => e.alvoId).sort(), ["a", "b"]);
  });

  test("continuar a si mesmo é ciclo", () => {
    assert.equal(fechariaCiclo("a", "a", mapa(plano("a", null))), true);
  });

  test("fechar o laço pelo avô é ciclo", () => {
    /* a → b → c; fazer c continuar a fecharia o laço. */
    const porId = mapa(plano("a", "b"), plano("b", "c"), plano("c", null));
    assert.equal(fechariaCiclo("c", "a", porId), true);
  });

  test("herdar de um plano sem relação não é ciclo", () => {
    const porId = mapa(plano("a", null), plano("b", null));
    assert.equal(fechariaCiclo("b", "a", porId), false);
  });
});
