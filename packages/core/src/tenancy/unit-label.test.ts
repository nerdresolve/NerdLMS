import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { lowerUnit, pluralOfUnit } from "./unit-label.ts";

describe("Rótulo da unidade, flexão", () => {
  test("plural regular ganha s", () => {
    assert.equal(pluralOfUnit("Unidade"), "unidades");
    assert.equal(pluralOfUnit("Gerência"), "gerências");
    assert.equal(pluralOfUnit("Diretoria"), "diretorias");
  });

  test("terminação em L vira IS", () => {
    // "filiais", não "filials" — é o termo mais provável depois de
    // "unidade" num cliente de varejo.
    assert.equal(pluralOfUnit("Filial"), "filiais");
    assert.equal(pluralOfUnit("Regional"), "regionais");
  });

  test("terminação em R, S ou Z ganha ES", () => {
    assert.equal(pluralOfUnit("Setor"), "setores");
  });

  test("rótulo vazio não produz frase quebrada", () => {
    // Um cliente pode salvar o campo em branco; a legenda precisa continuar
    // legível em vez de virar "de todas as ".
    assert.equal(pluralOfUnit("   "), "unidades");
    assert.equal(lowerUnit(""), "unidade");
  });

  test("minúscula para o meio da frase", () => {
    assert.equal(lowerUnit("Gerência"), "gerência");
  });
});
