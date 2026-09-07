import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildBindDn, directoryPreset, escapeDnValue } from "./directory.ts";

describe("LDAP — diretórios pré-configurados", () => {
  test("o Active Directory usa o formato de login das pessoas", () => {
    /* É a única forma que funciona sem saber em qual OU a conta mora — e isso
       muda por empresa, às vezes por departamento. */
    const p = directoryPreset("ad")!;
    assert.equal(p.dnTemplate, "{user}@{domain}");
    assert.equal(p.requires, "domain");
  });

  test("o OpenLDAP monta o DN a partir da base", () => {
    const p = directoryPreset("openldap")!;
    assert.match(p.dnTemplate, /uid={user}/);
    assert.equal(p.requires, "base");
  });

  test("o genérico não inventa molde", () => {
    assert.equal(directoryPreset("generico")!.dnTemplate, "");
  });

  test("todos usam a porta com TLS", () => {
    /* 389 é a porta em claro. A senha do diretório corporativo não atravessa
       a rede legível. */
    for (const id of ["ad", "openldap", "generico"]) {
      assert.equal(directoryPreset(id)!.defaultPort, 636);
    }
  });

  test("diretório desconhecido não existe", () => {
    assert.equal(directoryPreset("kerberos"), undefined);
  });
});

describe("LDAP — o DN não aceita injeção", () => {
  test("vírgula e igual no nome são escapados", () => {
    /* Sem escapar, quem digitasse `ana,ou=admins` estaria descrevendo outro
       lugar da árvore em vez de informar um nome. */
    const r = buildBindDn({
      template: "uid={user},ou=people,{base}",
      user: "ana,ou=admins",
      base: "dc=acme,dc=com",
    });

    assert.equal(r.ok, true);
    assert.equal(r.ok && r.dn, "uid=ana\\,ou\\=admins,ou=people,dc=acme,dc=com");
  });

  test("byte nulo é RECUSADO, não escapado", () => {
    /* O nulo trunca a string em C, e boa parte dos servidores LDAP é escrita
       em C: o resto do DN sumiria e o bind aconteceria contra outro objeto. */
    const r = buildBindDn({ template: "{user}@{domain}", user: "ana\0x", domain: "acme.com" });
    assert.equal(r.ok, false);
  });

  test("curinga é recusado", () => {
    const r = buildBindDn({ template: "{user}@{domain}", user: "*", domain: "acme.com" });
    assert.equal(r.ok, false);
  });

  test("a recusa é sempre a mesma mensagem", () => {
    /* Dizer "caractere inválido" confirmaria ao atacante que o campo chega
       até o diretório. */
    const nulo = buildBindDn({ template: "{user}@{d}", user: "a\0b", domain: "x" });
    const curinga = buildBindDn({ template: "{user}@{d}", user: "*", domain: "x" });

    assert.equal(
      nulo.ok === false ? nulo.error : "",
      curinga.ok === false ? curinga.error : "-",
    );
  });

  test("nome normal atravessa sem alteração", () => {
    const r = buildBindDn({ template: "{user}@{domain}", user: "ana.souza", domain: "acme.com.br" });
    assert.equal(r.ok && r.dn, "ana.souza@acme.com.br");
  });
});

describe("LDAP — configuração pela metade", () => {
  test("marcador que sobrou é recusado", () => {
    /* `{domain}` sem domínio preenchido chegaria ao servidor como texto
       literal, e o erro apontaria para o diretório em vez da configuração. */
    const r = buildBindDn({ template: "{user}@{domain}", user: "ana", domain: "" });
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /pela metade/i);
  });

  test("molde sem {user} é recusado", () => {
    const r = buildBindDn({ template: "cn=fixo,dc=acme", user: "ana" });
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /marcador/i);
  });

  test("usuário vazio é recusado", () => {
    assert.equal(buildBindDn({ template: "{user}@x", user: "   " }).ok, false);
  });
});

describe("LDAP — escape de valor", () => {
  test("os caracteres do RFC 4514 são escapados", () => {
    assert.equal(escapeDnValue("a,b"), "a\\,b");
    assert.equal(escapeDnValue("a=b"), "a\\=b");
    assert.equal(escapeDnValue("a+b"), "a\\+b");
  });

  test("espaço no início e no fim é escapado; no meio, não", () => {
    /* No meio ele é parte legítima do nome. */
    assert.equal(escapeDnValue("ana souza"), "ana souza");
    assert.equal(escapeDnValue(" ana"), "\\ ana");
  });
});
