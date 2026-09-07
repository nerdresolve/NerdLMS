import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  formatIso8601Duration,
  isCompleted2004,
  isPassed2004,
  parseIso8601Duration,
  scorm2004Value,
  setScorm2004Value,
  to2004Summary,
  type Scorm2004State,
} from "./runtime-2004.ts";

function estado(over: Partial<Scorm2004State> = {}): Scorm2004State {
  return {
    completionStatus: "not attempted",
    successStatus: "unknown",
    totalTimeSeconds: 0,
    exit: "",
    ...over,
  };
}

describe("SCORM 2004 — duração ISO 8601", () => {
  test("lê as formas que os pacotes usam", () => {
    assert.equal(parseIso8601Duration("PT1H30M45S"), 5445);
    assert.equal(parseIso8601Duration("PT30M"), 1800);
    assert.equal(parseIso8601Duration("PT45S"), 45);
    assert.equal(parseIso8601Duration("PT0S"), 0);
  });

  test("aceita fração de segundo", () => {
    assert.equal(parseIso8601Duration("PT1.5S"), 1.5);
  });

  test("aceita dias — um pacote que os declare não perde o tempo", () => {
    assert.equal(parseIso8601Duration("P1DT2H"), 24 * 3600 + 7200);
  });

  test("lixo devolve zero, não derruba o salvamento", () => {
    /* O conteúdo é de terceiro. Um valor torto não pode impedir que o
       progresso de quem está estudando seja gravado. */
    assert.equal(parseIso8601Duration("1:30:00"), 0);
    assert.equal(parseIso8601Duration(""), 0);
    assert.equal(parseIso8601Duration("P"), 0);
    assert.equal(parseIso8601Duration("bagunça"), 0);
  });

  test("escreve de volta no formato do padrão", () => {
    assert.equal(formatIso8601Duration(5445), "PT1H30M45S");
    assert.equal(formatIso8601Duration(1800), "PT30M");
    assert.equal(formatIso8601Duration(0), "PT0S");
  });

  test("cem horas não viram dias", () => {
    /* `P4DT4H` estaria certo pelo padrão e seria ilegível num relatório de
       tempo de estudo. */
    assert.equal(formatIso8601Duration(360000), "PT100H");
  });

  test("o que sai volta igual ao que entrou", () => {
    for (const segundos of [0, 45, 1800, 5445, 360000]) {
      assert.equal(parseIso8601Duration(formatIso8601Duration(segundos)), segundos);
    }
  });
});

describe("SCORM 2004 — concluir e passar são coisas SEPARADAS", () => {
  test("concluir a aula não é passar na prova", () => {
    /* É a diferença que o 2004 existe para expressar: quem reprova VIU a aula
       inteira, e o progresso do curso tem de reconhecer isso. No 1.2 esta
       distinção não cabia numa palavra só. */
    const s = estado({ completionStatus: "completed", successStatus: "failed" });

    assert.equal(isCompleted2004(s), true);
    assert.equal(isPassed2004(s), false);
  });

  test("passar sem ter concluído também é possível", () => {
    /* Acontece com pacote que libera a prova antes do conteúdo todo. */
    const s = estado({ completionStatus: "incomplete", successStatus: "passed" });

    assert.equal(isCompleted2004(s), false);
    assert.equal(isPassed2004(s), true);
  });

  test("o que o conteúdo declara vale mais que a nota", () => {
    /* Ele conhece as regras dele — pode exigir acerto numa questão específica
       que a nota agregada não mostra. */
    const s = estado({ successStatus: "failed", scoreScaled: 0.95, scaledPassingScore: 0.7 });
    assert.equal(isPassed2004(s), false);
  });

  test("sem declaração, a nota normalizada decide", () => {
    assert.equal(
      isPassed2004(estado({ scoreScaled: 0.8, scaledPassingScore: 0.7 })),
      true,
    );
    assert.equal(
      isPassed2004(estado({ scoreScaled: 0.6, scaledPassingScore: 0.7 })),
      false,
    );
  });

  test("sem nota e sem declaração, não passou", () => {
    /* Não passou é diferente de reprovou, e quem não tem evidência de
       aprovação não pode receber certificado. */
    assert.equal(isPassed2004(estado()), false);
  });
});

