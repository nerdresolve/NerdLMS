import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

import { acharManifesto, readZip, type ZipEntry } from "./zip.ts";

/**
 * Monta um ZIP de verdade, byte a byte.
 *
 * Sem arquivo de apoio no repositório: um `.zip` binário versionado não se
 * revisa em diff, e um teste que depende dele falha por motivo invisível
 * quando alguém o substitui.
 */
function montarZip(
  arquivos: Array<{ nome: string; conteudo: string | Buffer; comprimir?: boolean }>,
  ajustes: { tamanhoOriginalFalso?: number } = {},
): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, "utf8");
    const bruto = Buffer.isBuffer(arquivo.conteudo)
      ? arquivo.conteudo
      : Buffer.from(arquivo.conteudo, "utf8");

    const comprimir = arquivo.comprimir ?? true;
    const dados = comprimir ? deflateRawSync(bruto) : bruto;
    const metodo = comprimir ? 8 : 0;
    const original = ajustes.tamanhoOriginalFalso ?? bruto.length;

    const cabecalho = Buffer.alloc(30);
    cabecalho.writeUInt32LE(0x04034b50, 0);
    cabecalho.writeUInt16LE(20, 4);
    cabecalho.writeUInt16LE(metodo, 8);
    cabecalho.writeUInt32LE(0, 14);
    cabecalho.writeUInt32LE(dados.length, 18);
    cabecalho.writeUInt32LE(original, 22);
    cabecalho.writeUInt16LE(nome.length, 26);
    cabecalho.writeUInt16LE(0, 28);

    const entradaCentral = Buffer.alloc(46);
    entradaCentral.writeUInt32LE(0x02014b50, 0);
    entradaCentral.writeUInt16LE(20, 6);
    entradaCentral.writeUInt16LE(metodo, 10);
    entradaCentral.writeUInt32LE(dados.length, 20);
    entradaCentral.writeUInt32LE(original, 24);
    entradaCentral.writeUInt16LE(nome.length, 28);
    entradaCentral.writeUInt32LE(offset, 42);

    locais.push(cabecalho, nome, dados);
    central.push(entradaCentral, nome);
    offset += cabecalho.length + nome.length + dados.length;
  }

  const corpoCentral = Buffer.concat(central);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(corpoCentral.length, 12);
  fim.writeUInt32LE(offset, 16);

  return Buffer.concat([...locais, corpoCentral, fim]);
}

function textoDe(entries: ZipEntry[], caminho: string): string {
  return entries.find((e) => e.path === caminho)?.data.toString("utf8") ?? "";
}

describe("ZIP — leitura de um pacote normal", () => {
  test("lê arquivos comprimidos e não comprimidos", () => {
    const zip = montarZip([
      { nome: "imsmanifest.xml", conteudo: "<manifest/>" },
      { nome: "index.html", conteudo: "<html>oi</html>", comprimir: false },
    ]);

    const r = readZip(zip);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.entries.length, 2);
    assert.equal(r.ok ? textoDe(r.entries, "imsmanifest.xml") : "", "<manifest/>");
    assert.equal(r.ok ? textoDe(r.entries, "index.html") : "", "<html>oi</html>");
  });

  test("preserva caminho com pastas", () => {
    const zip = montarZip([{ nome: "assets\\js\\player.js", conteudo: "var x=1" }]);
    const r = readZip(zip);

    assert.equal(r.ok && r.entries[0]!.path, "assets/js/player.js");
  });

  test("conteúdo binário atravessa intacto", () => {
    /* Um pacote traz imagem e fonte. Tratar tudo como texto corromperia. */
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe]);
    const zip = montarZip([{ nome: "logo.png", conteudo: bytes }]);
    const r = readZip(zip);

    assert.deepEqual(r.ok && r.entries[0]!.data, bytes);
  });

  test("pasta não vira entrada", () => {
    const zip = montarZip([
      { nome: "assets/", conteudo: "" },
      { nome: "assets/a.js", conteudo: "x" },
    ]);

    const r = readZip(zip);
    assert.equal(r.ok && r.entries.length, 1);
  });

  test("arquivo que não é ZIP é recusado", () => {
    const r = readZip(Buffer.from("isto é um PDF, não um ZIP"));
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /não é um ZIP/i);
  });

  test("ZIP vazio é recusado", () => {
    const r = readZip(montarZip([]));
    assert.equal(r.ok, false);
  });
});

