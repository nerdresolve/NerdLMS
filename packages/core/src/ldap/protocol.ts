/**
 * As mensagens LDAP que este produto usa.
 *
 * Duas: o `BindRequest`, que pergunta "esta senha está certa para esta
 * pessoa?", e o `SearchRequest`, que pergunta "quem é ela?".
 *
 * POR QUE A BUSCA PASSOU A EXISTIR
 *
 * Enquanto o diretório só decidia SE alguém entra, o bind bastava — os dados da
 * pessoa vinham do cadastro daqui. Passou a decidir também COM QUE PERFIL, e aí
 * o cadastro daqui deixou de ser a fonte: quem sai de um grupo do Active
 * Directory tem de perder o acesso correspondente no mesmo dia, sem depender de
 * alguém lembrar de repetir a mudança em duas telas.
 *
 * Isso exige ler `memberOf`, e ler exige buscar.
 *
 * O QUE CONTINUA FORA
 *
 * Escrever. `Add`, `Modify`, `Delete` e `ModifyDN` não estão aqui e não devem
 * entrar: o diretório é a fonte da verdade, e uma ferramenta de treinamento que
 * altera o Active Directory da empresa é uma ferramenta com poder que ninguém
 * lhe deu.
 */

import {
  type BerElement,
  decode,
  decodeAll,
  decodeInteger,
  encode,
  encodeBoolean,
  encodeInteger,
  encodeSequence,
  encodeString,
  TAG,
} from "./ber.ts";
import type { Filter } from "./filter.ts";

/** Aplicação 0: BindRequest. O bit 0x60 marca "classe aplicação, construído". */
const APP_BIND_REQUEST = 0x60;
const APP_BIND_RESPONSE = 0x61;
const APP_SEARCH_REQUEST = 0x63;
const APP_SEARCH_ENTRY = 0x64;
const APP_SEARCH_DONE = 0x65;
/**
 * Aplicação 19: SearchResultReference.
 *
 * O Active Directory devolve isto numa busca a partir da raiz do domínio: "o
 * que você procura pode estar naquele outro servidor". Não é resultado nem
 * erro — é um ponteiro, e um cliente que o trate como qualquer um dos dois
 * quebra em floresta com mais de um domínio. Aqui ele é IGNORADO: seguir a
 * referência abriria conexão para um servidor que quem configurou não indicou.
 */
const APP_SEARCH_REFERENCE = 0x73;

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

/* ------------------------------------------------------------------ busca */

/**
 * O alcance da busca.
 *
 * `SUBTREE` é o que serve para achar uma pessoa: numa empresa as contas estão
 * espalhadas por unidades organizacionais que mudam de nome e de dono, e exigir
 * que quem configura acerte a OU de cada departamento é exigir manutenção
 * eterna. `BASE` existe para ler um objeto que já se conhece pelo DN.
 */
export const SCOPE = {
  BASE: 0,
  ONE_LEVEL: 1,
  SUBTREE: 2,
} as const;

export interface SearchParams {
  /** Onde começar. No Active Directory, a raiz do domínio. */
  baseDn: string;
  scope: number;
  filter: Filter;
  /** Quais atributos trazer. Lista vazia significa "todos" no protocolo. */
  attributes: string[];
  /**
   * Quantos objetos no máximo.
   *
   * Nunca zero, que no protocolo é "sem limite". Uma busca de login espera UMA
   * pessoa; pedir duas é o bastante para detectar ambiguidade, e um filtro
   * defeituoso que casasse com o diretório inteiro pararia na segunda em vez de
   * arrastar dezenas de milhares de objetos pela rede.
   */
  sizeLimit: number;
  /** Segundos que o SERVIDOR pode gastar. Independe do tempo do socket. */
  timeLimit: number;
}

/**
 * Monta um `SearchRequest`.
 *
 * A ordem dos campos é a do RFC 4511 §4.5.1 e não é negociável: o BER não
 * nomeia campos, identifica pela posição. Trocar `sizeLimit` de lugar com
 * `timeLimit` produz uma mensagem que decodifica sem erro e pede a coisa
 * errada.
 */
export function searchRequest(messageId: number, params: SearchParams): Buffer {
  const corpo = Buffer.concat([
    encodeString(params.baseDn),
    encode(TAG.ENUMERATED, Buffer.from([params.scope])),
    /* `neverDerefAliases`. Alias é recurso de OpenLDAP que o AD nem
       implementa, e segui-los abre a porta para laço de referência — um
       diretório mal configurado penduraria o login. */
    encode(TAG.ENUMERATED, Buffer.from([0])),
    encodeInteger(params.sizeLimit),
    encodeInteger(params.timeLimit),
    /* `typesOnly` falso: queremos os valores, não a lista de quais atributos
       existem. */
    encodeBoolean(false),
    params.filter,
    encodeSequence(...params.attributes.map((a) => encodeString(a))),
  ]);

  return encodeSequence(encodeInteger(messageId), encode(APP_SEARCH_REQUEST, corpo));
}

