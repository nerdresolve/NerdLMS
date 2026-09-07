import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseManifest } from "./manifest.ts";

/**
 * Leitura do `imsmanifest.xml` — F5-03.
 *
 * Todo pacote SCORM traz esse arquivo na raiz. Dele saem três coisas que a
 * plataforma precisa: qual arquivo abre o conteúdo, qual versão do padrão, e a
 * nota de corte quando o pacote a declara.
 */

describe("Ponto de entrada", () => {
  test("lê o href do recurso referenciado pela organização", () => {
    const xml = `<?xml version="1.0"?>
      <manifest identifier="M1" version="1.2">
        <organizations default="ORG">
          <organization identifier="ORG">
            <title>Curso</title>
            <item identifier="I1" identifierref="R1"><title>Aula</title></item>
          </organization>
        </organizations>
        <resources>
          <resource identifier="R1" type="webcontent" href="index_lms.html" />
        </resources>
      </manifest>`;

    assert.equal(parseManifest(xml)?.entryPoint, "index_lms.html");
  });

  test("com vários recursos, segue o `identifierref` do item", () => {
    // Um pacote real tem dezenas de recursos (imagens, scripts). Pegar o
    // primeiro `href` abriria um arquivo que não é o conteúdo.
    const xml = `<manifest>
        <organizations default="ORG">
          <organization identifier="ORG">
            <item identifier="I1" identifierref="CONTEUDO"/>
          </organization>
        </organizations>
        <resources>
          <resource identifier="ESTILO" href="css/main.css"/>
          <resource identifier="CONTEUDO" href="story.html"/>
          <resource identifier="SCRIPT" href="js/app.js"/>
        </resources>
      </manifest>`;

    assert.equal(parseManifest(xml)?.entryPoint, "story.html");
  });

  test("sem organização, cai no primeiro recurso SCO", () => {
    // Alguns pacotes minimalistas omitem a organização.
    const xml = `<manifest>
        <resources>
          <resource identifier="R" adlcp:scormtype="sco" href="launch.htm"/>
        </resources>
      </manifest>`;

    assert.equal(parseManifest(xml)?.entryPoint, "launch.htm");
  });

  test("XML sem recurso nenhum devolve null", () => {
    // Pacote quebrado: melhor recusar no envio que criar uma aula que abre
    // uma página em branco.
    assert.equal(parseManifest("<manifest></manifest>"), null);
  });

  test("texto que não é XML devolve null", () => {
    assert.equal(parseManifest("isto não é xml"), null);
    assert.equal(parseManifest(""), null);
  });
});

describe("Versão do padrão", () => {
  test("reconhece 1.2 pelo schemaversion", () => {
    const xml = `<manifest>
        <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
        <resources><resource href="a.html"/></resources>
      </manifest>`;

    assert.equal(parseManifest(xml)?.version, "1.2");
  });

  test("reconhece 2004 pelas variações do schemaversion", () => {
    // O 2004 se identifica de várias formas conforme a edição.
    for (const versao of ["2004 3rd Edition", "CAM 1.3", "2004 4th Edition"]) {
      const xml = `<manifest>
          <metadata><schemaversion>${versao}</schemaversion></metadata>
          <resources><resource href="a.html"/></resources>
        </manifest>`;

      assert.equal(parseManifest(xml)?.version, "2004", `falhou em "${versao}"`);
    }
  });

  test("sem versão declarada, assume 1.2", () => {
    // É o mais difundido, e assumir o outro faria o runtime oferecer uma API
    // que o conteúdo não conhece.
    const xml = `<manifest><resources><resource href="a.html"/></resources></manifest>`;
    assert.equal(parseManifest(xml)?.version, "1.2");
  });
});