describe("ZIP — as defesas", () => {
  test("zip slip: caminho com .. é RECUSADO", () => {
    /* O ataque clássico: `../../etc/senha` escreveria fora do prefixo do
       pacote. É por isso que o caminho é conferido antes de virar chave. */
    const zip = montarZip([{ nome: "../../fora.txt", conteudo: "x" }]);
    const r = readZip(zip);

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /inseguro/i);
  });

  test("caminho absoluto é recusado", () => {
    assert.equal(readZip(montarZip([{ nome: "/etc/passwd", conteudo: "x" }])).ok, false);
  });

  test("caminho do Windows é recusado", () => {
    assert.equal(readZip(montarZip([{ nome: "C:/temp/x.txt", conteudo: "x" }])).ok, false);
  });

  test("o caminho inseguro aparece na mensagem", () => {
    /* Quem empacotou precisa saber QUAL arquivo consertar. */
    const r = readZip(montarZip([{ nome: "a/../../b.txt", conteudo: "x" }]));
    assert.match(r.ok === false ? r.error : "", /a\/\.\.\/\.\.\/b\.txt/);
  });

  test("zip bomb: tamanho declarado acima do teto é recusado ANTES de descomprimir", () => {
    /* Um ZIP de 42 KB pode declarar petabytes. Conferir depois de expandir
       seria expandir para descobrir que não cabia. */
    const zip = montarZip([{ nome: "bomba.txt", conteudo: "a" }], {
      tamanhoOriginalFalso: 500 * 1024 * 1024,
    });

    const r = readZip(zip);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /limite|grande demais/i);
  });

  test("entrada que expande além do declarado é recusada", () => {
    /* A outra metade da defesa: declarar pouco e expandir muito. */
    const zip = montarZip([{ nome: "a.txt", conteudo: "x".repeat(10_000) }], {
      tamanhoOriginalFalso: 10,
    });

    const r = readZip(zip);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /descomprimir/i);
  });

  test("acumulado de várias entradas também tem teto", () => {
    const muitas = Array.from({ length: 5 }, (_, i) => ({
      nome: `a${i}.txt`,
      conteudo: "x",
    }));

    const r = readZip(montarZip(muitas), {
      maxTotalBytes: 3,
      maxEntryBytes: 100,
      maxEntries: 100,
    });

    assert.equal(r.ok, false);
  });

  test("número de entradas tem teto", () => {
    const r = readZip(montarZip([{ nome: "a.txt", conteudo: "x" }]), {
      maxTotalBytes: 1000,
      maxEntryBytes: 1000,
      maxEntries: 0,
    });

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /mais de 0 arquivos/i);
  });
});

describe("ZIP — achar o manifesto", () => {
  test("na raiz, como o padrão manda", () => {
    const r = readZip(
      montarZip([
        { nome: "imsmanifest.xml", conteudo: "<manifest/>" },
        { nome: "index.html", conteudo: "x" },
      ]),
    );

    const achado = acharManifesto(r.ok ? r.entries : [])!;
    assert.equal(achado.entry.path, "imsmanifest.xml");
    assert.equal(achado.prefix, "");
  });

  test("dentro de uma pasta, como as ferramentas de autoria empacotam", () => {
    /* Articulate e iSpring empacotam uma pasta a mais por fora. Recusar seria
       recusar pacote válido do que a maioria dos clientes usa. */
    const r = readZip(
      montarZip([
        { nome: "meu-curso/imsmanifest.xml", conteudo: "<manifest/>" },
        { nome: "meu-curso/index.html", conteudo: "x" },
      ]),
    );

    const achado = acharManifesto(r.ok ? r.entries : [])!;
    assert.equal(achado.entry.path, "meu-curso/imsmanifest.xml");
    assert.equal(achado.prefix, "meu-curso/");
  });

  test("com vários, o mais raso vence", () => {
    /* Um pacote pode trazer manifestos de sub-módulos; o da raiz descreve o
       conjunto. */
    const r = readZip(
      montarZip([
        { nome: "mod1/imsmanifest.xml", conteudo: "<sub/>" },
        { nome: "imsmanifest.xml", conteudo: "<raiz/>" },
      ]),
    );

    assert.equal(acharManifesto(r.ok ? r.entries : [])!.entry.path, "imsmanifest.xml");
  });

  test("sem manifesto, devolve null", () => {
    const r = readZip(montarZip([{ nome: "index.html", conteudo: "x" }]));
    assert.equal(acharManifesto(r.ok ? r.entries : []), null);
  });

  test("o nome é reconhecido em qualquer caixa", () => {
    const r = readZip(montarZip([{ nome: "IMSManifest.xml", conteudo: "<m/>" }]));
    assert.ok(acharManifesto(r.ok ? r.entries : []));
  });
});

describe("ZIP — a barra do Windows", () => {
  test("barra invertida no caminho vira barra normal", () => {
    /* O `Compress-Archive` do Windows grava `assets\app.js`, e foi assim que
       um pacote real chegou no primeiro teste. Sem normalizar, a chave no
       storage sairia com a barra invertida e o navegador procuraria
       `assets/app.js` — a página abriria sem nenhum script. */
    const zip = montarZip([{ nome: "assets\\js\\player.js", conteudo: "var x=1" }]);
    const r = readZip(zip);

    assert.equal(r.ok && r.entries[0]!.path, "assets/js/player.js");
  });

  test("a defesa contra .. vale também com barra invertida", () => {
    /* Normalizar ANTES de conferir é o que impede `..\..\fora.txt` de
       escapar por usar a outra barra. */
    const zip = montarZip([{ nome: "..\\..\\fora.txt", conteudo: "x" }]);
    assert.equal(readZip(zip).ok, false);
  });

  test("o manifesto é achado mesmo com barra invertida no caminho", () => {
    const r = readZip(montarZip([{ nome: "curso\\imsmanifest.xml", conteudo: "<m/>" }]));
    const achado = acharManifesto(r.ok ? r.entries : [])!;

    assert.equal(achado.prefix, "curso/");
  });
});
