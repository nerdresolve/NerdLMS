/**
 * Canonicalização XML exclusiva (C14N 1.0 exclusiva, sem comentários).
 *
 * É a parte que assusta na fama e é determinística na prática: antes de
 * calcular o hash, o XML precisa estar numa forma única — porque
 * `<a b="1" c="2"/>` e `<a c="2" b="1" />` são o mesmo documento e teriam
 * hashes diferentes.
 *
 * AS REGRAS QUE IMPORTAM, e todas são mecânicas:
 *
 *   Atributos em ordem: declarações de namespace primeiro (por prefixo), e
 *   depois os atributos comuns (por URI de namespace e nome local).
 *   Elemento vazio vira par de tags: `<a/>` → `<a></a>`.
 *   Aspas sempre duplas.
 *   `&`, `<` e `>` escapados no texto; nos atributos, também as aspas e as
 *   quebras de linha.
 *   EXCLUSIVA significa: só os namespaces USADOS pelo elemento vão junto —
 *   os herdados do documento ficam de fora. É o que permite arrancar uma
 *   asserção de dentro da resposta e ainda validar a assinatura dela.
 *
 * O QUE ESTA IMPLEMENTAÇÃO NÃO FAZ
 *
 * `InclusiveNamespaces PrefixList`, que reintroduz prefixos específicos. É raro
 * e, quando aparece, a asserção é recusada por nome em vez de validada errado.
 */

interface Attr {
  name: string;
  value: string;
  /** O prefixo declarado, quando o atributo é `xmlns` ou `xmlns:x`. */
  nsPrefix: string | null;
}

/** Escapa texto de nó. */
function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Escapa valor de atributo.
 *
 * A quebra de linha vira `&#xA;` de propósito: sem isso, um atributo com
 * quebra teria hashes diferentes conforme o sistema que gravou o arquivo —
 * e a assinatura falharia por causa do fim de linha.
 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\r/g, "&#xD;")
    .replace(/\n/g, "&#xA;")
    .replace(/\t/g, "&#x9;");
}

interface Node {
  tag: string;
  attrs: Attr[];
  children: (Node | string)[];
}

/**
 * Analisa o XML numa árvore simples.
 *
 * Deliberadamente ingênuo, e pode ser: o documento já passou por `guardXml`,
 * que recusou DOCTYPE, entidades e instruções de processamento. O que sobra é
 * elemento, atributo e texto.
 *
 * Devolve `null` no que não fecha — tag sem fechamento, aninhamento errado.
 * Um XML malformado não pode virar uma árvore parcial que o hash aceitaria.
 */
function parse(xml: string): Node | null {
  const pilha: Node[] = [];
  let raiz: Node | null = null;
  let i = 0;

  while (i < xml.length) {
    const abre = xml.indexOf("<", i);

    if (abre < 0) break;

    if (abre > i) {
      const texto = xml.slice(i, abre);
      /* Espaço entre elementos é significativo na canonicalização: some só
         antes da raiz e depois dela. */
      if (pilha.length > 0) pilha[pilha.length - 1]!.children.push(texto);
    }

    const fecha = xml.indexOf(">", abre);
    if (fecha < 0) return null;

    const conteudoTag = xml.slice(abre + 1, fecha);
    i = fecha + 1;

    if (conteudoTag.startsWith("/")) {
      const atual = pilha.pop();
      if (!atual) return null;
      /* Fechamento que não corresponde à abertura: documento malformado. */
      if (atual.tag !== conteudoTag.slice(1).trim()) return null;
      if (pilha.length === 0) raiz = atual;
      continue;
    }

    const vazio = conteudoTag.endsWith("/");
    const semBarra = vazio ? conteudoTag.slice(0, -1) : conteudoTag;

    const no: Node = { tag: nomeDaTag(semBarra), attrs: lerAtributos(semBarra), children: [] };

    if (pilha.length > 0) pilha[pilha.length - 1]!.children.push(no);

    if (vazio) {
      if (pilha.length === 0) raiz = no;
    } else {
      pilha.push(no);
    }
  }

  return pilha.length === 0 ? raiz : null;
}

function nomeDaTag(conteudo: string): string {
  const m = /^([^\s]+)/.exec(conteudo.trim());
  return m ? m[1]! : "";
}

function lerAtributos(conteudo: string): Attr[] {
  const attrs: Attr[] = [];
  const re = /([^\s=]+)\s*=\s*"([^"]*)"|([^\s=]+)\s*=\s*'([^']*)'/g;

  const semNome = conteudo.trim().replace(/^[^\s]+/, "");

  for (const m of semNome.matchAll(re)) {
    const nome = (m[1] ?? m[3])!;
    const valor = (m[2] ?? m[4]) ?? "";

    const nsPrefix =
      nome === "xmlns" ? "" : nome.startsWith("xmlns:") ? nome.slice(6) : null;

    attrs.push({ name: nome, value: valor, nsPrefix });
  }

  return attrs;
}

