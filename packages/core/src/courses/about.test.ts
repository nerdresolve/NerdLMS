import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { aboutSection, cargaFormatada, nomeDoIdioma, objetivosDe } from "./about.ts";
import { makeCourse } from "./test-fixtures.ts";

describe("Aba Sobre", () => {
  test("um objetivo por linha, sem o marcador que a pessoa digitou", () => {
    /* Quem preenche costuma abrir cada linha com hífen ou bolinha. Repassar
       isso à tela daria dois marcadores, o do texto e o da lista. */
    const linhas = objetivosDe("- Identificar riscos\n• Acionar a brigada\n  * Isolar a área  ");
    assert.deepEqual(linhas, ["Identificar riscos", "Acionar a brigada", "Isolar a área"]);
  });

  test("linha em branco não vira item vazio", () => {
    assert.deepEqual(objetivosDe("Primeiro\n\n\nSegundo\n"), ["Primeiro", "Segundo"]);
  });

  test("campo ausente devolve lista vazia, e não uma linha vazia", () => {
    assert.deepEqual(objetivosDe(undefined), []);
    assert.deepEqual(objetivosDe(""), []);
  });

  test("o idioma sai em nome, não em código", () => {
    /* "pt-BR" no meio de uma página em português não informa nada. */
    assert.equal(nomeDoIdioma("pt-BR"), "Português (Brasil)");
    assert.equal(nomeDoIdioma("en"), "Inglês");
  });

  test("idioma desconhecido é repassado como veio", () => {
    /* Melhor mostrar "fr-CA" do que esconder o campo. */
    assert.equal(nomeDoIdioma("fr-CA"), "fr-CA");
    assert.equal(nomeDoIdioma(undefined), null);
  });

  test("a carga é escrita como num certificado", () => {
    assert.equal(cargaFormatada(240), "4 horas");
    assert.equal(cargaFormatada(60), "1 hora");
    assert.equal(cargaFormatada(45), "45 minutos");
    assert.equal(cargaFormatada(90), "1h30");
  });

  test("carga ausente ou zero não vira texto", () => {
    assert.equal(cargaFormatada(null), null);
    assert.equal(cargaFormatada(0), null);
  });

  test("a seção aponta o que está em branco", () => {
    /* É o que permite a tela pedir ao instrutor em vez de só omitir. */
    const vazio = aboutSection(makeCourse({ id: "c1" }));
    assert.deepEqual(vazio.faltando, [
      "objetivos de aprendizagem",
      "público-alvo",
      "carga horária",
      "nível",
    ]);
  });

  test("preenchido não reclama de nada", () => {
    const cheio = aboutSection(
      makeCourse({
        id: "c2",
        objectives: "Identificar riscos\nAcionar a brigada",
        audience: "Operação de campo",
        workloadMinutes: 240,
        level: "basic",
        language: "pt-BR",
      }),
    );

    assert.deepEqual(cheio.faltando, []);
    assert.equal(cheio.objetivos.length, 2);
    assert.equal(cheio.publico, "Operação de campo");
    assert.equal(cheio.idioma, "Português (Brasil)");
  });

  test("público só de espaços conta como ausente", () => {
    const c = aboutSection(makeCourse({ id: "c3", audience: "   " }));
    assert.equal(c.publico, null);
    assert.ok(c.faltando.includes("público-alvo"));
  });
});