describe("SCORM 2004 — o que o conteúdo lê e escreve", () => {
  test("a versão é declarada — pacote que não a vê pode se recusar a rodar", () => {
    assert.equal(scorm2004Value(estado(), "cmi._version"), "1.0");
  });

  test("elemento desconhecido devolve vazio, nunca undefined", () => {
    /* `undefined` viraria a palavra "undefined" na tela do conteúdo. */
    assert.equal(scorm2004Value(estado(), "cmi.inventado"), "");
  });

  test("a retomada liga pelo suspend_data", () => {
    assert.equal(scorm2004Value(estado(), "cmi.entry"), "ab-initio");
    assert.equal(scorm2004Value(estado({ suspendData: "x" }), "cmi.entry"), "resume");
  });

  test("o tempo sai em ISO 8601", () => {
    assert.equal(scorm2004Value(estado({ totalTimeSeconds: 5445 }), "cmi.total_time"), "PT1H30M45S");
  });

  test("status inválido é ignorado, não gravado", () => {
    /* Um `completion_status` livre quebraria `isCompleted2004`, que decide se
       a aula conta como feita. */
    const s = estado({ completionStatus: "completed" });
    assert.equal(setScorm2004Value(s, "cmi.completion_status", "quase").completionStatus, "completed");
  });

  test("a nota normalizada respeita a faixa de -1 a 1", () => {
    /* Fora da faixa é erro do pacote. Aceitar faria uma nota de 85 — que ele
       quis dizer em bruto — virar aprovação absurda contra um corte de 0,7. */
    const s = estado();
    assert.equal(setScorm2004Value(s, "cmi.score.scaled", "85").scoreScaled, undefined);
    assert.equal(setScorm2004Value(s, "cmi.score.scaled", "0.85").scoreScaled, 0.85);
    assert.equal(setScorm2004Value(s, "cmi.score.scaled", "-1").scoreScaled, -1);
  });

  test("o tempo de sessão SOMA ao acumulado", () => {
    /* O conteúdo reporta a sessão atual; o total entre sessões é conta nossa,
       e é o que sobrevive a fechar o navegador. */
    let s = estado({ totalTimeSeconds: 600 });
    s = setScorm2004Value(s, "cmi.session_time", "PT10M");

    assert.equal(s.totalTimeSeconds, 1200);
  });

  test("tempo de sessão inválido não zera o acumulado", () => {
    const s = estado({ totalTimeSeconds: 600 });
    assert.equal(setScorm2004Value(s, "cmi.session_time", "bagunça").totalTimeSeconds, 600);
  });

  test("elemento somente-leitura não é gravado", () => {
    const s = estado({ totalTimeSeconds: 100 });
    assert.equal(setScorm2004Value(s, "cmi.total_time", "PT99H").totalTimeSeconds, 100);
  });

  test("escrever não muda o estado que já existia", () => {
    /* O chamador decide quando persistir; mutar aqui faria o valor mudar
       debaixo de quem ainda não gravou. */
    const s = estado();
    setScorm2004Value(s, "cmi.completion_status", "completed");

    assert.equal(s.completionStatus, "not attempted");
  });
});

describe("SCORM 2004 — o resumo que a plataforma grava", () => {
  test("a nota normalizada vira percentual", () => {
    const r = to2004Summary(estado({ scoreScaled: 0.85 }));
    assert.equal(r.scorePercent, 85);
  });

  test("sem scaled, a nota bruta precisa da FAIXA", () => {
    /* Sem `max`, um "80" pode ser 80 de 100 ou 80 de 500. */
    assert.equal(to2004Summary(estado({ scoreRaw: 80 })).scorePercent, null);
    assert.equal(to2004Summary(estado({ scoreRaw: 80, scoreMax: 100 })).scorePercent, 80);
    assert.equal(
      to2004Summary(estado({ scoreRaw: 40, scoreMin: 0, scoreMax: 50 })).scorePercent,
      80,
    );
  });

  test("a nota fica entre 0 e 100", () => {
    /* `scaled` pode ser negativa pelo padrão, e uma nota de -30% não cabe na
       coluna nem faz sentido num boletim. */
    assert.equal(to2004Summary(estado({ scoreScaled: -0.3 })).scorePercent, 0);
  });

  test("sem nota nenhuma, é null e não zero", () => {
    /* Zero é uma nota; ausência de nota não é. */
    assert.equal(to2004Summary(estado()).scorePercent, null);
  });

  test("concluído e reprovado chegam juntos ao resumo", () => {
    const r = to2004Summary(estado({ completionStatus: "completed", successStatus: "failed" }));

    assert.equal(r.completed, true);
    assert.equal(r.passed, false);
  });
});
