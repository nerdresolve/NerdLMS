import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  channelsFor,
  extractMentions,
  NOTIFICATION_CATALOG,
  renderTemplate,
  type NotificationKind,
} from "./events.ts";

describe("Catálogo de eventos", () => {
  test("todo evento tem rótulo e descrição", () => {
    // A tela de preferências lista isto; um evento sem rótulo apareceria como
    // uma chave técnica para quem só quer desligar o e-mail de prazo.
    for (const evento of NOTIFICATION_CATALOG) {
      assert.ok(evento.label.length > 0, `${evento.kind} sem rótulo`);
      assert.ok(evento.description.length > 0, `${evento.kind} sem descrição`);
    }
  });

  test("cobre os eventos que o guia §15 lista", () => {
    const chaves = new Set(NOTIFICATION_CATALOG.map((e) => e.kind));

    for (const exigido of [
      "enrollment",
      "course_available",
      "lesson_available",
      "deadline_near",
      "assessment_open",
      "grade_posted",
      "course_completed",
      "certificate_issued",
    ] as NotificationKind[]) {
      assert.ok(chaves.has(exigido), `o guia pede ${exigido}`);
    }
  });

  test("nenhum evento repetido", () => {
    const chaves = NOTIFICATION_CATALOG.map((e) => e.kind);
    assert.equal(new Set(chaves).size, chaves.length);
  });
});

describe("Canais, com preferência da pessoa", () => {
  test("sem preferência declarada, vale o padrão do catálogo", () => {
    const c = channelsFor("grade_posted", new Map());
    assert.equal(c.inApp, true);
    assert.equal(c.email, true);
  });

  test("a pessoa desliga o e-mail e mantém o in-app", () => {
    // É a escolha mais comum de quem já vive dentro do sistema.
    const prefs = new Map([["grade_posted", { inApp: true, email: false }]]);
    const c = channelsFor("grade_posted", prefs);

    assert.equal(c.inApp, true);
    assert.equal(c.email, false);
  });

  test("desligar os dois silencia o evento", () => {
    const prefs = new Map([["deadline_near", { inApp: false, email: false }]]);
    const c = channelsFor("deadline_near", prefs);

    assert.equal(c.inApp, false);
    assert.equal(c.email, false);
  });

  test("preferência de outro evento não afeta este", () => {
    const prefs = new Map([["deadline_near", { inApp: false, email: false }]]);
    assert.equal(channelsFor("grade_posted", prefs).email, true);
  });

  test("evento não obrigatório pode nascer com e-mail desligado", () => {
    // `forum_reply` avisa muito; o padrão é in-app, e quem quiser e-mail liga.
    const c = channelsFor("forum_reply", new Map());
    assert.equal(c.inApp, true);
    assert.equal(c.email, false);
  });
});

describe("Renderização de template", () => {
  test("troca as variáveis", () => {
    const r = renderTemplate("Olá {{nome}}, sua nota em {{curso}} saiu.", {
      nome: "Ana",
      curso: "NR-10",
    });

    assert.equal(r, "Olá Ana, sua nota em NR-10 saiu.");
  });

  test("aceita espaço dentro das chaves", () => {
    assert.equal(renderTemplate("Olá {{ nome }}", { nome: "Ana" }), "Olá Ana");
  });

  test("variável sem valor vira vazio, não o literal", () => {
    // "Olá {{nome}}," num e-mail real seria pior que "Olá ,".
    assert.equal(renderTemplate("Olá {{nome}}!", {}), "Olá !");
  });

  test("a mesma variável várias vezes", () => {
    assert.equal(renderTemplate("{{n}} e {{n}}", { n: "x" }), "x e x");
  });

  test("texto sem variável passa intacto", () => {
    assert.equal(renderTemplate("Sem variáveis.", { nome: "Ana" }), "Sem variáveis.");
  });

  test("valor com chaves não é reinterpretado", () => {
    // Um nome que contenha `{{...}}` não pode virar outra substituição — seria
    // injeção de template pelo próprio dado.
    const r = renderTemplate("Olá {{nome}}", { nome: "{{admin}}", admin: "ADMIN" });
    assert.equal(r, "Olá {{admin}}");
  });
});

describe("Menções", () => {
  test("encontra @nome", () => {
    assert.deepEqual(extractMentions("Concordo com @ana.silva sobre isso."), ["ana.silva"]);
  });

  test("encontra várias, sem repetir", () => {
    assert.deepEqual(extractMentions("@ana @bruno e de novo @ana"), ["ana", "bruno"]);
  });

  test("ignora e-mail", () => {
    // "fale com joao@exemplo.com" não é menção ao usuário "exemplo".
    assert.deepEqual(extractMentions("fale com joao@exemplo.com"), []);
  });

  test("não confunde pontuação final com o nome", () => {
    assert.deepEqual(extractMentions("obrigado, @ana!"), ["ana"]);
    assert.deepEqual(extractMentions("@ana, veja"), ["ana"]);
  });

  test("texto sem menção devolve vazio", () => {
    assert.deepEqual(extractMentions("Nenhuma menção aqui."), []);
  });

  test("limita a quantidade", () => {
    // Uma mensagem com cem @ notificaria cem pessoas de uma vez — é o formato
    // clássico de spam por menção.
    const muitas = Array.from({ length: 50 }, (_, i) => `@u${i}`).join(" ");
    assert.ok(extractMentions(muitas).length <= 10);
  });
});
