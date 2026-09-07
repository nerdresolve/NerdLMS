import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { estadoDaConta, grupoDoDn, gruposDe, guidToString, numero, somenteDigitos, texto, textos } from "./attributes.ts";
import { resolverPapel } from "./mapping.ts";

describe("LDAP, objectGUID", () => {
  test("a ordem dos bytes é a do Windows, não a da leitura direta", () => {
    /* Os três primeiros grupos do GUID são inteiros em little-endian; os dois
       últimos vão em ordem direta. Este é o valor que o `new Guid(byte[])` do
       .NET e o `Get-ADUser` do PowerShell produzem para os mesmos dezesseis
       bytes — e é o que a integração com qualquer outra ferramenta da empresa
       espera encontrar. Ler em ordem direta daria um identificador que só este
       sistema reconhece. */
    const bytes = Buffer.from([
      0x10, 0x8c, 0xa5, 0xc9, 0xdd, 0x5e, 0x8f, 0x4e,
      0xa3, 0x2a, 0x7a, 0x8c, 0x41, 0xa3, 0x5c, 0x3e,
    ]);

    assert.equal(guidToString(bytes), "c9a58c10-5edd-4e8f-a32a-7a8c41a35c3e");
  });

  test("byte com zero à esquerda não encolhe", () => {
    const bytes = Buffer.alloc(16);
    bytes[0] = 0x01;
    assert.equal(guidToString(bytes), "00000001-0000-0000-0000-000000000000");
  });

  test("tamanho diferente de dezesseis é recusado, não adivinhado", () => {
    assert.equal(guidToString(Buffer.alloc(15)), null);
    assert.equal(guidToString(Buffer.alloc(0)), null);
  });
});

describe("LDAP, grupos vindos do memberOf", () => {
  test("o nome sai do primeiro componente do caminho", () => {
    assert.equal(
      grupoDoDn("CN=Treinamento_Admin,OU=Grupos,DC=empresa,DC=local"),
      "Treinamento_Admin",
    );
  });

  test("vírgula escapada faz parte do nome", () => {
    /* Cortar no primeiro `=` e na primeira vírgula — a conta ingênua —
       devolveria `Compras\`, que não casa com mapeamento nenhum. O grupo
       existiria e ninguém receberia o papel dele. */
    assert.equal(
      grupoDoDn("CN=Compras\\, Suprimentos,OU=Grupos,DC=empresa,DC=local"),
      "Compras, Suprimentos",
    );
  });

  test("vírgula escapada em HEXADECIMAL também faz parte do nome", () => {
    /* O RFC 4514 tem duas formas de escape, e servidores diferentes escolhem
       formas diferentes: `\,` e `\2C` descrevem o mesmo caractere. Só a
       primeira era tratada, e o teste acima passava por usar justamente ela —
       foi um OpenLDAP de verdade que devolveu a segunda e mostrou que
       `Compras\2C Suprimentos` virava `Compras2C Suprimentos`, um nome que não
       casa com mapeamento nenhum. */
    assert.equal(
      grupoDoDn("cn=Compras\\2C Suprimentos,ou=Grupos,dc=empresa,dc=local"),
      "Compras, Suprimentos",
    );
    assert.equal(grupoDoDn("cn=A\\3DB,dc=x"), "A=B");
  });

  test("escape hexadecimal de vários bytes vira um caractere só", () => {
    /* `\C3\A7` é o "ç" em UTF-8. Decodificar cada byte sozinho daria dois
       caracteres inválidos no lugar de um — o nome do grupo deixaria de casar
       com o que quem configura digitou na tela. */
    assert.equal(grupoDoDn("cn=A\\C3\\A7\\C3\\A3o,dc=x"), "Ação");
  });

  test("barra invertida seguida de algo que não é hexadecimal continua literal", () => {
    assert.equal(grupoDoDn("cn=A\\ZZ,dc=x"), "AZZ");
  });

  test("um RDN composto para no `+`", () => {
    assert.equal(grupoDoDn("CN=Ana+OU=Vendas,DC=x"), "Ana");
  });

  test("componente que não é CN não vira grupo", () => {
    assert.equal(grupoDoDn("OU=Grupos,DC=empresa"), null);
    assert.equal(grupoDoDn("lixo"), null);
    assert.equal(grupoDoDn(""), null);
  });

  test("a grafia do CN não importa", () => {
    assert.equal(grupoDoDn("cn=Todos,DC=x"), "Todos");
  });

  test("a lista sai sem repetição e sem o que não deu para ler", () => {
    const nomes = gruposDe([
      "CN=A,DC=x",
      "CN=A,OU=Outra,DC=x",
      "OU=nada,DC=x",
      "CN=B,DC=x",
    ]);
    assert.deepEqual(nomes, ["A", "B"]);
  });
});

