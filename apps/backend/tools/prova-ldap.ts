/**
 * Prova real do cliente LDAP contra um servidor de verdade.
 *
 * POR QUE ISTO NÃO É UM `*.test.ts`
 *
 * Os testes de unidade conferem o nosso codificador contra o NOSSO leitor. Um
 * erro simétrico — escrever o comprimento errado e lê-lo do mesmo jeito errado
 * — passa nos dois lados e só aparece quando um servidor de terceiro recusa a
 * mensagem. O BER foi escrito à mão aqui; essa é exatamente a categoria de
 * defeito que precisa de outra implementação para ser encontrada.
 *
 * Este arquivo precisa de um servidor no ar, então não entra no `npm test`, que
 * roda sem rede. Ele é o passo manual de quem mexer no protocolo.
 *
 * COMO RODAR
 *
 *   docker run -d --name nerdlms-ldap-teste -p 11636:636 \
 *     -e LDAP_ORGANISATION="Empresa Teste" -e LDAP_DOMAIN="empresa.local" \
 *     -e LDAP_ADMIN_PASSWORD="senha-de-teste-local" osixia/openldap:1.5.0
 *
 *   (semear com o LDIF descrito no fim deste arquivo)
 *
 *   node --experimental-strip-types tools/prova-ldap.ts
 */

import { equals, and, or, present } from "@nerdlms/core/ldap/filter.ts";
import { gruposDe } from "@nerdlms/core/ldap/attributes.ts";
import { SCOPE } from "@nerdlms/core/ldap/protocol.ts";

import { conectar } from "../src/ldap/ldap-client.ts";

const HOST = process.env.LDAP_HOST ?? "localhost";
const PORT = Number(process.env.LDAP_PORT ?? 11636);
const BASE = "dc=empresa,dc=local";

/* A conta que LÊ a árvore.

   Não é escolha de conveniência: o ACL padrão do OpenLDAP deixa uma pessoa
   comum ler o próprio objeto e mais nada. Ana autentica e não enxerga sequer o
   grupo de que faz parte — que é exatamente o diretório fechado para o qual a
   conta de serviço existe. Foi este servidor que provou que ela era necessária;
   antes disso era hipótese. */
const SERVICO = { dn: `cn=admin,${BASE}`, senha: "senha-de-teste-local" };

let falhas = 0;

function confere(condicao: boolean, descricao: string, detalhe = ""): void {
  if (condicao) {
    console.log(`  ok    ${descricao}`);
    return;
  }
  falhas += 1;
  console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
}

async function abrir() {
  const conexao = await conectar({
    host: HOST,
    port: PORT,
    /* O certificado do contêiner é da própria instalação — é justamente o caso
       que a opção existe para cobrir. */
    allowSelfSigned: true,
  });

  if (!conexao.ok) {
    console.error(`\nNão foi possível conectar em ${HOST}:${PORT} — ${conexao.error}`);
    console.error("O servidor de teste está no ar? Ver o cabeçalho deste arquivo.\n");
    process.exit(2);
  }

  return conexao.sessao;
}

console.log(`\nProva do cliente LDAP contra ${HOST}:${PORT}\n`);

/* --------------------------------------------------------------- 1. bind */
console.log("Autenticação");
{
  const sessao = await abrir();

  const certa = await sessao.bind("uid=ana.silva,ou=Pessoas," + BASE, "senha-da-ana");
  confere(certa.ok, "senha certa é aceita", certa.ok ? "" : certa.error);

  const errada = await sessao.bind("uid=ana.silva,ou=Pessoas," + BASE, "nao-e-essa");
  confere(!errada.ok, "senha errada é recusada");
  confere(
    !errada.ok && errada.error === "Usuário ou senha inválidos.",
    "a recusa não distingue senha errada de conta inexistente",
    !errada.ok ? errada.error : "",
  );

  const inexistente = await sessao.bind("uid=nao.existe,ou=Pessoas," + BASE, "x");
  confere(
    !inexistente.ok && !errada.ok && inexistente.error === errada.error,
    "conta inexistente dá a MESMA mensagem que senha errada",
  );

  sessao.close();
}

