import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

import { pngParaPdf } from "./png.ts";

/* Um PNG gravado pelo CHROMIUM, não montado aqui.

   O ponto é ter um codificador independente do nosso leitor: o Chromium
   escolhe os filtros por linha como bem entender, e é isso que o leitor tem de
   aguentar. Um PNG montado pelo próprio teste provaria apenas que o teste e o
   código cometem o mesmo engano. Gerado por `scratchpad/gera-png.py`. */
const RGBA = readFileSync(
  fileURLToPath(new URL("./fixtures/assinatura-rgba.png", import.meta.url)),
);

/** Os pixels que o gerador desenhou, na ordem em que os desenhou. */
const PIXELS: [number, number, number, number][] = [
  [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255],
  [0, 0, 0, 255], [128, 128, 128, 255], [255, 0, 0, 0], [0, 0, 255, 128],
  [10, 20, 30, 255], [200, 100, 50, 255], [255, 255, 0, 255], [0, 0, 0, 0],
];

/** O que cada pixel vira depois de achatado sobre branco. */
function sobreBranco([r, g, b, a]: [number, number, number, number]): [number, number, number] {
  const t = a / 255;
  return [
    Math.round(r * t + 255 * (1 - t)),
    Math.round(g * t + 255 * (1 - t)),
    Math.round(b * t + 255 * (1 - t)),
  ];
}

function pixels(base64: string): Buffer {
  return inflateSync(Buffer.from(base64, "base64"));
}

/** Monta um PNG à mão, para exercitar casos que o Chromium não produz. */
function pngDeTeste(opcoes: {
  width: number;
  height: number;
  tipo: number;
  bits?: number;
  entrelacado?: boolean;
  /** Linhas JÁ com o byte de filtro na frente. */
  linhas: number[][];
}): Buffer {
  const pedaco = (nome: string, conteudo: Buffer): Buffer => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(conteudo.length);
    /* O CRC não é conferido pelo leitor — zeros bastam, e o comentário no
       módulo explica por quê. */
    return Buffer.concat([tamanho, Buffer.from(nome, "latin1"), conteudo, Buffer.alloc(4)]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(opcoes.width, 0);
  ihdr.writeUInt32BE(opcoes.height, 4);
  ihdr[8] = opcoes.bits ?? 8;
  ihdr[9] = opcoes.tipo;
  ihdr[12] = opcoes.entrelacado ? 1 : 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco("IHDR", ihdr),
    pedaco("IDAT", deflateSync(Buffer.from(opcoes.linhas.flat()))),
    pedaco("IEND", Buffer.alloc(0)),
  ]);
}

