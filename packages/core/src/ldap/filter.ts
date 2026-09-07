/**
 * Filtros de busca LDAP.
 *
 * POR QUE ISTO NÃO É UMA STRING
 *
 * O jeito comum de montar um filtro é concatenar texto:
 *
 *     filtro = "(sAMAccountName=" + usuario + ")"
 *
 * E é o mesmo erro do SQL montado com `+`. Quem digitasse
 * `*)(objectClass=*` transformaria a pergunta "quem é fulano?" em "me devolva
 * todo mundo" — e num diretório corporativo isso é a lista de funcionários da
 * empresa. O ataque tem nome, LDAP injection, e a defesa por escapamento
 * depende de acertar cinco caracteres em todos os pontos, para sempre.
 *
 * Aqui o filtro é uma ÁRVORE, montada em BER e enviada assim. O valor viaja num
 * OCTET STRING, que carrega bytes: um parêntese dentro dele é o byte 0x28 e não
 * tem como virar estrutura, porque a estrutura já foi decidida antes do valor
 * existir. Não é escapamento bem feito — é a categoria de falha deixando de
 * existir. Pelo mesmo motivo, `*` num valor daqui é um asterisco literal, nunca
 * um curinga.
 *
 * O RFC 4511 define dez tipos de filtro. Estão aqui os quatro de que este
 * produto precisa; os outros entram quando alguma tela pedir.
 */

import { encode, encodeString, TAG } from "./ber.ts";
import type { DirectoryKind } from "./directory.ts";

/**
 * As etiquetas do RFC 4511 §4.5.1.
 *
 * Contexto-específicas: `0xa0` é `[0]` construído, `0x87` é `[7]` primitivo.
 * `present` é o único primitivo do grupo — ele carrega só o nome do atributo,
 * sem valor para comparar.
 */
const FILTRO = {
  AND: 0xa0,
  OR: 0xa1,
  NOT: 0xa2,
  EQUALITY: 0xa3,
  PRESENT: 0x87,
} as const;

/** Um filtro já codificado, pronto para entrar na busca. */
export type Filter = Buffer;

/**
 * `(atributo=valor)`.
 *
 * O valor aceita `Buffer` porque nem todo atributo é texto: procurar por
 * `objectGUID` compara dezesseis bytes crus, que não sobrevivem a uma
 * conversão para string.
 */
export function equals(atributo: string, valor: string | Buffer): Filter {
  const bytes = typeof valor === "string" ? Buffer.from(valor, "utf8") : valor;

  return encode(
    FILTRO.EQUALITY,
    Buffer.concat([encodeString(atributo), encode(TAG.OCTET_STRING, bytes)]),
  );
}

/** `(atributo=*)` — existe, com qualquer valor. */
export function present(atributo: string): Filter {
  /* Primitivo: o conteúdo é o nome do atributo, sem envelope. */
  return encode(FILTRO.PRESENT, Buffer.from(atributo, "utf8"));
}

/**
 * `(&(a)(b))`.
 *
 * Com um filho só, devolve o próprio filho. Um `and` de um elemento é válido no
 * protocolo e alguns servidores o rejeitam mesmo assim; sem filho nenhum ele é
 * "verdadeiro absoluto" no RFC 4526 e "erro de protocolo" em quase todo servidor
 * real — este é o caso que a chamada mais provavelmente não quis pedir.
 */
export function and(...filhos: Filter[]): Filter {
  if (filhos.length === 1) return filhos[0]!;
  return encode(FILTRO.AND, Buffer.concat(filhos));
}

/** `(|(a)(b))`. Mesma regra do `and` para um filho só. */
export function or(...filhos: Filter[]): Filter {
  if (filhos.length === 1) return filhos[0]!;
  return encode(FILTRO.OR, Buffer.concat(filhos));
}

/** `(!(a))`. */
export function not(filho: Filter): Filter {
  return encode(FILTRO.NOT, filho);
}

/**
 * O filtro que acha uma pessoa, no vocabulário de cada diretório.
 *
 * Aceita as DUAS formas de identificação, porque as duas são o que a pessoa
 * pode ter digitado: o nome de conta (`ana.silva`) e o e-mail
 * (`ana.silva@empresa.com.br`). Escolher pela presença do `@` erraria com
 * diretório que usa endereço como nome de conta, e perguntar as duas custa uma
 * viagem só.
 *
 * POR QUE O FILTRO MUDA COM O TIPO
 *
 * Os nomes dos atributos não são universais. `sAMAccountName` é invenção da
 * Microsoft e não existe em OpenLDAP, onde o equivalente é `uid`; `objectClass:
 * User` é do esquema do AD, e o padrão é `person`. Um filtro só, escrito no
 * vocabulário do Active Directory, encontra zero objetos em qualquer outro
 * diretório — e o login segue funcionando, porque o bind não depende da busca,
 * mas o perfil e os grupos nunca chegam. Falha silenciosa, que é a pior forma.
 */
export function pessoaPorIdentificador(identificador: string, kind: DirectoryKind): Filter {
  const identidade = (contaAttr: string): Filter =>
    or(equals(contaAttr, identificador), equals("mail", identificador));

  if (kind === "ad") {
    /* `objectCategory=Person` junto de `objectClass=User` não é redundância: no
       AD, `objectClass=User` também casa com CONTA DE COMPUTADOR, e sem o
       `objectCategory` uma máquina chamada como alguém entraria na busca. */
    return and(
      equals("objectCategory", "Person"),
      equals("objectClass", "User"),
      identidade("sAMAccountName"),
    );
  }

  /* OpenLDAP e genérico. `person` é a classe do esquema padrão (RFC 4519), da
     qual `inetOrgPerson` — a que praticamente toda instalação usa — herda: o
     filtro casa com as duas. */
  return and(equals("objectClass", "person"), identidade("uid"));
}