/** O prefixo de um nome qualificado: `ds:Signature` → `ds`. */
function prefixoDe(nome: string): string {
  const i = nome.indexOf(":");
  return i < 0 ? "" : nome.slice(0, i);
}

/**
 * Os prefixos que ESTE elemento usa — nele mesmo ou nos atributos.
 *
 * É o que "exclusiva" quer dizer: um namespace declarado lá em cima do
 * documento só desce até aqui se este elemento realmente o usar. Sem isso,
 * arrancar a asserção de dentro da resposta mudaria o conjunto de namespaces
 * e o hash — e a assinatura, que foi feita sobre a asserção isolada, falharia.
 */
function prefixosUsados(no: Node): Set<string> {
  const usados = new Set<string>([prefixoDe(no.tag)]);

  for (const a of no.attrs) {
    /* Declaração de namespace não conta como uso: ela É a declaração. */
    if (a.nsPrefix !== null) continue;
    const p = prefixoDe(a.name);
    /* Atributo sem prefixo não pertence a namespace nenhum, pelo padrão. */
    if (p) usados.add(p);
  }

  return usados;
}

/**
 * Serializa um nó na forma canônica.
 *
 * `herdados` são as declarações visíveis de fora, e `emVigor` o que já foi
 * escrito neste ramo — juntos evitam repetir a mesma declaração em cada nível,
 * que é o que a forma exclusiva define.
 */
function serializar(
  no: Node,
  herdados: Map<string, string>,
  emVigor: Map<string, string>,
): string {
  const usados = prefixosUsados(no);

  const proprias = new Map(
    no.attrs.filter((a) => a.nsPrefix !== null).map((a) => [a.nsPrefix!, a.value]),
  );

  const visiveis = new Map([...herdados, ...proprias]);

  /* Só os namespaces USADOS entram, e só quando mudam o que já está em vigor
     — repetir uma declaração idêntica alteraria o hash sem alterar o
     significado. */
  const declarar: Array<[string, string]> = [];
  for (const prefixo of [...usados].sort()) {
    const uri = visiveis.get(prefixo);
    if (uri === undefined) continue;
    if (emVigor.get(prefixo) === uri) continue;
    declarar.push([prefixo, uri]);
  }

  const nsTexto = declarar
    .map(([p, uri]) => (p === "" ? ` xmlns="${escapeAttr(uri)}"` : ` xmlns:${p}="${escapeAttr(uri)}"`))
    .join("");

  /* Atributos comuns em ordem: pelo URI do namespace, depois pelo nome
     local. O padrão define exatamente isso, e a ordem é o que torna o hash
     independente de como o provedor gravou o documento. */
  const comuns = no.attrs
    .filter((a) => a.nsPrefix === null)
    .map((a) => ({ ...a, uri: visiveis.get(prefixoDe(a.name)) ?? "" }))
    .sort((x, y) => (x.uri === y.uri ? (x.name < y.name ? -1 : 1) : x.uri < y.uri ? -1 : 1));

  const attrTexto = comuns.map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join("");

  const novoEmVigor = new Map([...emVigor, ...declarar]);

  const dentro = no.children
    .map((filho) =>
      typeof filho === "string" ? escapeText(filho) : serializar(filho, visiveis, novoEmVigor),
    )
    .join("");

  /* Elemento vazio vira par de tags, sempre: `<a/>` e `<a></a>` são o mesmo
     documento e precisam do mesmo hash. */
  return `<${no.tag}${nsTexto}${attrTexto}>${dentro}</${no.tag}>`;
}

/**
 * A forma canônica de um trecho de XML.
 *
 * `herdados` traz os namespaces declarados nos ancestrais — necessários
 * quando o trecho é arrancado de dentro de um documento maior, que é
 * exatamente o caso da asserção dentro da resposta.
 *
 * Devolve `null` no XML que não analisa. Melhor recusar a asserção que
 * calcular um hash sobre uma árvore adivinhada.
 */
export function canonicalize(xml: string, herdados: Map<string, string> = new Map()): string | null {
  const arvore = parse(xml.trim());
  if (!arvore) return null;

  return serializar(arvore, herdados, new Map());
}

/**
 * Os namespaces declarados nos ancestrais de um trecho.
 *
 * Lidos do documento inteiro até a posição onde o trecho começa: uma asserção
 * costuma usar o prefixo `saml:` declarado lá na raiz da resposta, e sem
 * trazê-lo a forma canônica sairia sem a declaração — com hash diferente do
 * que o provedor assinou.
 */
export function namespacesAntesDe(documento: string, posicao: number): Map<string, string> {
  const antes = documento.slice(0, posicao);
  const mapa = new Map<string, string>();

  for (const m of antes.matchAll(/xmlns(?::([w.-]+))?s*=s*["']([^"']*)["']/g)) {
    mapa.set(m[1] ?? "", m[2] ?? "");
  }

  return mapa;
}
