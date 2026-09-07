/**
 * Leitura do `imsmanifest.xml` — F5-03.
 *
 * Todo pacote SCORM traz esse arquivo na raiz. Dele saem quatro coisas: qual
 * arquivo abre o conteúdo, a versão do padrão, a nota de corte declarada e o
 * título.
 *
 * A leitura é por EXPRESSÃO REGULAR, não por um analisador de XML.
 *
 * Não é preguiça: o manifesto é um documento pequeno, de estrutura conhecida, e
 * só quatro valores interessam. Um analisador completo traria uma dependência
 * inteira — com a superfície de ataque que um analisador de XML tem (entidades
 * externas, expansão recursiva) — para ler quatro atributos de um arquivo que
 * vem de terceiro. As regexes abaixo não expandem nada.
 */

export interface ScormManifest {
  entryPoint: string;
  version: "1.2" | "2004";
  title?: string;
  /** Nota de corte do 1.2, na escala bruta do pacote. */
  masteryScore?: number;
  /**
   * Nota de corte do 2004, normalizada de -1 a 1.
   *
   * Vem de outra tag (`imsss:minNormalizedMeasure`) e em outra escala. São dois
   * campos porque são dois valores diferentes: um pacote 2004 com corte 0,7 e
   * um 1.2 com corte 70 dizem a mesma coisa em vocabulários que não se
   * convertem sem saber a faixa da nota bruta.
   */
  scaledPassingScore?: number;
}

/**
 * O `href` é seguro para concatenar com o prefixo do pacote?
 *
 * O caminho vira `scorm/{pacote}/{href}` no storage. Um `../../` sairia do
 * prefixo, e um absoluto apontaria para outro lugar — os dois transformariam
 * o upload de um pacote em leitura de arquivo alheio.
 */
function hrefSeguro(href: string): boolean {
  if (href === "") return false;
  if (href.startsWith("/")) return false;
  if (href.includes("..")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false; // http:, file:, data:

  return true;
}

/** O conteúdo de uma tag, sem os filhos. */
function tagText(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i").exec(xml);
  return m?.[1]?.trim() || undefined;
}

export function parseManifest(xml: string): ScormManifest | null {
  if (!xml.includes("<manifest") && !xml.includes("<resources")) return null;

  /* O recurso que a organização aponta. Pegar o primeiro `href` do arquivo
     abriria um CSS ou um script — um pacote real tem dezenas de recursos. */
  const refItem = /<item[^>]*identifierref\s*=\s*["']([^"']+)["']/i.exec(xml);

  let href: string | undefined;

  if (refItem?.[1]) {
    const alvo = refItem[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const recurso = new RegExp(
      `<resource[^>]*identifier\\s*=\\s*["']${alvo}["'][^>]*>`,
      "i",
    ).exec(xml);

    href = recurso ? /href\s*=\s*["']([^"']+)["']/i.exec(recurso[0])?.[1] : undefined;
  }

  /* Sem organização — pacotes minimalistas —, o primeiro recurso marcado como
     SCO; e, se nem isso, o primeiro recurso com href. */
  if (!href) {
    const sco = /<resource[^>]*scormtype\s*=\s*["']sco["'][^>]*>/i.exec(xml);
    href = sco ? /href\s*=\s*["']([^"']+)["']/i.exec(sco[0])?.[1] : undefined;
  }

  if (!href) {
    href = /<resource[^>]*href\s*=\s*["']([^"']+)["']/i.exec(xml)?.[1];
  }

  if (!href || !hrefSeguro(href)) return null;

  /* A versão. O 2004 se identifica de várias formas conforme a edição; o 1.2 é
     o padrão quando nada é declarado, por ser o mais difundido — e assumir o
     outro faria o runtime oferecer uma API que o conteúdo não conhece. */
  const schema = tagText(xml, "schemaversion") ?? "";
  const version = /2004|1\.3|CAM/i.test(schema) ? "2004" : "1.2";

  const mastery = tagText(xml, "(?:adlcp:)?masteryscore");
  const masteryScore = mastery !== undefined ? Number(mastery) : Number.NaN;

  /* O 2004 declara o corte em `minNormalizedMeasure`, dentro das regras de
     sequenciamento. Fora da faixa -1 a 1 é erro do pacote, e aceitar faria um
     corte de "70" reprovar todo mundo contra notas que vão até 1. */
  const normalizado = tagText(xml, "(?:imsss:)?minNormalizedMeasure");
  const scaled = normalizado !== undefined ? Number(normalizado) : Number.NaN;
  const scaledValido = Number.isFinite(scaled) && scaled >= -1 && scaled <= 1;

  const titulo = tagText(xml, "title");

  return {
    entryPoint: href,
    version,
    ...(titulo ? { title: titulo } : {}),
    ...(Number.isFinite(masteryScore) ? { masteryScore } : {}),
    ...(scaledValido ? { scaledPassingScore: scaled } : {}),
  };
}