/** Uma mensagem LDAP inteira, ainda sem interpretar a operação. */
export interface LdapMessage {
  messageId: number;
  /** A operação: a etiqueta diz qual, o conteúdo é dela. */
  op: BerElement;
  /** Quantos bytes esta mensagem consumiu do fluxo. */
  totalLength: number;
}

export type MessageResult =
  | { ok: true; message: LdapMessage }
  | { ok: false; error: string }
  | { ok: false; incomplete: true };

/**
 * Lê UMA mensagem a partir do início do buffer.
 *
 * A busca é a primeira operação deste produto que responde com VÁRIAS
 * mensagens: uma por objeto encontrado, mais a que diz que acabou — e todas
 * podem chegar no mesmo pacote TCP, ou uma partida entre dois. Por isso a
 * função devolve `totalLength`: quem chama avança essa quantidade e lê a
 * próxima, até faltar byte.
 *
 * Incompleto NÃO é erro, pelo mesmo motivo de sempre — o TCP entrega em
 * pedaços, e tratar um pedaço como falha derrubaria o login pelo tamanho de um
 * pacote.
 */
export function parseMessage(buf: Buffer, offset = 0): MessageResult {
  const envelope = decode(buf, offset);
  if (!envelope) return { ok: false, incomplete: true };

  if (envelope.tag !== TAG.SEQUENCE) {
    return { ok: false, error: "Resposta do diretório em formato inesperado." };
  }

  const id = decode(envelope.value);
  if (!id || id.tag !== TAG.INTEGER) {
    return { ok: false, error: "Resposta do diretório sem identificador." };
  }

  const op = decode(envelope.value, id.totalLength);
  if (!op) return { ok: false, incomplete: true };

  return {
    ok: true,
    message: {
      messageId: decodeInteger(id.value),
      op,
      totalLength: envelope.totalLength,
    },
  };
}

export interface LdapResult {
  resultCode: number;
  diagnostic: string;
}

/**
 * O trio que abre toda resposta de resultado: código, DN do erro, diagnóstico.
 *
 * É a mesma estrutura no fim do bind, no fim da busca e em qualquer operação
 * que termine — o `LDAPResult` do RFC. Ler uma vez evita três leitores que
 * divergem.
 */
export function parseLdapResult(conteudo: Buffer): LdapResult | null {
  const partes = decodeAll(conteudo);
  const codigo = partes[0];

  if (!codigo || codigo.tag !== TAG.ENUMERATED) return null;

  return {
    resultCode: decodeInteger(codigo.value),
    /* Posição 1 é o `matchedDN`, que não interessa a ninguém aqui; 2 é o
       diagnóstico. Ausentes em servidor que não os preenche. */
    diagnostic: partes[2] ? partes[2].value.toString("utf8") : "",
  };
}

/**
 * Um objeto encontrado.
 *
 * Os valores ficam como `Buffer`, não como string, e isso é deliberado:
 * `objectGUID` são dezesseis bytes crus que uma conversão para UTF-8 destruiria
 * — os bytes inválidos virariam o caractere de substituição e o identificador
 * mais estável do diretório deixaria de identificar. Quem quer texto converte,
 * quem quer bytes já os tem.
 */
export interface SearchEntry {
  dn: string;
  attributes: Map<string, Buffer[]>;
}

/**
 * Lê um `SearchResultEntry`.
 *
 * O nome do atributo vira MINÚSCULA na chave. O LDAP não diferencia maiúsculas
 * em nome de atributo, e o servidor devolve com a grafia do esquema dele:
 * `sAMAccountName` num, `samaccountname` noutro. Procurar pela grafia que se
 * escreveu no código funcionaria até o cliente cujo servidor escreve
 * diferente.
 */
export function parseSearchEntry(conteudo: Buffer): SearchEntry | null {
  const partes = decodeAll(conteudo);
  const nome = partes[0];
  const lista = partes[1];

  if (!nome || !lista) return null;

  const attributes = new Map<string, Buffer[]>();

  for (const atributo of decodeAll(lista.value)) {
    const campos = decodeAll(atributo.value);
    const tipo = campos[0];
    const valores = campos[1];
    if (!tipo || !valores) continue;

    attributes.set(
      tipo.value.toString("utf8").toLowerCase(),
      decodeAll(valores.value).map((v) => v.value),
    );
  }

  return { dn: nome.value.toString("utf8"), attributes };
}

/** As etiquetas que a leitura da busca precisa distinguir. */
export const OP = {
  BIND_RESPONSE: APP_BIND_RESPONSE,
  SEARCH_ENTRY: APP_SEARCH_ENTRY,
  SEARCH_DONE: APP_SEARCH_DONE,
  SEARCH_REFERENCE: APP_SEARCH_REFERENCE,
} as const;

/* ------------------------------------- o que o Active Directory diz a mais */

