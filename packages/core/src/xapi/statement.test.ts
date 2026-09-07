import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  actorEmail,
  buildStatement,
  parseIsoDuration,
  toIsoDuration,
  validateStatement,
  VERBS,
} from "./statement.ts";

/** Um statement mínimo válido, para os testes variarem uma coisa por vez. */
function valido(over: Record<string, unknown> = {}) {
  return {
    actor: { mbox: "mailto:maria@exemplo.com", name: "Maria Souza" },
    verb: {
      id: "http://adlnet.gov/expapi/verbs/completed",
      display: { "pt-BR": "completou", "en-US": "completed" },
    },
    object: {
      id: "https://sim.exemplo.com.br/parada-bomba",
      name: "Simulação: parada de bomba",
    },
    ...over,
  };
}

describe("xAPI, statements: F6-03", () => {
  test("aceita o statement mínimo", () => {
    const resultado = validateStatement(valido());

    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.statement.actorEmail, "maria@exemplo.com");
    assert.equal(resultado.statement.verbId, "http://adlnet.gov/expapi/verbs/completed");
    assert.equal(resultado.statement.verbDisplay, "completou");
    assert.equal(resultado.statement.objectType, "Activity");
  });

  test("recusa o que falta, sem consertar", () => {
    /* Um LRS que "corrige" o que chega devolve, na consulta, algo diferente do
       que foi mandado — e quem integra passa a depender de uma correção que não
       está escrita em lugar nenhum. */
    assert.deepEqual(validateStatement(null), { ok: false, error: "missing_actor" });
    assert.deepEqual(validateStatement({}), { ok: false, error: "missing_actor" });

    const semVerbo = validateStatement({ actor: {}, object: { id: "https://a" } });
    assert.deepEqual(semVerbo, { ok: false, error: "missing_verb" });

    const semObjeto = validateStatement({ actor: {}, verb: { id: "https://v" } });
    assert.deepEqual(semObjeto, { ok: false, error: "missing_object" });
  });

  test("o verbo precisa ser IRI, não palavra", () => {
    /* "completed" solto não significa nada fora daqui — é o IRI que torna o
       verbo comparável entre sistemas, que é o ponto do xAPI. */
    const resultado = validateStatement(valido({ verb: { id: "completed" } }));

    assert.deepEqual(resultado, { ok: false, error: "invalid_verb_iri" });
  });

  test("o objeto também precisa ser IRI", () => {
    const resultado = validateStatement(
      valido({ object: { id: "simulacao-parada-bomba" } }),
    );

    assert.deepEqual(resultado, { ok: false, error: "invalid_object_iri" });
  });

  test("score.scaled fora de -1..1 é recusado", () => {
    /* O padrão define o intervalo. Aceitar 1.5 produziria "150%" em qualquer
       relatório. */
    for (const scaled of [1.5, -2, 99]) {
      assert.deepEqual(
        validateStatement(valido({ result: { score: { scaled } } })),
        { ok: false, error: "invalid_score" },
      );
    }

    /* As pontas são válidas: -1 e 1 são valores legítimos. */
    for (const scaled of [-1, 0, 1, 0.85]) {
      assert.equal(validateStatement(valido({ result: { score: { scaled } } })).ok, true);
    }
  });

  test("id que não é UUID é recusado", () => {
    assert.deepEqual(validateStatement(valido({ id: "abc" })), {
      ok: false,
      error: "invalid_id",
    });

    assert.equal(
      validateStatement(valido({ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" })).ok,
      true,
    );
  });

  test("timestamp inválido é recusado; ausente vira agora", () => {
    assert.deepEqual(validateStatement(valido({ timestamp: "ontem" })), {
      ok: false,
      error: "invalid_timestamp",
    });

    const semData = validateStatement(valido());
    assert.equal(semData.ok, true);
    if (semData.ok) assert.ok(!Number.isNaN(new Date(semData.statement.timestamp).getTime()));
  });

  test("o display do verbo prefere português e sempre tem saída", () => {
    const soIngles = validateStatement(
      valido({ verb: { id: "https://v/x", display: { "en-US": "completed" } } }),
    );
    assert.equal(soIngles.ok && soIngles.statement.verbDisplay, "completed");

    /* Sem display nenhum, o último pedaço do IRI serve — melhor que vazio. */
    const semDisplay = validateStatement(
      valido({ verb: { id: "http://adlnet.gov/expapi/verbs/attended" } }),
    );
    assert.equal(semDisplay.ok && semDisplay.statement.verbDisplay, "attended");
  });

  test("duração ISO 8601 vira segundos", () => {
    assert.equal(parseIsoDuration("PT1H30M"), 5400);
    assert.equal(parseIsoDuration("PT45S"), 45);
    assert.equal(parseIsoDuration("PT1H30M45S"), 5445);
    assert.equal(parseIsoDuration("P1D"), 86400);
    assert.equal(parseIsoDuration("PT0S"), 0);

    /* Fração no segundo: o padrão permite, e simuladores usam. */
    assert.equal(parseIsoDuration("PT4.5S"), 5);
  });

  test("duração malformada devolve nulo, não zero", () => {
    /* Zero afirmaria que a atividade durou nada; nulo diz que não se sabe. */
    assert.equal(parseIsoDuration("uma hora"), null);
    assert.equal(parseIsoDuration(""), null);
    assert.equal(parseIsoDuration("P"), null);
    assert.equal(parseIsoDuration("1H30M"), null);
  });

  test("segundos voltam para ISO 8601", () => {
    assert.equal(toIsoDuration(5400), "PT1H30M");
    assert.equal(toIsoDuration(45), "PT45S");
    assert.equal(toIsoDuration(5445), "PT1H30M45S");

    /* "PT" sozinho é inválido: duração zero precisa dizer zero. */
    assert.equal(toIsoDuration(0), "PT0S");
    assert.equal(toIsoDuration(-5), "PT0S");
  });

  test("ida e volta da duração preserva o valor", () => {
    for (const segundos of [0, 1, 59, 60, 3599, 3600, 5445, 86399]) {
      assert.equal(parseIsoDuration(toIsoDuration(segundos)), segundos);
    }
  });

  test("o e-mail do ator perde o mailto: e a caixa", () => {
    assert.equal(actorEmail({ mbox: "mailto:Maria@exemplo.com" }), "maria@exemplo.com");
    assert.equal(actorEmail({ mbox: "maria@exemplo.com" }), "maria@exemplo.com");
    assert.equal(actorEmail({}), null);

    /* O que não é e-mail não vira e-mail. */
    assert.equal(actorEmail({ mbox: "mailto:nao-e-email" }), null);
  });

  test("statement de ator sem e-mail continua válido", () => {
    /* Um simulador pode identificar por conta de outro sistema. Perder o
       statement porque não veio e-mail seria perder o que aconteceu. */
    const resultado = validateStatement(
      valido({ actor: { account: { homePage: "https://sim.exemplo", name: "op-4471" } } }),
    );

    assert.equal(resultado.ok, true);
    if (resultado.ok) assert.equal(resultado.statement.actorEmail, null);
  });

  test("o statement que a plataforma gera aponta para si mesma", () => {
    /* O IRI do objeto é a URL nesta instalação: é o que distingue a aula 5
       daqui da aula 5 de outro cliente, e o que permite rastrear de volta. */
    const statement = buildStatement({
      baseUrl: "https://ead.exemplo.com.br",
      actorEmail: "maria@exemplo.com",
      actorName: "Maria Souza",
      verb: "completed",
      objectPath: "/aulas/abc-123",
      objectName: "Coagulação e floculação",
      result: { completion: true, duration: "PT26M" },
    });

    assert.equal(statement.object.id, "https://ead.exemplo.com.br/aulas/abc-123");
    assert.equal(statement.verb.id, VERBS.completed.id);
    assert.equal(statement.actor.mbox, "mailto:maria@exemplo.com");
    assert.equal(statement.result?.completion, true);

    /* E o que a plataforma gera precisa passar na própria validação. */
    assert.equal(validateStatement(statement).ok, true);
  });

  test("statement gerado sem e-mail não inventa mbox vazio", () => {
    const statement = buildStatement({
      baseUrl: "https://ead.exemplo.com.br",
      actorEmail: null,
      actorName: "Sem E-mail",
      verb: "experienced",
      objectPath: "/cursos/x",
      objectName: "Curso",
    });

    assert.equal("mbox" in statement.actor, false);
    assert.equal(validateStatement(statement).ok, true);
  });
});
