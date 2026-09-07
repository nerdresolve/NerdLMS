/**
 * Diagnóstico de conectividade com um Active Directory real.
 *
 * SOMENTE LEITURA, e nem isso: a única operação que ele executa é um `bind`
 * com uma conta INEXISTENTE, para ver como o servidor recusa. Não busca, não
 * escreve, não toca em conta de ninguém.
 *
 * O usuário de teste é propositalmente absurdo. Tentar senha errada contra uma
 * conta REAL incrementa o `badPwdCount` do AD e pode travá-la pela política de
 * bloqueio do domínio — diagnosticar não pode custar o acesso de alguém.
 *
 *   node --experimental-strip-types tools/diag-ad.ts <host> [porta]
 */

import { connect as tlsConnect } from "node:tls";

import { conectar } from "../src/ldap/ldap-client.ts";

const host = process.argv[2];
const port = Number(process.argv[3] ?? 636);

if (!host) {
  console.error("uso: node --experimental-strip-types tools/diag-ad.ts <host> [porta]");
  process.exit(2);
}

/* ------------------------------------------------- 1. o certificado do DC */
console.log(`\nTLS em ${host}:${port}\n`);

const certificado = await new Promise<{ ok: boolean; detalhe: string }>((resolve) => {
  const socket = tlsConnect(
    { host, port, servername: host, rejectUnauthorized: true, timeout: 8000 },
    () => {
      const c = socket.getPeerCertificate();
      resolve({
        ok: true,
        detalhe: `emitido por: ${c.issuer?.CN ?? "?"} | para: ${c.subject?.CN ?? "?"}`,
      });
      socket.destroy();
    },
  );

  socket.on("error", (e: NodeJS.ErrnoException) => {
    resolve({ ok: false, detalhe: e.code ?? e.message });
    socket.destroy();
  });
  socket.on("timeout", () => {
    resolve({ ok: false, detalhe: "tempo esgotado" });
    socket.destroy();
  });
});

if (certificado.ok) {
  console.log(`  ok    o certificado passa na validação padrão`);
  console.log(`        ${certificado.detalhe}`);
  console.log(`        → "aceitar certificado da própria empresa" pode ficar DESMARCADO`);
} else {
  console.log(`  aviso a validação padrão recusou o certificado (${certificado.detalhe})`);
  console.log(`        → é o normal em AD corporativo: marque "aceitar certificado`);
  console.log(`          emitido pela própria empresa" na tela de administração`);
}

/* ------------------------------------------- 2. o servidor fala LDAP mesmo? */
const conexao = await conectar({ host, port, allowSelfSigned: true });

if (!conexao.ok) {
  console.log(`\n  FALHA não foi possível abrir a conversa: ${conexao.error}\n`);
  process.exit(1);
}

/* Conta que não existe, de propósito — ver o cabeçalho. */
const inexistente = `zz-nao-existe-${Date.now().toString(36)}@${host.split(".").slice(1).join(".")}`;
const recusa = await conexao.sessao.bind(inexistente, "senha-qualquer-invalida");

conexao.sessao.close();

console.log(`\nBind (conta inexistente, para ver COMO o servidor recusa)\n`);

if (recusa.ok) {
  console.log("  estranho: o servidor ACEITOU uma conta que não existe.");
} else {
  console.log(`  ok    o servidor respondeu em LDAP e recusou, como devia`);
  console.log(`        código ${recusa.codigo} · motivo interpretado: ${recusa.motivo}`);
  console.log(`        mensagem que a pessoa veria: "${recusa.error}"`);
}

console.log(
  "\nSe as duas linhas acima estão ok, o caminho até o diretório funciona:\n" +
    "o que falta é apontar a configuração para este servidor.\n",
);
