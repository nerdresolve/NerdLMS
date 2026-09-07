/**
 * As mensagens LDAP que este produto usa.
 *
 * Uma só, na prática: o `BindRequest`, que pergunta ao diretório "esta senha
 * está certa para esta pessoa?". É o que basta para autenticar, e é o que o
 * SSO por LDAP precisa.
 *
 * O QUE NÃO ESTÁ AQUI, E POR QUÊ
 *
 * `SearchRequest` — buscar nome, e-mail e grupos no diretório — é outra
 * mensagem, bem maior, com filtros que formam uma linguagem própria. Ela não
 * entra porque os dados da pessoa já vêm do cadastro daqui ou do primeiro
 * acesso: o diretório responde SE ela pode entrar, e essa é a pergunta que o
 * LDAP responde melhor que qualquer outro.
 */

import { decode, decodeInteger, encodeInteger, encodeSequence, encodeString, TAG } from "./ber.ts";

/** Aplicação 0: BindRequest. O bit 0x60 marca "classe aplicação, construído". */
const APP_BIND_REQUEST = 0x60;
const APP_BIND_RESPONSE = 0x61;

/** Contexto 0: a senha, dentro do bind. */
const CTX_SIMPLE_AUTH = 0x80;

/**
 * O código de resultado que o servidor devolve.
 *
 * A lista é a do RFC 4511; aqui estão os que aparecem numa autenticação. Os
 * demais viram "erro desconhecido" com o número — melhor que uma mensagem
 * inventada.
 */
export const RESULT = {
  SUCCESS: 0,
  OPERATIONS_ERROR: 1,
  PROTOCOL_ERROR: 2,
  /* O DN existe mas não é único, ou a busca não achou. */
  NO_SUCH_OBJECT: 32,
  INVALID_CREDENTIALS: 49,
  INSUFFICIENT_ACCESS: 50,
  BUSY: 51,
  UNAVAILABLE: 52,
  /* O servidor exige TLS antes de aceitar senha. */
  CONFIDENTIALITY_REQUIRED: 13,
  /* Ligação anônima recusada: o diretório exige credencial. */
  INAPPROPRIATE_AUTHENTICATION: 48,
} as const;

/**
 * Monta um `BindRequest` simples.
 *
 * "Simples" é o nome do método no protocolo: o DN e a senha vão em texto. É
 * seguro porque a conexão é TLS — e é por isso que este produto recusa LDAP
 * sem TLS. Numa conexão em claro, a senha do diretório corporativo
 * atravessaria a rede legível.
 *
 * `messageId` numera a mensagem: a resposta vem com o mesmo número, e é assim
 * que se sabe que ela é desta pergunta.
 */
export function bindRequest(messageId: number, dn: string, senha: string): Buffer {
  const corpo = Buffer.concat([
    /* Versão 3 do protocolo. A 2 foi retirada do padrão há décadas, e um
       servidor que só a aceite é um servidor que não deveria receber senha. */
    encodeInteger(3),
    encodeString(dn),
    /* A senha vai com etiqueta de contexto, não de string comum — é assim que
       o protocolo distingue senha de outros métodos de autenticação. */
    Buffer.concat([
      Buffer.from([CTX_SIMPLE_AUTH, ...tamanhoCurto(Buffer.byteLength(senha, "utf8"))]),
      Buffer.from(senha, "utf8"),
    ]),
  ]);

  const bind = Buffer.concat([
    Buffer.from([APP_BIND_REQUEST]),
    tamanhoCurto(corpo.length),
    corpo,
  ]);

  return encodeSequence(encodeInteger(messageId), bind);
}

/** O comprimento na forma que o BER pede, para etiquetas não-padrão. */
function tamanhoCurto(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);

  const bytes: number[] = [];
  let resto = n;
  while (resto > 0) {
    bytes.unshift(resto & 0xff);
    resto = Math.floor(resto / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

export interface BindResponse {
  messageId: number;
  resultCode: number;
  /** O que o servidor disse, quando disse algo. */
  diagnostic: string;
}

export type ParseResult =
  | { ok: true; response: BindResponse }
  | { ok: false; error: string }
  /** Faltam bytes: a resposta ainda está chegando. */
  | { ok: false; incomplete: true };

/**
 * Lê a resposta do bind.
 *
 * A estrutura é: sequência → [messageId, BindResponse], e o BindResponse
 * começa com o código de resultado, o DN do erro e a mensagem de diagnóstico.
 *
 * INCOMPLETO NÃO É ERRO. O TCP entrega em pedaços, e uma resposta cortada ao
 * meio é normal — quem chamou espera mais bytes e tenta de novo. Tratar como
 * erro faria o login falhar por causa do tamanho de um pacote.
 */
export function parseBindResponse(buf: Buffer): ParseResult {
  const envelope = decode(buf);
  if (!envelope) return { ok: false, incomplete: true };
  if (envelope.tag !== TAG.SEQUENCE) {
    return { ok: false, error: "Resposta do diretório em formato inesperado." };
  }

  const id = decode(envelope.value);
  if (!id || id.tag !== TAG.INTEGER) {
    return { ok: false, error: "Resposta do diretório sem identificador." };
  }

  const corpo = decode(envelope.value, id.totalLength);
  if (!corpo) return { ok: false, incomplete: true };

  if (corpo.tag !== APP_BIND_RESPONSE) {
    /* Outra operação chegando no lugar da resposta do bind. Pode ser um
       "unsolicited notification" — o servidor avisando que vai desconectar. */
    return { ok: false, error: "O diretório respondeu a outra operação." };
  }

  const resultado = decode(corpo.value);
  if (!resultado || resultado.tag !== TAG.ENUMERATED) {
    return { ok: false, error: "Resposta do diretório sem código de resultado." };
  }

  const matchedDn = decode(corpo.value, resultado.totalLength);
  const diagnostico = matchedDn
    ? decode(corpo.value, resultado.totalLength + matchedDn.totalLength)
    : null;

  return {
    ok: true,
    response: {
      messageId: decodeInteger(id.value),
      resultCode: decodeInteger(resultado.value),
      diagnostic: diagnostico ? diagnostico.value.toString("utf8") : "",
    },
  };
}

/**
 * A mensagem que a pessoa vê.
 *
 * NUNCA o diagnóstico cru do servidor. O Active Directory devolve códigos como
 * `data 532` ali, que dizem se a senha expirou, se a conta está travada ou se
 * ela não existe — informação útil para quem administra e um mapa para quem
 * ataca. O diagnóstico vai para o log; a pessoa recebe o essencial.
 */
export function mensagemDoResultado(code: number): string {
  switch (code) {
    case RESULT.SUCCESS:
      return "";
    case RESULT.INVALID_CREDENTIALS:
    case RESULT.NO_SUCH_OBJECT:
      /* Os dois dão a MESMA mensagem, de propósito: distinguir "usuário não
         existe" de "senha errada" entrega ao atacante a lista de quem trabalha
         na empresa. É a mesma regra do login por senha. */
      return "Usuário ou senha inválidos.";
    case RESULT.INAPPROPRIATE_AUTHENTICATION:
      return "O diretório recusou este tipo de autenticação.";
    case RESULT.INSUFFICIENT_ACCESS:
      return "Esta conta não tem permissão para entrar.";
    case RESULT.CONFIDENTIALITY_REQUIRED:
      return "O diretório exige conexão segura.";
    case RESULT.BUSY:
    case RESULT.UNAVAILABLE:
      return "O diretório está indisponível. Tente de novo em instantes.";
    default:
      return "Não foi possível autenticar no diretório.";
  }
}
