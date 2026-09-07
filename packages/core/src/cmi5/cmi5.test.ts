import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  CMI5_VERBS,
  ehDaPlataforma,
  estadoDaSessao,
  moveOnSatisfeito,
  podeSerEmitidoPeloConteudo,
  validarSequencia,
  verbFromIri,
  type Cmi5Verb,
  type SessionState,
} from "./cmi5.ts";

function estado(over: Partial<SessionState> = {}): SessionState {
  return { completed: false, passed: null, waived: false, encerrada: false, ...over };
}

function log(...verbos: Cmi5Verb[]) {
  return { verbos };
}

describe("cmi5, o moveOn decide, e só ele", () => {
  test("Completed exige concluir, e não se importa com nota", () => {
    assert.equal(moveOnSatisfeito("Completed", estado({ completed: true, passed: false })), true);
    assert.equal(moveOnSatisfeito("Completed", estado({ completed: false, passed: true })), false);
  });

  test("Passed exige aprovação, e não se importa com conclusão", () => {
    assert.equal(moveOnSatisfeito("Passed", estado({ passed: true })), true);
    assert.equal(moveOnSatisfeito("Passed", estado({ completed: true })), false);
  });

  test("CompletedAndPassed exige os dois", () => {
    assert.equal(
      moveOnSatisfeito("CompletedAndPassed", estado({ completed: true, passed: true })),
      true,
    );
    assert.equal(
      moveOnSatisfeito("CompletedAndPassed", estado({ completed: true })),
      false,
    );
  });

  test("CompletedOrPassed aceita qualquer um", () => {
    assert.equal(moveOnSatisfeito("CompletedOrPassed", estado({ completed: true })), true);
    assert.equal(moveOnSatisfeito("CompletedOrPassed", estado({ passed: true })), true);
    assert.equal(moveOnSatisfeito("CompletedOrPassed", estado()), false);
  });

  test("NotApplicable ainda exige ter aberto e encerrado", () => {
    /* Sem isto, uma unidade `NotApplicable` contaria como cumprida antes de a
       pessoa abri-la. */
    assert.equal(moveOnSatisfeito("NotApplicable", estado()), false);
    assert.equal(moveOnSatisfeito("NotApplicable", estado({ encerrada: true })), true);
  });

  test("dispensa vale para qualquer critério", () => {
    /* Quem foi dispensado não precisa fazer — é o sentido de dispensar. */
    for (const criterio of ["Passed", "Completed", "CompletedAndPassed"] as const) {
      assert.equal(moveOnSatisfeito(criterio, estado({ waived: true })), true);
    }
  });

  test("reprovar não satisfaz Passed", () => {
    assert.equal(moveOnSatisfeito("Passed", estado({ passed: false })), false);
  });
});

describe("cmi5, quem pode emitir o quê", () => {
  test("o conteúdo não emite satisfied", () => {
    /* Emitir `satisfied` é decidir sozinho que o curso foi cumprido, ignorando
       o `moveOn` que o autor declarou. A decisão é da plataforma. */
    assert.equal(podeSerEmitidoPeloConteudo("satisfied"), false);
    assert.equal(ehDaPlataforma("satisfied"), true);
  });

  test("o conteúdo não emite waived nem launched", () => {
    assert.equal(podeSerEmitidoPeloConteudo("waived"), false);
    assert.equal(podeSerEmitidoPeloConteudo("launched"), false);
  });

  test("o conteúdo emite o que só ele sabe", () => {
    for (const v of ["initialized", "completed", "passed", "failed", "terminated"] as const) {
      assert.equal(podeSerEmitidoPeloConteudo(v), true, v);
    }
  });

  test("o IRI volta ao verbo", () => {
    assert.equal(verbFromIri(CMI5_VERBS.completed), "completed");
    assert.equal(verbFromIri(CMI5_VERBS.abandoned), "abandoned");
    assert.equal(verbFromIri("http://exemplo.com/verbo-inventado"), null);
  });
});

describe("cmi5, a ordem da sessão", () => {
  test("o caminho normal passa", () => {
    assert.equal(validarSequencia("initialized", log("launched")).ok, true);
    assert.equal(validarSequencia("completed", log("launched", "initialized")).ok, true);
    assert.equal(
      validarSequencia("terminated", log("launched", "initialized", "completed")).ok,
      true,
    );
  });

  test("conclusão sem ter inicializado é recusada", () => {
    /* O conteúdo estaria relatando uma sessão que a plataforma nunca abriu:
       pode ser defeito, pode ser statement forjado por quem leu a chave de
       API. Aceitar daria conclusão a quem nunca abriu a aula. */
    const r = validarSequencia("completed", log("launched"));
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.erro, "fora_de_ordem");
  });

  test("inicializar sem a plataforma ter aberto é recusado", () => {
    const r = validarSequencia("initialized", log());
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.erro, "sem_sessao");
  });

  test("nada entra depois de encerrar", () => {
    const r = validarSequencia("passed", log("launched", "initialized", "terminated"));
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.erro, "sessao_encerrada");
  });

  test("abandonar também encerra", () => {
    const r = validarSequencia("completed", log("launched", "initialized", "abandoned"));
    assert.equal(r.ok === false && r.erro, "sessao_encerrada");
  });

  test("resultado não se repete", () => {
    /* Dois `passed` na mesma sessão seriam dois registros da mesma aprovação, e
       o relatório contaria duas vezes. */
    const r = validarSequencia("passed", log("launched", "initialized", "passed"));
    assert.equal(r.ok === false && r.erro, "duplicado");
  });

  test("inicializar duas vezes é recusado", () => {
    const r = validarSequencia("initialized", log("launched", "initialized"));
    assert.equal(r.ok === false && r.erro, "duplicado");
  });

  test("verbo da plataforma vindo pela API é recusado", () => {
    /* Se `satisfied` chegou pela API de statements, alguém está emitindo em
       nome da plataforma. */
    for (const v of ["satisfied", "waived", "launched"] as const) {
      const r = validarSequencia(v, log("launched", "initialized"));
      assert.equal(r.ok === false && r.erro, "verbo_da_plataforma", v);
    }
  });

  test("passar e concluir na mesma sessão é normal", () => {
    const parcial = log("launched", "initialized", "completed");
    assert.equal(validarSequencia("passed", parcial).ok, true);
  });
});

describe("cmi5, o estado que sai dos verbos", () => {
  test("quem não se pronunciou não reprovou ninguém", () => {
    /* Tratar ausência como reprovação daria "não aprovado" a quem apenas não
       terminou. */
    assert.equal(estadoDaSessao(log("launched", "initialized")).passed, null);
    assert.equal(estadoDaSessao(log("launched", "initialized", "failed")).passed, false);
    assert.equal(estadoDaSessao(log("launched", "initialized", "passed")).passed, true);
  });

  test("terminar e abandonar encerram igual", () => {
    assert.equal(estadoDaSessao(log("terminated")).encerrada, true);
    assert.equal(estadoDaSessao(log("abandoned")).encerrada, true);
  });

  test("a dispensa pode vir de fora dos verbos", () => {
    /* A plataforma dispensa alguém por decisão administrativa, sem que a
       sessão tenha acontecido. */
    assert.equal(estadoDaSessao(log(), true).waived, true);
  });

  test("uma sessão completa vira um estado completo", () => {
    const e = estadoDaSessao(log("launched", "initialized", "completed", "passed", "terminated"));

    assert.deepEqual(e, { completed: true, passed: true, waived: false, encerrada: true });
    assert.equal(moveOnSatisfeito("CompletedAndPassed", e), true);
  });
});