/**
 * Por que o bind foi recusado, quando o servidor é Active Directory.
 *
 * O AD responde `invalidCredentials` para TUDO — senha errada, conta
 * desabilitada, conta bloqueada, senha vencida — e põe a diferença no texto de
 * diagnóstico, num pedaço com esta cara:
 *
 *     80090308: LdapErr: DSID-0C0903A9, comment: AcceptSecurityContext error,
 *     data 533, v3839
 *
 * O `data 533` é o motivo real. É a informação que o SCE vai buscar com uma
 * segunda consulta e uma conta de serviço, quando ela já veio na primeira
 * resposta — e vem mais exata: `lockoutTime` continua preenchido depois de o
 * bloqueio expirar, porque o AD só o zera no logon seguinte, então quem espera
 * o tempo da política continua sendo recusado por lá. Aqui não.
 *
 * NENHUM DESTES CÓDIGOS VAI PARA A TELA CRU. Eles viram uma de três respostas,
 * e a escolha entre elas é decisão de produto — ver `MOTIVO`.
 */
export const MOTIVO = {
  /** Senha errada, ou a conta não existe. Indistinguíveis de propósito. */
  CREDENCIAL: "credencial",
  /** A conta existe e está impedida de entrar. */
  BLOQUEADA: "bloqueada",
  /** A senha venceu ou precisa ser trocada no próximo acesso. */
  SENHA_VENCIDA: "senha-vencida",
} as const;

export type MotivoDoBind = (typeof MOTIVO)[keyof typeof MOTIVO];

export function motivoDoBind(diagnostic: string): MotivoDoBind {
  const achado = /data ([0-9a-f]{3,4})/i.exec(diagnostic);
  if (!achado) return MOTIVO.CREDENCIAL;

  switch (achado[1]!.toLowerCase()) {
    /* 533 desabilitada, 775 bloqueada, 701 expirada (data de validade da
       conta), 531 estação não permitida, 530 fora do horário permitido. Os
       cinco significam a mesma coisa para quem está na tela: a senha está
       certa e ainda assim não dá para entrar — procure quem administra. */
    case "533":
    case "775":
    case "701":
    case "531":
    case "530":
      return MOTIVO.BLOQUEADA;

    /* 532 senha vencida, 773 precisa trocar no próximo acesso. Separados do
       grupo acima porque a saída é diferente: aqui a própria pessoa resolve. */
    case "532":
    case "773":
      return MOTIVO.SENHA_VENCIDA;

    /* 525 não existe, 52e senha errada. A MESMA resposta, sempre: separar as
       duas entrega a lista de quem trabalha na empresa a quem estiver
       sondando. */
    default:
      return MOTIVO.CREDENCIAL;
  }
}

/**
 * A mensagem que a pessoa vê, quando o motivo é conhecido.
 *
 * A DE CONTA BLOQUEADA CONFIRMA QUE A CONTA EXISTE, e isso é uma escolha, não
 * um descuido. O contrário — mandar "usuário ou senha inválidos" para quem
 * digitou a senha certa — faz a pessoa tentar de novo, esgotar a política de
 * bloqueio e ligar para o suporte descrevendo o problema errado. Num sistema
 * cujo login é o diretório da empresa, o público é quem já trabalha nela; o
 * ganho de não confirmar a existência da conta é pequeno diante do custo de
 * esconder a única informação que resolve o caso.
 */
export function mensagemDoMotivo(motivo: MotivoDoBind): string {
  switch (motivo) {
    case MOTIVO.BLOQUEADA:
      return "Sua conta da rede está bloqueada ou desabilitada. Procure o suporte de TI para liberá-la.";
    case MOTIVO.SENHA_VENCIDA:
      return "Sua senha da rede expirou. Troque-a no computador da empresa e entre de novo.";
    default:
      return "Usuário ou senha inválidos.";
  }
}

/**
 * A mensagem de uma BUSCA que falhou.
 *
 * Separada de `mensagemDoResultado` porque os mesmos códigos querem dizer
 * coisas diferentes conforme a operação. `noSuchObject` num bind é "essa conta
 * não existe", e a resposta correta é a mesma da senha errada, para não entregar
 * a lista de quem trabalha na empresa. Numa busca é "a base que você configurou
 * não existe" — um erro de digitação de quem implanta, e chamá-lo de credencial
 * inválida manda a pessoa conferir a senha pelo resto da tarde.
 *
 * ESTAS MENSAGENS NÃO VÃO PARA A TELA DE LOGIN. Vão para o log do servidor e
 * para quem configura: a busca é um passo interno, e o seu fracasso não muda o
 * que quem está entrando precisa saber.
 */
export function mensagemDaBusca(code: number): string {
  switch (code) {
    case RESULT.NO_SUCH_OBJECT:
      return "A base de busca configurada não existe no diretório.";
    case RESULT.INSUFFICIENT_ACCESS:
      return "Sem permissão para ler o diretório. Configure uma conta de serviço de leitura.";
    case RESULT.OPERATIONS_ERROR:
      /* O Active Directory devolve isto para busca em conexão ANÔNIMA — o que
         acontece quando o vínculo se perdeu antes da busca. */
      return "O diretório recusou a busca nesta conexão.";
    case RESULT.BUSY:
    case RESULT.UNAVAILABLE:
      return "O diretório está indisponível.";
    default:
      return `O diretório recusou a busca (código ${code}).`;
  }
}
