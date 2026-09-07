import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { decode, decodeAll, TAG } from "./ber.ts";
import { and, equals, pessoaPorIdentificador, present } from "./filter.ts";
import {
  MOTIVO,
  mensagemDoMotivo,
  motivoDoBind,
  parseLdapResult,
  parseMessage,
  parseSearchEntry,
  SCOPE,
  searchRequest,
} from "./protocol.ts";

/* Um SearchResultEntry montado à mão, como o servidor mandaria. Escrever o
   codificador e o leitor com as mesmas funções esconderia um erro simétrico —
   os bytes aqui são conferidos contra o RFC 4511, não contra o nosso encoder. */
function entradaDeTeste(): Buffer {
  /* O comprimento pela regra do RFC, escrito aqui de novo: acima de 127 o BER
     exige a forma longa, e a primeira versão deste auxiliar usava a curta para
     tudo. Os bytes saíam ilegíveis e o teste acusou — o que é exatamente o que
     ele deveria fazer com uma mensagem malformada vinda da rede. */
  const tamanho = (n: number): Buffer => {
    if (n < 0x80) return Buffer.from([n]);
    const bytes: number[] = [];
    for (let resto = n; resto > 0; resto = Math.floor(resto / 256)) {
      bytes.unshift(resto & 0xff);
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  };

  const tlv = (tag: number, conteudo: Buffer): Buffer =>
    Buffer.concat([Buffer.from([tag]), tamanho(conteudo.length), conteudo]);

  const octeto = (s: string): Buffer => tlv(0x04, Buffer.from(s, "utf8"));

  const atributo = (nome: string, valores: Buffer[]): Buffer =>
    tlv(0x30, Buffer.concat([octeto(nome), tlv(0x31, Buffer.concat(valores))]));

  const lista = Buffer.concat([
    atributo("displayName", [octeto("ANA SILVA")]),
    atributo("memberOf", [
      octeto("CN=LMS_Admin,OU=Grupos,DC=empresa,DC=local"),
      octeto("CN=Todos,DC=empresa,DC=local"),
    ]),
  ]);

  return tlv(
    0x64,
    Buffer.concat([octeto("CN=Ana Silva,OU=Pessoas,DC=empresa,DC=local"), tlv(0x30, lista)]),
  );
}

describe("LDAP, filtros", () => {
  test("um valor com parêntese não vira estrutura", () => {
    /* É o ataque que a montagem por concatenação de texto permite: quem digita
       `*)(objectClass=*` transforma "quem é fulano?" em "me devolva todo
       mundo". Aqui o valor viaja num OCTET STRING, e os bytes dele não são
       lidos como sintaxe — a categoria de falha não existe. */
    const malicioso = "*)(objectClass=*";
    const filtro = equals("sAMAccountName", malicioso);

    const partes = decodeAll(decode(filtro)!.value);
    assert.equal(partes.length, 2, "atributo e valor, e nada mais");
    assert.equal(partes[1]!.value.toString("utf8"), malicioso);
  });

  test("o asterisco é literal, nunca curinga", () => {
    const filtro = equals("cn", "a*");
    const partes = decodeAll(decode(filtro)!.value);
    assert.equal(partes[1]!.value.toString("utf8"), "a*");
  });

  test("valor binário sobrevive, é o caso do objectGUID", () => {
    const guid = Buffer.from([
      0x00, 0xff, 0x80, 0x0a, 0x1b, 0x2c, 0x3d, 0x4e,
      0x5f, 0x60, 0x71, 0x82, 0x93, 0xa4, 0xb5, 0xc6,
    ]);
    const partes = decodeAll(decode(equals("objectGUID", guid))!.value);
    assert.deepEqual(partes[1]!.value, guid);
  });

  test("`and` com um filho só devolve o filho, sem envelope inútil", () => {
    const sozinho = present("mail");
    assert.deepEqual(and(sozinho), sozinho);
  });

  test("`present` é primitivo: carrega o nome, não um envelope", () => {
    const f = present("mail");
    assert.equal(f[0], 0x87);
    assert.equal(decode(f)!.value.toString("utf8"), "mail");
  });

  test("no Active Directory a busca exige objectCategory, não só objectClass", () => {
    /* Sem `objectCategory=Person`, `objectClass=User` também casa com CONTA DE
       COMPUTADOR no Active Directory. */
    const texto = pessoaPorIdentificador("ana", "ad").toString("latin1");
    assert.ok(texto.includes("objectCategory"));
    assert.ok(texto.includes("sAMAccountName"));
  });

  test("fora do AD o vocabulário é outro, e o filtro acompanha", () => {
    /* `sAMAccountName` é invenção da Microsoft e não existe em OpenLDAP. Um
       filtro só, no vocabulário do AD, encontraria zero objetos ali — e o login
       continuaria funcionando, porque o bind não depende da busca. Perfil e
       grupos é que nunca chegariam: falha silenciosa. */
    const texto = pessoaPorIdentificador("ana", "openldap").toString("latin1");
    assert.ok(!texto.includes("sAMAccountName"));
    assert.ok(texto.includes("uid"));
    assert.ok(texto.includes("person"));
  });
});

describe("LDAP: SearchRequest", () => {
  test("os campos saem na ordem do RFC 4511", () => {
    /* O BER identifica campo por POSIÇÃO, não por nome: trocar `sizeLimit` com
       `timeLimit` produz uma mensagem que decodifica sem erro e pede outra
       coisa. */
    const bytes = searchRequest(7, {
      baseDn: "DC=empresa,DC=local",
      scope: SCOPE.SUBTREE,
      filter: equals("cn", "ana"),
      attributes: ["mail", "memberOf"],
      sizeLimit: 2,
      timeLimit: 30,
    });

    const envelope = decode(bytes)!;
    assert.equal(envelope.tag, TAG.SEQUENCE);

    const [id, op] = decodeAll(envelope.value);
    assert.equal(id!.tag, TAG.INTEGER);
    assert.equal(op!.tag, 0x63, "[APPLICATION 3] construído");

    const campos = decodeAll(op!.value);
    assert.equal(campos[0]!.value.toString("utf8"), "DC=empresa,DC=local");
    assert.equal(campos[1]!.value[0], SCOPE.SUBTREE);
    assert.equal(campos[2]!.value[0], 0, "neverDerefAliases");
    assert.equal(campos[3]!.value[0], 2, "sizeLimit");
    assert.equal(campos[4]!.value[0], 30, "timeLimit");
    assert.equal(campos[5]!.value[0], 0x00, "typesOnly falso");
    assert.equal(campos[6]!.tag, 0xa3, "o filtro");
    assert.equal(decodeAll(campos[7]!.value).length, 2, "dois atributos pedidos");
  });
});

describe("LDAP, leitura das respostas", () => {
  /* Uma mensagem completa: SEQUENCE { id 1, [APPLICATION 5] { enum 0, "", "" } }. */
  const UMA = Buffer.from([
    0x30, 0x0c, 0x02, 0x01, 0x01,
    0x65, 0x07, 0x0a, 0x01, 0x00, 0x04, 0x00, 0x04, 0x00,
  ]);

  test("uma mensagem cortada ao meio é incompleta, não erro", () => {
    /* O TCP entrega em pedaços. Tratar pedaço como falha derrubaria o login
       pelo tamanho de um pacote. */
    const meio = parseMessage(UMA.subarray(0, 6));
    assert.equal(meio.ok, false);
    assert.ok("incomplete" in meio);

    assert.equal(parseMessage(UMA).ok, true);
  });

  test("totalLength permite ler a próxima mensagem do mesmo pacote", () => {
    /* A busca é a primeira operação que responde com VÁRIAS mensagens, e o
       servidor pode empacotá-las juntas. */
    const duas = Buffer.concat([UMA, UMA]);

    const primeira = parseMessage(duas);
    assert.ok(primeira.ok);

    const segunda = parseMessage(duas, primeira.message.totalLength);
    assert.equal(segunda.ok, true);
  });

  test("o resultado traz o código e o diagnóstico, pulando o matchedDN", () => {
    const corpo = Buffer.from([
      0x0a, 0x01, 0x31,
      0x04, 0x00,
      0x04, 0x03, 0x6f, 0x69, 0x21,
    ]);
    const r = parseLdapResult(corpo)!;
    assert.equal(r.resultCode, 49);
    assert.equal(r.diagnostic, "oi!");
  });

  test("os nomes de atributo chegam em minúscula", () => {
    /* O servidor devolve com a grafia do esquema dele: `sAMAccountName` num,
       `samaccountname` noutro. Procurar pela grafia escrita no código
       funcionaria até o cliente cujo servidor escreve diferente. */
    const entrada = parseSearchEntry(decode(entradaDeTeste())!.value)!;

    assert.equal(entrada.dn, "CN=Ana Silva,OU=Pessoas,DC=empresa,DC=local");
    assert.equal(entrada.attributes.get("displayname")![0]!.toString("utf8"), "ANA SILVA");
    assert.equal(entrada.attributes.get("memberof")!.length, 2);
  });

  test("um atributo com vários valores não perde nenhum", () => {
    const entrada = parseSearchEntry(decode(entradaDeTeste())!.value)!;
    const grupos = entrada.attributes.get("memberof")!.map((v) => v.toString("utf8"));
    assert.ok(grupos[0]!.includes("LMS_Admin"));
    assert.ok(grupos[1]!.includes("Todos"));
  });
});

describe("LDAP, o motivo que o Active Directory esconde no diagnóstico", () => {
  const diag = (code: string): string =>
    `80090308: LdapErr: DSID-0C0903A9, comment: AcceptSecurityContext error, data ${code}, v3839`;

  test("conta desabilitada e bloqueada dão a mesma saída para quem está na tela", () => {
    assert.equal(motivoDoBind(diag("533")), MOTIVO.BLOQUEADA);
    assert.equal(motivoDoBind(diag("775")), MOTIVO.BLOQUEADA);
  });

  test("senha vencida é separada, quem resolve é a própria pessoa", () => {
    assert.equal(motivoDoBind(diag("532")), MOTIVO.SENHA_VENCIDA);
    assert.equal(motivoDoBind(diag("773")), MOTIVO.SENHA_VENCIDA);
  });

  test("conta inexistente e senha errada são indistinguíveis", () => {
    /* Separar as duas entrega a lista de quem trabalha na empresa a quem
       estiver sondando. */
    assert.equal(motivoDoBind(diag("525")), MOTIVO.CREDENCIAL);
    assert.equal(motivoDoBind(diag("52e")), MOTIVO.CREDENCIAL);
    assert.equal(
      mensagemDoMotivo(motivoDoBind(diag("525"))),
      mensagemDoMotivo(motivoDoBind(diag("52e"))),
    );
  });

  test("servidor que não é AD cai no motivo genérico", () => {
    assert.equal(motivoDoBind("invalid credentials"), MOTIVO.CREDENCIAL);
    assert.equal(motivoDoBind(""), MOTIVO.CREDENCIAL);
  });

  test("o código cru nunca chega à mensagem", () => {
    /* `data 533` diz a quem ataca que a conta existe e está desabilitada. */
    for (const code of ["533", "775", "532", "525", "52e"]) {
      const msg = mensagemDoMotivo(motivoDoBind(diag(code)));
      assert.ok(!msg.includes(code), `"${code}" vazou para a tela`);
      assert.ok(!/data |LdapErr|DSID/.test(msg));
    }
  });
});