/* -------------------------------------------------------------- 2. busca */
console.log("\nBusca");
{
  const sessao = await abrir();

  /* A ordem do produto: autentica a PESSOA e só então refaz o vínculo com a
     conta de serviço para buscar. Nunca o contrário — buscar antes seria
     responder perguntas sobre o diretório a quem não provou nada. */
  const pessoa = await sessao.bind("uid=ana.silva,ou=Pessoas," + BASE, "senha-da-ana");
  confere(pessoa.ok, "a pessoa se autenticou antes da busca");

  const semPermissao = await sessao.search({
    baseDn: BASE,
    scope: SCOPE.SUBTREE,
    filter: equals("uid", "ana.silva"),
    attributes: ["cn"],
    sizeLimit: 2,
    timeLimit: 30,
  });
  /* Recusa OU zero resultados: o OpenLDAP devolve `noSuchObject` para uma base
     que a credencial não enxerga, e outros servidores devolvem sucesso com a
     lista vazia. Os dois querem dizer a mesma coisa aqui, e é por isso que
     `buscarPerfil` trata os dois do mesmo jeito — segue o login sem
     sincronizar, em vez de recusar quem já provou a senha. */
  confere(
    !semPermissao.ok || semPermissao.entries.length === 0,
    "com a credencial da própria pessoa este diretório não deixa ler nada — é o caso da conta de serviço",
    semPermissao.ok ? "" : semPermissao.error,
  );

  const servico = await sessao.bind(SERVICO.dn, SERVICO.senha);
  confere(servico.ok, "a conta de serviço refez o vínculo na MESMA conexão");

  const busca = await sessao.search({
    baseDn: BASE,
    scope: SCOPE.SUBTREE,
    /* O filtro que o produto usa é o do Active Directory
       (`objectCategory`/`sAMAccountName`), que o OpenLDAP não tem. Aqui
       interessa o FORMATO DA MENSAGEM, não os nomes dos atributos: se o
       servidor aceita esta árvore de filtro, aceita a outra. */
    filter: and(
      present("objectClass"),
      or(equals("uid", "ana.silva"), equals("mail", "ana.silva")),
    ),
    attributes: ["displayName", "mail", "cn", "departmentNumber"],
    sizeLimit: 2,
    timeLimit: 30,
  });

  confere(busca.ok, "o servidor ACEITOU o SearchRequest montado à mão", busca.ok ? "" : busca.error);

  if (busca.ok) {
    confere(busca.entries.length === 1, `achou exatamente uma pessoa (${busca.entries.length})`);

    const entrada = busca.entries[0];
    if (entrada) {
      const valor = (nome: string): string =>
        entrada.attributes.get(nome)?.[0]?.toString("utf8") ?? "";

      confere(
        entrada.dn === `uid=ana.silva,ou=Pessoas,${BASE}`,
        "o DN do objeto veio certo",
        entrada.dn,
      );
      confere(valor("displayname") === "ANA SILVA", "displayName lido", valor("displayname"));
      confere(valor("mail") === "ana.silva@empresa.local", "mail lido", valor("mail"));
      confere(
        valor("departmentnumber") === "Operacoes",
        "a área foi lida",
        valor("departmentnumber"),
      );
      confere(
        entrada.attributes.has("displayname"),
        "o nome do atributo chega em minúscula, como o código espera",
      );
    }
  }

  sessao.close();
}

/* ----------------------------------------- 3. atributo de vários valores */
console.log("\nGrupos (atributo com vários valores)");
{
  const sessao = await abrir();
  await sessao.bind(SERVICO.dn, SERVICO.senha);

  /* O OpenLDAP sem o overlay `memberof` não devolve `memberOf` na pessoa; a
     ligação está do lado do GRUPO, em `member`. O caminho de leitura é o mesmo
     — atributo de vários valores contendo DNs —, que é o que precisa ser
     provado aqui. A extração do CN é testada à parte, em `attributes.test.ts`. */
  const busca = await sessao.search({
    baseDn: `ou=Grupos,${BASE}`,
    scope: SCOPE.SUBTREE,
    filter: equals("member", `uid=ana.silva,ou=Pessoas,${BASE}`),
    attributes: ["cn"],
    sizeLimit: 10,
    timeLimit: 30,
  });

  confere(busca.ok, "busca por membro do grupo", busca.ok ? "" : busca.error);

  if (busca.ok) {
    const dns = busca.entries.map((e) => e.dn);
    confere(dns.length === 2, `a pessoa está em dois grupos (${dns.length})`);

    const nomes = gruposDe(dns);
    confere(nomes.includes("LMS_Admin"), "grupo simples reconhecido", nomes.join(" | "));
    confere(
      nomes.includes("Compras, Suprimentos"),
      "grupo com VÍRGULA ESCAPADA no nome reconhecido",
      nomes.join(" | "),
    );
  }

  sessao.close();
}

/* ----------------------------------- 4. o valor não vira parte do filtro */
console.log("\nInjeção de filtro");
{
  const sessao = await abrir();
  await sessao.bind(SERVICO.dn, SERVICO.senha);

  /* Montado por concatenação de texto, isto viraria
     `(uid=*)(objectClass=*)` e devolveria o diretório inteiro. Como árvore
     BER, é um uid literal que não existe. */
  const busca = await sessao.search({
    baseDn: BASE,
    scope: SCOPE.SUBTREE,
    filter: equals("uid", "*)(objectClass=*"),
    attributes: ["cn"],
    sizeLimit: 50,
    timeLimit: 30,
  });

  confere(busca.ok, "o servidor aceitou o filtro com o valor hostil");
  confere(
    busca.ok && busca.entries.length === 0,
    "e devolveu ZERO objetos — o valor não virou estrutura",
    busca.ok ? `devolveu ${busca.entries.length}` : "",
  );

  sessao.close();
}

console.log(
  falhas === 0
    ? "\nTudo certo: o servidor entende o que este cliente escreve.\n"
    : `\n${falhas} falha(s).\n`,
);

process.exit(falhas === 0 ? 0 : 1);
