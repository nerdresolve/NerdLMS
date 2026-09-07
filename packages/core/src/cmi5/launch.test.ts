import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { actorParaCmi5, buildLaunchUrl } from "./launch.ts";

describe("cmi5, a URL de launch", () => {
  test("leva os cinco parâmetros do padrão", () => {
    const url = new URL(
      buildLaunchUrl("https://conteudo.exemplo/au1", {
        endpoint: "https://treinamento.acme.com.br/api/xapi/",
        fetchUrl: "https://treinamento.acme.com.br/api/cmi5/fetch?t=abc",
        actorJson: '{"name":"Ana"}',
        activityId: "https://treinamento.acme.com.br/cmi5/au/1",
        registration: "reg-1",
      }),
    );

    assert.equal(url.searchParams.get("endpoint"), "https://treinamento.acme.com.br/api/xapi/");
    assert.equal(url.searchParams.get("registration"), "reg-1");
    assert.ok(url.searchParams.get("fetch"));
    assert.ok(url.searchParams.get("actor"));
    assert.ok(url.searchParams.get("activityId"));
  });

  test("o TOKEN não vai na URL, vai o endereço para buscá-lo", () => {
    /* A URL do iframe aparece no histórico do navegador e no `Referer` de tudo
       que o conteúdo carregar. Um token ali seria uma credencial em texto em
       dois lugares que não controlamos. */
    const url = buildLaunchUrl("https://conteudo.exemplo/au1", {
      endpoint: "https://x/api/xapi/",
      fetchUrl: "https://x/api/cmi5/fetch?t=segredo",
      actorJson: "{}",
      activityId: "https://x/au/1",
      registration: "r",
    });

    /* O `fetch` carrega um identificador de uso único, não a credencial de
       sessão: são coisas diferentes, e é essa a diferença que o padrão define. */
    assert.ok(url.includes("fetch="));
    assert.ok(!url.includes("auth="));
  });

  test("preserva parâmetros que o conteúdo já trazia", () => {
    /* Um AU pode ser publicado com parâmetros próprios; concatenar apagaria. */
    const url = new URL(
      buildLaunchUrl("https://conteudo.exemplo/au1?lang=pt", {
        endpoint: "https://x/api/xapi/",
        fetchUrl: "https://x/f",
        actorJson: "{}",
        activityId: "https://x/au/1",
        registration: "r",
      }),
    );

    assert.equal(url.searchParams.get("lang"), "pt");
    assert.equal(url.searchParams.get("registration"), "r");
  });
});

describe("cmi5, o ator", () => {
  test("identifica por CONTA, não por e-mail", () => {
    /* O conteúdo é de terceiro. Mandar o e-mail entregaria dado pessoal a quem
       só precisa saber que é a mesma pessoa entre uma sessão e outra. */
    const ator = JSON.parse(
      actorParaCmi5({
        userId: "u-123",
        fullName: "Ana Souza",
        homePage: "https://treinamento.acme.com.br",
      }),
    );

    assert.equal(ator.objectType, "Agent");
    assert.equal(ator.name, "Ana Souza");
    assert.equal(ator.account.name, "u-123");
    assert.equal(ator.mbox, undefined);
  });

  test("o JSON não leva e-mail em campo nenhum", () => {
    const texto = actorParaCmi5({
      userId: "u-1",
      fullName: "Ana Souza",
      homePage: "https://x",
    });

    assert.ok(!texto.includes("@"));
    assert.ok(!texto.toLowerCase().includes("mbox"));
  });
});
