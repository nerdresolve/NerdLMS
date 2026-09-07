import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isCompleted,
  isPassed,
  parseCmiTime,
  formatCmiTime,
  scormValue,
  setScormValue,
  type ScormState,
} from "./runtime.ts";

const estado = (over: Partial<ScormState> = {}): ScormState => ({
  lessonStatus: "not attempted",
  totalTimeSeconds: 0,
  ...over,
});

describe("Tempo no formato do SCORM (HHHH:MM:SS.SS)", () => {
  test("lê o formato do padrão", () => {
    assert.equal(parseCmiTime("00:05:30"), 330);
    assert.equal(parseCmiTime("01:00:00"), 3600);
  });

  test("aceita centésimos", () => {
    // O 1.2 permite `.SS`; ignorar a parte fracionária perderia meio segundo
    // por sessão, e o total acumula.
    assert.equal(parseCmiTime("00:00:10.50"), 10.5);
  });

  test("aceita horas com mais de dois dígitos", () => {
    // O padrão permite até quatro: um curso longo passa de 99 horas.
    assert.equal(parseCmiTime("0100:00:00"), 360000);
  });

  test("formato inválido vira zero, sem quebrar", () => {
    // O conteúdo SCORM é de terceiro; um valor torto não pode derrubar o
    // salvamento do progresso.
    for (const ruim of ["", "abc", "1:2", "00:00"]) {
      assert.equal(parseCmiTime(ruim), 0);
    }
  });

  test("escreve de volta no formato do padrão", () => {
    assert.equal(formatCmiTime(330), "00:05:30");
    assert.equal(formatCmiTime(3600), "01:00:00");
    assert.equal(formatCmiTime(0), "00:00:00");
  });

  test("ida e volta preserva o valor", () => {
    for (const s of [0, 59, 60, 3599, 3600, 86400]) {
      assert.equal(parseCmiTime(formatCmiTime(s)), s);
    }
  });
});

describe("Conclusão a partir do lesson_status", () => {
  test("completed e passed contam como concluído", () => {
    assert.equal(isCompleted(estado({ lessonStatus: "completed" })), true);
    assert.equal(isCompleted(estado({ lessonStatus: "passed" })), true);
  });

  test("incomplete e browsed NÃO concluem", () => {
    assert.equal(isCompleted(estado({ lessonStatus: "incomplete" })), false);
    assert.equal(isCompleted(estado({ lessonStatus: "browsed" })), false);
  });

  test("failed não conclui", () => {
    // Reprovado é diferente de concluído: quem reprovou precisa refazer.
    assert.equal(isCompleted(estado({ lessonStatus: "failed" })), false);
  });

  test("not attempted não conclui", () => {
    assert.equal(isCompleted(estado()), false);
  });
});

describe("Aprovação", () => {
  test("passed aprova", () => {
    assert.equal(isPassed(estado({ lessonStatus: "passed" }), undefined), true);
  });

  test("failed reprova", () => {
    assert.equal(isPassed(estado({ lessonStatus: "failed" }), undefined), false);
  });

  test("com nota de corte, a nota decide", () => {
    // Alguns pacotes marcam `completed` e deixam a nota falar.
    const bom = estado({ lessonStatus: "completed", scoreRaw: 80 });
    const ruim = estado({ lessonStatus: "completed", scoreRaw: 50 });

    assert.equal(isPassed(bom, 70), true);
    assert.equal(isPassed(ruim, 70), false);
  });

  test("sem nota de corte, completed basta", () => {
    assert.equal(isPassed(estado({ lessonStatus: "completed" }), undefined), true);
  });

  test("nota de corte sem nota registrada não aprova", () => {
    // O pacote exige 70 e não informou nota: liberar seria dar aprovação a
    // quem não foi medido.
    assert.equal(isPassed(estado({ lessonStatus: "completed" }), 70), false);
  });

  test("`passed` explícito ganha da nota de corte", () => {
    // Se o próprio conteúdo diz que passou, ele sabe da regra dele.
    assert.equal(isPassed(estado({ lessonStatus: "passed", scoreRaw: 10 }), 70), true);
  });
});

describe("Leitura de valores CMI", () => {
  const e = estado({
    lessonStatus: "incomplete",
    scoreRaw: 42,
    suspendData: "pagina=7",
    lessonLocation: "cap3",
    totalTimeSeconds: 330,
  });

  test("devolve os campos do modelo", () => {
    assert.equal(scormValue(e, "cmi.core.lesson_status"), "incomplete");
    assert.equal(scormValue(e, "cmi.core.score.raw"), "42");
    assert.equal(scormValue(e, "cmi.suspend_data"), "pagina=7");
    assert.equal(scormValue(e, "cmi.core.lesson_location"), "cap3");
  });

  test("total_time sai no formato do padrão", () => {
    assert.equal(scormValue(e, "cmi.core.total_time"), "00:05:30");
  });

  test("campo não preenchido devolve vazio, não `undefined`", () => {
    // O conteúdo espera string; `undefined` viraria "undefined" na tela dele.
    assert.equal(scormValue(estado(), "cmi.suspend_data"), "");
    assert.equal(scormValue(estado(), "cmi.core.score.raw"), "");
  });

  test("campo desconhecido devolve vazio", () => {
    assert.equal(scormValue(e, "cmi.inventado.qualquer"), "");
  });

  test("`cmi.core.credit` e `lesson_mode` têm valor fixo", () => {
    // O conteúdo consulta os dois antes de decidir se registra nota.
    assert.equal(scormValue(e, "cmi.core.credit"), "credit");
    assert.equal(scormValue(e, "cmi.core.lesson_mode"), "normal");
  });
});

describe("Escrita de valores CMI", () => {
  test("grava status e nota", () => {
    const e = setScormValue(estado(), "cmi.core.lesson_status", "completed");
    assert.equal(e.lessonStatus, "completed");

    const comNota = setScormValue(e, "cmi.core.score.raw", "88");
    assert.equal(comNota.scoreRaw, 88);
  });

  test("session_time ACUMULA no total", () => {
    // É a razão de `total_time` ser separado: cada sessão soma, e o SCORM só
    // informa a duração da sessão atual.
    let e = estado({ totalTimeSeconds: 600 });
    e = setScormValue(e, "cmi.core.session_time", "00:05:00");

    assert.equal(e.totalTimeSeconds, 900);
  });

  test("nota fora de número é ignorada", () => {
    const e = setScormValue(estado({ scoreRaw: 50 }), "cmi.core.score.raw", "abc");
    assert.equal(e.scoreRaw, 50);
  });

  test("status inválido é ignorado", () => {
    // Só os oito valores do padrão. Um valor livre quebraria `isCompleted`.
    const e = setScormValue(estado({ lessonStatus: "incomplete" }), "cmi.core.lesson_status", "qualquer");
    assert.equal(e.lessonStatus, "incomplete");
  });

  test("campo somente-leitura não é gravado", () => {
    // `total_time` é calculado; o conteúdo não pode reescrevê-lo direto.
    const e = setScormValue(estado({ totalTimeSeconds: 600 }), "cmi.core.total_time", "99:00:00");
    assert.equal(e.totalTimeSeconds, 600);
  });

  test("não modifica o estado original", () => {
    const original = estado({ lessonStatus: "incomplete" });
    setScormValue(original, "cmi.core.lesson_status", "completed");

    assert.equal(original.lessonStatus, "incomplete");
  });
});
