import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { BRANDING_PADRAO, contrastRatio, paletteFrom, paletteToCss } from "./branding.ts";

describe("Paleta derivada da cor do cliente", () => {
  test("a cor de marca SEMPRE passa em contraste com o texto que fica em cima", () => {
    // É a razão de a paleta ser derivada em vez de cadastrada. Um cliente que
    // escolhe amarelo não pode terminar com botão de texto ilegível — e o
    // problema apareceria no produto dele, não no cadastro.
    const cores = [
      "#4C1D95", // azul da Exemplo S.A.
      "#FFE600", // amarelo — o pior caso com texto branco
      "#00FF00", // verde puro
      "#FF6B6B", // coral claro
      "#111111", // quase preto
      "#7C3AED", // roxo
    ];

    for (const cor of cores) {
      const p = paletteFrom(cor);
      const razao = contrastRatio(p.brand, p.onBrand);
      assert.ok(
        razao >= 4.5,
        `${cor} → ${p.brand} sobre ${p.onBrand} deu ${razao.toFixed(2)}:1`,
      );
    }
  });

  test("cor clara demais troca o TEXTO, não a cor do cliente", () => {
    // Mudar a cor da marca de alguém seria pior que adaptar o texto: a marca é
    // do cliente, a legibilidade é do produto.
    const p = paletteFrom("#FFE600");
    assert.equal(p.onBrand, "#0B1120");
  });

  test("cor escura mantém texto branco", () => {
    const p = paletteFrom("#0A33CC");
    assert.equal(p.onBrand, "#FFFFFF");
  });

  test("sem cor, usa o padrão do produto", () => {
    assert.equal(paletteFrom(null).brand, BRANDING_PADRAO.brandColor);
  });

  test("cor inválida cai no padrão em vez de quebrar a tela", () => {
    // O CHECK do banco já barra, mas dado antigo ou importação podem trazer
    // lixo — e uma paleta quebrada deixaria a página sem cor nenhuma.
    for (const ruim of ["azul", "#GGG", "#12345", "", "rgb(0,0,0)"]) {
      assert.equal(paletteFrom(ruim).brand, BRANDING_PADRAO.brandColor);
    }
  });

  test("hover e ativo são mais escuros que a base", () => {
    // Sem isso o estado de hover some: o botão não reage ao ponteiro.
    const p = paletteFrom("#2D5BFF");
    assert.ok(contrastRatio(p.brandHover, "#FFFFFF") > contrastRatio(p.brand, "#FFFFFF"));
    assert.ok(contrastRatio(p.brandActive, "#FFFFFF") > contrastRatio(p.brandHover, "#FFFFFF"));
  });

  test("a superfície sutil é clara o bastante para texto escuro", () => {
    // `--surface-brand-subtle` é fundo de selo e faixa, com texto por cima.
    const p = paletteFrom("#0A33CC");
    assert.ok(contrastRatio(p.brandSubtle, "#0B1120") >= 4.5);
  });
});

describe("Contraste, a medida", () => {
  test("preto sobre branco é 21:1", () => {
    assert.ok(Math.abs(contrastRatio("#000000", "#FFFFFF") - 21) < 0.01);
  });

  test("a mesma cor é 1:1", () => {
    assert.ok(Math.abs(contrastRatio("#123456", "#123456") - 1) < 0.01);
  });
});

describe("CSS injetado", () => {
  test("sem personalização, não injeta nada", () => {
    // Regra vazia é melhor que regra que repete o padrão: os tokens do Design
    // System continuam sendo a fonte, e não há sobrescrita para depurar.
    assert.equal(paletteToCss(null), "");
    assert.equal(paletteToCss("nao-e-cor"), "");
  });

  test("com personalização, declara os tokens de marca", () => {
    const css = paletteToCss("#7C3AED");
    assert.match(css, /--brand:#/);
    assert.match(css, /--text-on-brand:#/);
    assert.match(css, /--gradient-brand:linear-gradient/);
  });

  test("o CSS não carrega aspas nem chaves", () => {
    // Ele entra num atributo `style`; um caractere errado quebraria o HTML.
    const css = paletteToCss("#7C3AED");
    assert.ok(!css.includes('"'));
    assert.ok(!css.includes("{"));
    assert.ok(!css.includes("<"));
  });
});

describe("Marca como TEXTO, o caso que a superfície não cobre", () => {
  test("a marca vira texto legível sobre fundo claro, sempre", () => {
    // `--text-brand` é o rótulo colorido sobre card branco. A cor crua da
    // marca não serve: um amarelo dá 1.27:1 ali — invisível. É por isso que
    // esta variante existe separada de `brand`, onde a cor é FUNDO.
    for (const cor of ["#0A33CC", "#FFE600", "#00FF00", "#FF6B6B", "#7C3AED"]) {
      const p = paletteFrom(cor);
      const razao = contrastRatio(p.textBrand, "#FFFFFF");
      assert.ok(razao >= 4.5, `${cor} → texto ${p.textBrand} deu ${razao.toFixed(2)}:1`);
    }
  });

  test("cor que já é legível não é alterada", () => {
    // Escurecer o que já passa mudaria a marca sem motivo.
    const p = paletteFrom("#0A33CC");
    assert.equal(p.textBrand, "#0A33CC");
  });

  test("a superfície mantém a cor do cliente, mesmo quando o texto escurece", () => {
    // As duas coisas são independentes: o botão continua amarelo, o rótulo
    // fica legível.
    const p = paletteFrom("#FFE600");
    assert.equal(p.brand, "#FFE600");
    assert.notEqual(p.textBrand, "#FFE600");
  });
});
