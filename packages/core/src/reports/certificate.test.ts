import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildCertificate, certificateCode } from "./certificate.ts";
import { buildPdf } from "./pdf.ts";

const DADOS = {
  learnerName: "Maria Souza",
  courseTitle: "Tratamento de Água: Fundamentos",
  lessons: 18,
  durationSeconds: 31200,
  completedAt: "2026-08-14T12:00:00Z",
  code: "ABC123DEF456",
};

/** O PDF é binário; para inspecionar o texto, lê-se como latin1. */
const asText = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("Certificado em PDF", () => {
  test("é um PDF válido, com cabeçalho e fim", () => {
    const pdf = asText(buildCertificate(DADOS));
    assert.ok(pdf.startsWith("%PDF-1.4"), "falta o cabeçalho");
    assert.ok(pdf.trimEnd().endsWith("%%EOF"), "falta o marcador de fim");
  });

  test("tem a tabela xref que o leitor precisa", () => {
    // Sem xref o arquivo abre corrompido em leitores estritos.
    //
    // A contagem NÃO é fixa: acrescentar uma imagem ao desenho cria objetos
    // novos, e um número gravado aqui quebraria o teste a cada mudança de
    // layout sem que nada estivesse errado. O que importa é a tabela declarar
    // exatamente os objetos que existem — mais a entrada livre obrigatória.
    const pdf = asText(buildCertificate(DADOS));

    const declarados = /xref\n0 (\d+)\n/.exec(pdf);
    assert.ok(declarados, "falta a tabela xref");

    const objetos = (pdf.match(/^\d+ 0 obj$/gm) ?? []).length;
    assert.equal(Number(declarados[1]), objetos + 1, "a xref discorda dos objetos do arquivo");
    assert.match(pdf, /startxref\n\d+/);
  });

  test("traz o nome, o curso e a data", () => {
    const pdf = asText(buildCertificate(DADOS));
    assert.ok(pdf.includes("Maria Souza"));
    assert.ok(pdf.includes("de agosto de 2026"));
    assert.ok(pdf.includes("ABC123DEF456"));
  });

  test("diz o que NÃO é", () => {
    // A proposta é explícita: certificado interno, sem equivalência regulatória.
    const pdf = asText(buildCertificate(DADOS));
    assert.ok(/regulat/i.test(pdf), "falta a ressalva");
  });

  test("parênteses no título não quebram o arquivo", () => {
    // Parênteses delimitam string no formato PDF; sem escape, o arquivo inteiro
    // fica inválido.
    const pdf = asText(buildCertificate({ ...DADOS, courseTitle: "Água (potável) — etapa 1" }));
    assert.ok(pdf.includes("\\(pot"), "o parêntese precisa sair escapado");
    assert.ok(pdf.trimEnd().endsWith("%%EOF"));
  });

  test("acento sai em WinAnsi, não em UTF-8", () => {
    // Em UTF-8 "ã" ocupa dois bytes e o leitor mostra "Ã£".
    //
    // O título é desenhado com espaço entre as letras, então a checagem olha o
    // "Ã" isolado: procurar "CONCLUSÃO" junto passaria a falhar por causa do
    // layout, não da codificação, que é o que este teste cobre.
    const texto = asText(buildCertificate(DADOS));
    assert.ok(texto.includes("S \xC3 O"), "o Ã deveria ser byte único (0xC3)");

    /* A checagem do par UTF-8 olha só os literais de texto. O arquivo também
       carrega os bytes comprimidos da logo, e qualquer par de bytes pode
       aparecer ali por acaso — procurar no arquivo inteiro acusaria a imagem
       como se fosse erro de codificação. */
    const literais = texto.match(/\(([^)]*)\) Tj/g) ?? [];
    assert.ok(literais.length > 0, "o certificado precisa ter texto");
    assert.ok(
      !literais.some((linha) => linha.includes("\xC3\x83")),
      "acento não pode sair como par UTF-8",
    );
  });

  test("caractere fora da fonte vira ? em vez de quebrar", () => {
    const pdf = asText(buildCertificate({ ...DADOS, learnerName: "Maria 😀 Souza" }));
    assert.ok(pdf.includes("Maria ?"), "emoji não existe na fonte padrão");
    assert.ok(pdf.trimEnd().endsWith("%%EOF"));
  });

  test("o código é determinístico e legível", () => {
    // Reemitir não pode invalidar o que já foi impresso.
    const id = "dd1b44e8-52f8-5b65-a243-5ecb7b6ba687";
    assert.equal(certificateCode(id), certificateCode(id));
    assert.match(certificateCode(id), /^[0-9A-F]{12}$/);
  });

  test("o gerador aceita página vazia sem lançar", () => {
    const pdf = asText(buildPdf([]));
    assert.ok(pdf.startsWith("%PDF"));
  });
});
