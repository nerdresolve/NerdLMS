/**
 * Leitura de XML, o suficiente para SAML.
 *
 * A mesma decisão do manifesto SCORM e do QTI: sem analisador de terceiro. E
 * aqui a razão pesa mais — um analisador de XML completo traz as entidades
 * externas (XXE) e a expansão recursiva ("billion laughs") junto, e este
 * documento vem de um provedor de identidade pela rede.
 *
 * O QUE ESTE LEITOR FAZ, E O QUE ELE RECUSA
 *
 * Ele localiza elementos e atributos, e devolve o TRECHO BRUTO de cada um —
 * porque a validação de assinatura precisa dos bytes exatos, não de uma
 * árvore reconstruída. Recusa por nome o que um documento malicioso traria:
 * DOCTYPE (a porta do XXE), instruções de processamento e referências de
 * entidade que não sejam as cinco do padrão.
 */

export type XmlGuard = { ok: true } | { ok: false; error: string };

/**
 * O documento é seguro para ser lido?
 *
 * Rodada ANTES de qualquer outra coisa. Um `<!DOCTYPE` com entidade externa
 * faria um analisador comum buscar um arquivo do disco ou uma URL da rede
 * interna — e devolver o conteúdo dentro da asserção. Nós não expandimos nada,
 * mas recusar é mais barato que confiar na própria implementação.
 */
export function guardXml(xml: string): XmlGuard {
  if (/<!DOCTYPE/i.test(xml)) {
    return { ok: false, error: "O documento declara DOCTYPE, o que não é aceito." };
  }

  if (/<!ENTITY/i.test(xml)) {
    return { ok: false, error: "O documento declara entidades, o que não é aceito." };
  }

  /* As cinco entidades do XML são `lt`, `gt`, `amp`, `quot` e `apos`, mais as
     numéricas. Qualquer outra referência só existe se tiver sido DECLARADA —
     e declarações já foram recusadas acima. */
  const referencias = xml.match(/&(?!(?:lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);)[a-z_][\w.-]*;/gi);
  if (referencias) {
    return { ok: false, error: `O documento usa entidade não declarada: ${referencias[0]}` };
  }

  return { ok: true };
}

export interface XmlElement {
  /** O nome, sem prefixo de namespace. */
  name: string;
  /** O trecho INTEIRO, da abertura ao fechamento. Os bytes exatos. */
  outer: string;
  /** Só o conteúdo entre as tags. */
  inner: string;
  /** Onde o trecho começa no documento. */
  start: number;
}

/**
 * Escapa um nome para uso dentro de expressão regular.
 *
 * Necessário porque os nomes vêm do documento — um elemento chamado `a.b`
 * viraria um curinga sem isto.
 */
function escapar(nome: string): string {
  return nome.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
}

/**
 * Todos os elementos com este nome local.
 *
 * "Nome local" significa ignorar o prefixo: o mesmo elemento aparece como
 * `<saml:Assertion>`, `<saml2:Assertion>` ou `<Assertion>` conforme o
 * provedor, e exigir um prefixo faria o produto funcionar com uns e não com
 * outros — sem que a diferença fosse visível para quem configura.
 */
export function findElements(xml: string, nomeLocal: string): XmlElement[] {
  const nome = escapar(nomeLocal);

  /* `(?:[\w.-]+:)?` é o prefixo opcional. O `\b` depois do nome impede que
     `Assertion` case com `AssertionConsumerService`. */
  const abertura = new RegExp(String.raw`<(?:[\w.-]+:)?${nome}\b`, "g");
  const encontrados: XmlElement[] = [];

  for (const m of xml.matchAll(abertura)) {
    const inicio = m.index;
    const fimDaTag = xml.indexOf(">", inicio);
    if (fimDaTag < 0) continue;

    /* Elemento vazio: `<Nome ... />` não tem fechamento próprio. */
    if (xml[fimDaTag - 1] === "/") {
      encontrados.push({
        name: nomeLocal,
        outer: xml.slice(inicio, fimDaTag + 1),
        inner: "",
        start: inicio,
      });
      continue;
    }

    const fim = acharFechamento(xml, nome, fimDaTag + 1);
    if (fim < 0) continue;

    const fechamento = xml.indexOf(">", fim);
    if (fechamento < 0) continue;

    encontrados.push({
      name: nomeLocal,
      outer: xml.slice(inicio, fechamento + 1),
      inner: xml.slice(fimDaTag + 1, fim),
      start: inicio,
    });
  }

  return encontrados;
}

/**
 * O fechamento correspondente, contando os aninhados.
 *
 * Procurar o primeiro `</Nome>` erraria em documento com o mesmo elemento
 * dentro de si — e o SAML tem: uma `Assertion` pode conter outra numa resposta
 * de logout encadeado. Pegar o fechamento errado devolveria um trecho cortado,
 * e a assinatura seria conferida sobre bytes que não são os do elemento.
 */
function acharFechamento(xml: string, nome: string, desde: number): number {
  const abrir = new RegExp(String.raw`<(?:[\w.-]+:)?${nome}\b[^>]*>`, "g");
  const fechar = new RegExp(String.raw`</(?:[\w.-]+:)?${nome}\s*>`, "g");

  abrir.lastIndex = desde;
  fechar.lastIndex = desde;

  let profundidade = 0;

  for (;;) {
    const proximoFechar = fechar.exec(xml);
    if (!proximoFechar) return -1;

    /* Conta quantas aberturas existem antes deste fechamento. */
    abrir.lastIndex = desde;
    profundidade = 0;
    for (;;) {
      const a = abrir.exec(xml);
      if (!a || a.index > proximoFechar.index) break;
      /* Elemento vazio não abre nível. */
      if (!a[0].endsWith("/>")) profundidade += 1;
    }

    if (profundidade === 0) return proximoFechar.index;

    /* Há aberturas no meio: este fechamento pertence a uma delas. */
    desde = proximoFechar.index + proximoFechar[0].length;
    fechar.lastIndex = desde;
  }
}

/** O primeiro elemento com este nome, ou `null`. */
export function findElement(xml: string, nomeLocal: string): XmlElement | null {
  return findElements(xml, nomeLocal)[0] ?? null;
}

/** O valor de um atributo da tag de abertura. */
export function attr(elemento: XmlElement | string, nome: string): string | null {
  const tag = typeof elemento === "string" ? elemento : elemento.outer;
  const abertura = tag.slice(0, tag.indexOf(">") + 1);

  const m = new RegExp(
    String.raw`\b(?:[\w.-]+:)?${escapar(nome)}\s*=\s*["']([^"']*)["']`,
    "i",
  ).exec(abertura);

  return m?.[1] ?? null;
}

/** O texto de um elemento, com as cinco entidades do padrão resolvidas. */
export function text(elemento: XmlElement | null): string {
  if (!elemento) return "";

  return elemento.inner
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    /* `&amp;` por último: antes dos outros, `&amp;lt;` viraria `<`. */
    .replace(/&amp;/g, "&")
    .trim();
}
