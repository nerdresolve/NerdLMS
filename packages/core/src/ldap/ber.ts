/**
 * Codificação BER, o suficiente para falar LDAP.
 *
 * LDAP não é HTTP: é um protocolo binário sobre TCP, e cada mensagem é uma
 * estrutura BER — o mesmo esquema de "tipo, tamanho, valor" que o X.509 usa.
 *
 * POR QUE ESCREVER ISTO
 *
 * A mesma razão do leitor de ZIP e do manifesto SCORM: a proposta exclui
 * licença de terceiro. E aqui o escopo é pequeno de verdade — para autenticar
 * alguém, o LDAP precisa de UMA operação (bind), e ela cabe em quarenta bytes.
 * Uma biblioteca completa traria o protocolo inteiro para usar um por cento
 * dele.
 *
 * O QUE ESTE CODIFICADOR NÃO FAZ
 *
 * Não trata a forma indefinida de comprimento (que o LDAP não usa), nem
 * inteiros acima de 32 bits (os identificadores de mensagem são pequenos por
 * definição). Os dois seriam necessários num decodificador de X.509 genérico e
 * não aparecem aqui.
 */

/** As etiquetas BER que este módulo usa. */
export const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  OCTET_STRING: 0x04,
  ENUMERATED: 0x0a,
  SEQUENCE: 0x30,
  /* O SET aparece na resposta da busca: os VALORES de um atributo vêm num
     conjunto, porque `memberOf` tem um por grupo e `mail` costuma ter um só.
     O protocolo não distingue os dois casos — quem lê é que decide. */
  SET: 0x31,
} as const;

/**
 * O comprimento, na forma que o BER define.
 *
 * Até 127, um byte só com o valor. Acima disso, um byte dizendo quantos bytes
 * de comprimento vêm a seguir, e depois eles. É a "forma longa", e ela existe
 * porque um valor de 300 bytes não cabe em sete bits.
 */
export function encodeLength(comprimento: number): Buffer {
  if (comprimento < 0x80) return Buffer.from([comprimento]);

  const bytes: number[] = [];
  let resto = comprimento;

  while (resto > 0) {
    bytes.unshift(resto & 0xff);
    resto = Math.floor(resto / 256);
  }

  /* O bit alto marca a forma longa; os sete restantes dizem quantos bytes. */
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** Um elemento BER completo: etiqueta, comprimento e conteúdo. */
export function encode(tag: number, conteudo: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(conteudo.length), conteudo]);
}

export function encodeInteger(valor: number): Buffer {
  if (valor === 0) return encode(TAG.INTEGER, Buffer.from([0]));

  const bytes: number[] = [];
  let resto = valor;

  while (resto > 0) {
    bytes.unshift(resto & 0xff);
    resto = Math.floor(resto / 256);
  }

  /* Se o bit alto do primeiro byte estiver ligado, o BER leria o número como
     NEGATIVO — o formato é de inteiro com sinal. O zero à frente desfaz isso.
     Sem ele, um `messageId` de 128 viraria -128 e o servidor responderia a uma
     mensagem que não existe. */
  if ((bytes[0]! & 0x80) !== 0) bytes.unshift(0);

  return encode(TAG.INTEGER, Buffer.from(bytes));
}

export function encodeString(valor: string): Buffer {
  return encode(TAG.OCTET_STRING, Buffer.from(valor, "utf8"));
}

export function encodeSequence(...partes: Buffer[]): Buffer {
  return encode(TAG.SEQUENCE, Buffer.concat(partes));
}

export interface BerElement {
  tag: number;
  /** O conteúdo, sem etiqueta nem comprimento. */
  value: Buffer;
  /** Quantos bytes o elemento inteiro ocupou. */
  totalLength: number;
}

/**
 * Lê um elemento BER a partir de uma posição.
 *
 * Devolve `null` no que não dá para ler — buffer curto, comprimento maior que
 * o disponível. O servidor é de terceiro e a rede corta pacotes ao meio: uma
 * exceção aqui derrubaria o login de quem está esperando, e `null` deixa quem
 * chamou tratar como "resposta incompleta, aguarde mais bytes".
 */
export function decode(buf: Buffer, offset = 0): BerElement | null {
  if (offset + 2 > buf.length) return null;

  const tag = buf[offset]!;
  const primeiro = buf[offset + 1]!;

  let comprimento: number;
  let inicio: number;

  if (primeiro < 0x80) {
    comprimento = primeiro;
    inicio = offset + 2;
  } else {
    const quantos = primeiro & 0x7f;

    /* Zero bytes de comprimento é a forma INDEFINIDA, que o LDAP não usa. E
       acima de quatro seria um valor maior que 4 GB numa resposta de
       autenticação — as duas coisas indicam dado corrompido, não mensagem
       legítima. */
    if (quantos === 0 || quantos > 4) return null;
    if (offset + 2 + quantos > buf.length) return null;

    comprimento = 0;
    for (let i = 0; i < quantos; i += 1) {
      comprimento = comprimento * 256 + buf[offset + 2 + i]!;
    }
    inicio = offset + 2 + quantos;
  }

  if (inicio + comprimento > buf.length) return null;

  return {
    tag,
    value: buf.subarray(inicio, inicio + comprimento),
    totalLength: inicio + comprimento - offset,
  };
}

/** Um inteiro BER como número. */
export function decodeInteger(value: Buffer): number {
  let n = 0;
  for (const byte of value) n = n * 256 + byte;
  return n;
}

/**
 * Um booleano BER.
 *
 * `0xff` para verdadeiro, e não `0x01`: o padrão manda "qualquer byte diferente
 * de zero", mas o DER — que vários servidores exigem mesmo em BER — só aceita
 * todos os bits ligados. Escrever `0xff` funciona nos dois; escrever `0x01`
 * funciona em quase todos, e o "quase" aparece no cliente errado.
 */
export function encodeBoolean(valor: boolean): Buffer {
  return encode(TAG.BOOLEAN, Buffer.from([valor ? 0xff : 0x00]));
}

export function encodeSet(...partes: Buffer[]): Buffer {
  return encode(TAG.SET, Buffer.concat(partes));
}

/**
 * Todos os elementos de um conteúdo, em sequência.
 *
 * Uma SEQUENCE do BER não diz quantos filhos tem: eles são lidos até o
 * conteúdo acabar. Percorrer com `decode` e somar `totalLength` é o laço que
 * cada leitor repetiria — aqui ele existe uma vez.
 *
 * Um elemento ilegível INTERROMPE a lista em vez de derrubar tudo. Quem chamou
 * recebe o que deu para ler e decide: numa busca, é a diferença entre perder um
 * atributo e perder o login.
 */
export function decodeAll(conteudo: Buffer): BerElement[] {
  const elementos: BerElement[] = [];
  let posicao = 0;

  while (posicao < conteudo.length) {
    const elemento = decode(conteudo, posicao);
    if (!elemento || elemento.totalLength <= 0) break;
    elementos.push(elemento);
    posicao += elemento.totalLength;
  }

  return elementos;
}