describe("LDAP, estado da conta e campos", () => {
  test("o bit 2 é conta desabilitada", () => {
    assert.equal(estadoDaConta(0x0202).desabilitada, true);
    assert.equal(estadoDaConta(0x0200).desabilitada, false);
  });

  test("o CPF fica só com dígitos, e o que não serve fica vazio", () => {
    assert.equal(somenteDigitos("123.456.789-09"), "12345678909");
    assert.equal(somenteDigitos("12345678909"), "12345678909");
    /* Menos de onze dígitos não é CPF truncado que valha guardar: guardá-lo
       faria uma comparação futura falhar sem dizer por quê. */
    assert.equal(somenteDigitos("123"), null);
    assert.equal(somenteDigitos(""), null);
    assert.equal(somenteDigitos(null), null);
  });

  test("a leitura de atributo ignora a grafia e devolve nulo no vazio", () => {
    const attrs = new Map<string, Buffer[]>([
      ["displayname", [Buffer.from("ANA SILVA")]],
      ["title", [Buffer.from("   ")]],
      ["useraccountcontrol", [Buffer.from("512")]],
      ["memberof", [Buffer.from("CN=A,DC=x"), Buffer.from("CN=B,DC=x")]],
    ]);

    assert.equal(texto(attrs, "displayName"), "ANA SILVA");
    /* Só espaço é o mesmo que não ter: o AD devolve campo em branco assim, e
       gravá-lo apagaria o valor que já estava no cadastro. */
    assert.equal(texto(attrs, "title"), null);
    assert.equal(texto(attrs, "department"), null);
    assert.equal(numero(attrs, "userAccountControl"), 512);
    assert.equal(numero(attrs, "lockoutTime"), null);
    assert.deepEqual(textos(attrs, "memberOf"), ["CN=A,DC=x", "CN=B,DC=x"]);
  });
});

describe("LDAP, papel a partir dos grupos", () => {
  const mapeamentos = [
    { groupCn: "LMS_Admin", role: "admin" as const },
    { groupCn: "LMS_Gestores", role: "manager" as const },
    { groupCn: "LMS_Instrutores", role: "instructor" as const },
  ];

  test("sem mapeamento nenhum, o diretório não opina sobre papel", () => {
    /* Tratar "nenhum mapeamento" como "nenhum grupo casou" recusaria todo
       mundo no dia em que o recurso fosse ligado sem ser preenchido. */
    const r = resolverPapel({ grupos: [], mapeamentos: [], padrao: "learner", exigirGrupo: true });
    assert.ok(r.ok);
    assert.equal(r.role, "learner");
  });

  test("em vários grupos, vale o maior", () => {
    /* Somar não é opção — aqui cada pessoa tem um papel. Escolher o menor faria
       quem ganhou um grupo a mais PERDER acesso. */
    const r = resolverPapel({
      grupos: ["LMS_Instrutores", "LMS_Admin", "Todos"],
      mapeamentos,
      padrao: "learner",
      exigirGrupo: false,
    });
    assert.ok(r.ok);
    assert.equal(r.role, "admin");
    assert.equal(r.via, "LMS_Admin");
  });

  test("sair do grupo tira o papel, é o lado que dá sentido ao outro", () => {
    const r = resolverPapel({
      grupos: ["Todos"],
      mapeamentos,
      padrao: "learner",
      exigirGrupo: false,
    });
    assert.ok(r.ok);
    assert.equal(r.role, "learner");
    assert.equal(r.via, null);
  });

  test("a grafia do grupo não precisa bater", () => {
    const r = resolverPapel({
      grupos: ["lms_admin"],
      mapeamentos,
      padrao: "learner",
      exigirGrupo: false,
    });
    assert.ok(r.ok);
    assert.equal(r.role, "admin");
  });

  test("exigindo grupo, quem não tem nenhum é recusado sem saber quais existem", () => {
    const r = resolverPapel({
      grupos: ["Todos"],
      mapeamentos,
      padrao: "learner",
      exigirGrupo: true,
    });
    assert.equal(r.ok, false);
    assert.ok(!r.ok);
    /* Recitar o nome dos grupos daria a quem sonda o mapa das permissões. */
    for (const m of mapeamentos) assert.ok(!r.motivo.includes(m.groupCn));
  });
});