describe("Nota de corte", () => {
  test("lê o masteryscore quando declarado", () => {
    const xml = `<manifest>
        <organizations default="O">
          <organization identifier="O">
            <item identifierref="R">
              <adlcp:masteryscore>70</adlcp:masteryscore>
            </item>
          </organization>
        </organizations>
        <resources><resource identifier="R" href="a.html"/></resources>
      </manifest>`;

    assert.equal(parseManifest(xml)?.masteryScore, 70);
  });

  test("sem masteryscore, fica indefinido", () => {
    // `undefined` e não zero: zero seria uma nota de corte que tudo atinge.
    const xml = `<manifest><resources><resource href="a.html"/></resources></manifest>`;
    assert.equal(parseManifest(xml)?.masteryScore, undefined);
  });

  test("masteryscore inválido é ignorado", () => {
    const xml = `<manifest>
        <organizations default="O">
          <organization identifier="O"><item identifierref="R">
            <adlcp:masteryscore>muito</adlcp:masteryscore>
          </item></organization>
        </organizations>
        <resources><resource identifier="R" href="a.html"/></resources>
      </manifest>`;

    assert.equal(parseManifest(xml)?.masteryScore, undefined);
  });
});

describe("Título", () => {
  test("lê o título da organização", () => {
    const xml = `<manifest>
        <organizations default="O">
          <organization identifier="O"><title>Segurança em Altura</title>
            <item identifierref="R"/></organization>
        </organizations>
        <resources><resource identifier="R" href="a.html"/></resources>
      </manifest>`;

    assert.equal(parseManifest(xml)?.title, "Segurança em Altura");
  });
});

describe("O que a leitura não permite", () => {
  test("href com `..` é recusado", () => {
    // Um `href="../../etc/passwd"` escaparia do prefixo do pacote no storage.
    // O caminho é concatenado com o prefixo, e é por aí que se sai dele.
    const xml = `<manifest>
        <resources><resource href="../../fora.html"/></resources>
      </manifest>`;

    assert.equal(parseManifest(xml), null);
  });

  test("href absoluto é recusado", () => {
    const xml = `<manifest>
        <resources><resource href="https://outro.site/x.html"/></resources>
      </manifest>`;

    assert.equal(parseManifest(xml), null);
  });

  test("href começando com barra é recusado", () => {
    const xml = `<manifest><resources><resource href="/raiz.html"/></resources></manifest>`;
    assert.equal(parseManifest(xml), null);
  });
});

describe("Manifesto — nota de corte do 2004", () => {
  test("lê o minNormalizedMeasure", () => {
    const xml = `<manifest>
      <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
      <organizations><organization><item identifierref="R1"/></organization></organizations>
      <imsss:sequencing>
        <imsss:objectives>
          <imsss:primaryObjective>
            <imsss:minNormalizedMeasure>0.7</imsss:minNormalizedMeasure>
          </imsss:primaryObjective>
        </imsss:objectives>
      </imsss:sequencing>
      <resources><resource identifier="R1" href="index.html"/></resources>
    </manifest>`;

    const m = parseManifest(xml)!;
    assert.equal(m.version, "2004");
    assert.equal(m.scaledPassingScore, 0.7);
  });

  test("corte fora da faixa do padrão é ignorado", () => {
    /* Um pacote que declare "70" ali está confundindo a escala. Aceitar
       reprovaria todo mundo, porque a nota normalizada vai até 1. */
    const xml = `<manifest>
      <metadata><schemaversion>2004 3rd Edition</schemaversion></metadata>
      <imsss:minNormalizedMeasure>70</imsss:minNormalizedMeasure>
      <resources><resource href="index.html"/></resources>
    </manifest>`;

    assert.equal(parseManifest(xml)!.scaledPassingScore, undefined);
  });

  test("pacote 1.2 não ganha corte normalizado", () => {
    const xml = `<manifest>
      <metadata><schemaversion>1.2</schemaversion></metadata>
      <adlcp:masteryscore>70</adlcp:masteryscore>
      <resources><resource href="index.html"/></resources>
    </manifest>`;

    const m = parseManifest(xml)!;
    assert.equal(m.version, "1.2");
    assert.equal(m.masteryScore, 70);
    assert.equal(m.scaledPassingScore, undefined);
  });
});