describe("PNG, leitura para o PDF", () => {
  test("um PNG gravado pelo Chromium é lido pixel a pixel", () => {
    const r = pngParaPdf(RGBA);
    assert.ok(r.ok, r.ok ? "" : r.erro);

    assert.equal(r.imagem.width, 4);
    assert.equal(r.imagem.height, 3);

    const rgb = pixels(r.imagem.data);
    assert.equal(rgb.length, 4 * 3 * 3, "três bytes por pixel, sem alfa");

    PIXELS.forEach((pixel, i) => {
      const [er, eg, eb] = sobreBranco(pixel);
      assert.deepEqual(
        [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]],
        [er, eg, eb],
        `pixel ${i}`,
      );
    });
  });

  test("o transparente vira BRANCO, não preto", () => {
    /* Ignorar o alfa e copiar só a cor faria o fundo de uma assinatura
       digitalizada virar um retângulo preto sobre o certificado. */
    const rgb = pixels((pngParaPdf(RGBA) as { imagem: { data: string } }).imagem.data);

    /* Pixel 6 é vermelho com alfa 0; pixel 11 é preto com alfa 0. */
    assert.deepEqual([rgb[18], rgb[19], rgb[20]], [255, 255, 255]);
    assert.deepEqual([rgb[33], rgb[34], rgb[35]], [255, 255, 255]);
  });

  test("meia transparência mistura com o branco", () => {
    const rgb = pixels((pngParaPdf(RGBA) as { imagem: { data: string } }).imagem.data);
    /* Pixel 7: azul puro com alfa 128 → 127,127,255. */
    assert.deepEqual([rgb[21], rgb[22], rgb[23]], sobreBranco([0, 0, 255, 128]));
  });

  test("os cinco filtros por linha são desfeitos", () => {
    /* O PNG escolhe o filtro POR LINHA. Implementar só o modo 0 funciona em
       imagem pequena e falha em qualquer coisa salva por programa de verdade —
       o Paeth (4) é o que os codificadores mais usam. Aqui as cinco linhas
       codificam o MESMO pixel de três formas diferentes. */
    const png = pngDeTeste({
      width: 1,
      height: 5,
      tipo: 2,
      linhas: [
        [0, 10, 20, 30],
        [1, 10, 20, 30],
        [2, 0, 0, 0],
        [3, 5, 10, 15],
        [4, 0, 0, 0],
      ],
    });

    const r = pngParaPdf(png);
    assert.ok(r.ok, r.ok ? "" : r.erro);

    const rgb = pixels(r.imagem.data);
    /* Sem filtro; depois "soma a esquerda" (que é zero na 1ª coluna); depois
       "soma a de cima"; depois a média; depois Paeth. */
    assert.deepEqual([rgb[0], rgb[1], rgb[2]], [10, 20, 30]);
    assert.deepEqual([rgb[3], rgb[4], rgb[5]], [10, 20, 30]);
    assert.deepEqual([rgb[6], rgb[7], rgb[8]], [10, 20, 30]);
    assert.deepEqual([rgb[9], rgb[10], rgb[11]], [10, 20, 30]);
    assert.deepEqual([rgb[12], rgb[13], rgb[14]], [10, 20, 30]);
  });

  test("tons de cinza viram RGB", () => {
    const png = pngDeTeste({ width: 2, height: 1, tipo: 0, linhas: [[0, 40, 200]] });
    const r = pngParaPdf(png);
    assert.ok(r.ok);
    const rgb = pixels(r.imagem.data);
    assert.deepEqual([...rgb], [40, 40, 40, 200, 200, 200]);
  });

  test("vários pedaços IDAT são juntados", () => {
    /* Programas quebram os dados por tamanho de buffer. Ler só o primeiro
       devolve uma imagem cortada, e o `inflate` não reclama: a metade de baixo
       sai preta e ninguém descobre até o certificado ficar pronto. */
    const original = pngDeTeste({
      width: 1, height: 2, tipo: 2,
      linhas: [[0, 1, 2, 3], [0, 4, 5, 6]],
    });

    /* Reescreve o mesmo conteúdo em dois IDAT. */
    const dados = deflateSync(Buffer.from([0, 1, 2, 3, 0, 4, 5, 6]));
    const corte = Math.floor(dados.length / 2);
    const idat = (parte: Buffer): Buffer => {
      const t = Buffer.alloc(4);
      t.writeUInt32BE(parte.length);
      return Buffer.concat([t, Buffer.from("IDAT", "latin1"), parte, Buffer.alloc(4)]);
    };

    const partido = Buffer.concat([
      original.subarray(0, 33),
      idat(dados.subarray(0, corte)),
      idat(dados.subarray(corte)),
      original.subarray(original.length - 12),
    ]);

    const r = pngParaPdf(partido);
    assert.ok(r.ok, r.ok ? "" : r.erro);
    assert.deepEqual([...pixels(r.imagem.data)], [1, 2, 3, 4, 5, 6]);
  });
});

describe("PNG, o que é recusado, e com qual mensagem", () => {
  test("arquivo que não é PNG", () => {
    const r = pngParaPdf(Buffer.from("isto é um JPEG, prometo"));
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.erro.includes("não é um PNG"));
  });

  test("entrelaçado é recusado em vez de sair torto", () => {
    /* Adam7 guarda a imagem em sete passagens. Lê-lo como se fosse linear
       produz um borrão — e o defeito só aparece com o certificado na mão. */
    const png = pngDeTeste({
      width: 1, height: 1, tipo: 2, entrelacado: true, linhas: [[0, 0, 0, 0]],
    });
    const r = pngParaPdf(png);
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /entrela/i.test(r.erro));
  });

  test("paleta e 16 bits têm mensagem própria", () => {
    const paleta = pngDeTeste({ width: 1, height: 1, tipo: 3, linhas: [[0, 0]] });
    assert.ok(!pngParaPdf(paleta).ok);

    const dezesseis = pngDeTeste({ width: 1, height: 1, tipo: 2, bits: 16, linhas: [[0, 0]] });
    const r = pngParaPdf(dezesseis);
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /8 bits/.test(r.erro));
  });

  test("dimensão absurda é recusada ANTES de alocar", () => {
    /* Bomba de descompressão: poucos bytes declarando 30000×30000 fariam este
       processo pedir gigabytes e derrubar o servidor inteiro — não só o
       certificado de quem clicou. */
    const bomba = pngDeTeste({
      width: 30000, height: 30000, tipo: 2, linhas: [[0, 0, 0, 0]],
    });
    const r = pngParaPdf(bomba);
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /grande demais/.test(r.erro));
  });

  test("PNG cortado no meio não vira imagem pela metade", () => {
    const r = pngParaPdf(RGBA.subarray(0, RGBA.length - 30));
    assert.equal(r.ok, false);
  });
});
