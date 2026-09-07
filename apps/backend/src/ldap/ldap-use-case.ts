import { buildBindDn } from "@nerdlms/core/ldap/directory.ts";
import { decideLink } from "@nerdlms/core/sso/linking.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import { createSession, recentFailures, recordLoginAttempt } from "../auth/sessions-repository.ts";
import { touchLastAccess } from "../auth/users-repository.ts";
import {
  createSsoUser,
  findAccountByEmail,
  findIdentity,
  linkIdentity,
  touchIdentityLogin,
} from "../sso/sso-repository.ts";
import { bind } from "./ldap-client.ts";
import { directoryById } from "./ldap-repository.ts";

/**
 * Login por diretório LDAP.
 *
 * Diferente do OIDC em uma coisa que muda tudo: a SENHA PASSA POR AQUI. No
 * OIDC a pessoa digita no provedor e nós nunca a vemos; no LDAP ela chega ao
 * nosso servidor e é repassada ao diretório.
 *
 * As consequências, e o que cada uma exige:
 *
 *   A senha NUNCA é gravada — nem em log, nem em auditoria, nem em cache. Ela
 *   existe como argumento de função e some quando a função retorna.
 *
 *   O bloqueio por tentativa VALE aqui, ao contrário do OIDC. Como a senha
 *   chega até nós, este endereço é um oráculo de senhas do diretório
 *   corporativo — e sem limite, alguém o usaria para descobrir senhas da
 *   empresa inteira sem tocar no servidor dela.
 *
 * O vínculo de conta é o MESMO do OIDC (`decideLink`): quem entra por LDAP e
 * quem entra pelo Google chegam à mesma conta se forem a mesma pessoa, e a
 * regra de conta desativada vale igual.
 */

/** Acima disto, o IP espera. O mesmo teto do login por senha. */
const MAX_FAILURES_PER_IP = 10;

export interface LdapLoginCommand {
  tenantId: string;
  directoryId: string;
  /** O que a pessoa digitou. Vira DN pelo molde do diretório. */
  usuario: string;
  senha: string;
  ip: string;
  userAgent: string | null;
}

export type LdapLoginOutcome =
  | { status: 200; token: string; expiresAt: Date; userId: string }
  | { status: 400 | 401 | 403 | 429; error: string };

export async function ldapLoginUseCase(
  command: LdapLoginCommand,
): Promise<LdapLoginOutcome> {
  if (!command.usuario.trim() || !command.senha) {
    return { status: 400, error: "Informe usuário e senha." };
  }

  /* Byte nulo e caractere de controle são recusados ANTES de tocar em
     qualquer coisa.

     O `login_attempts` grava o nome de quem tentou, e o Postgres recusa texto
     com nulo — a rota devolvia 500 em vez de "usuário inválido", o que
     transforma uma tentativa malformada num erro de servidor. Foi o que o
     teste pela API encontrou.

     A mensagem é a mesma da senha errada: dizer "caractere inválido"
     confirmaria que o campo chega até o diretório. */
  if (/[\u0000-\u001f]/.test(command.usuario)) {
    return { status: 401, error: "Usuário ou senha inválidos." };
  }

  /* O bloqueio vem ANTES de qualquer ida ao diretório: o ponto é não deixar
     este endereço virar um oráculo de senhas da empresa. */
  if ((await recentFailures(command.ip)) >= MAX_FAILURES_PER_IP) {
    return { status: 429, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const diretorio = await directoryById(command.tenantId, command.directoryId);
  if (!diretorio || !diretorio.enabled) {
    return { status: 403, error: "Diretório não encontrado." };
  }

  const dn = buildBindDn({
    template: diretorio.dnTemplate,
    user: command.usuario,
    domain: diretorio.domain,
    base: diretorio.baseDn,
  });

  if (!dn.ok) {
    /* Conta como tentativa: um nome com caractere proibido é exatamente o que
       alguém sondando o formato do DN mandaria, e sem contar ele teria
       tentativas ilimitadas para descobrir. */
    await recordLoginAttempt(command.usuario, command.ip, false);
    return { status: 401, error: dn.error };
  }

  const resultado = await bind({
    host: diretorio.host,
    port: diretorio.port,
    dn: dn.dn,
    senha: command.senha,
    allowSelfSigned: diretorio.allowSelfSigned,
  });

  await recordLoginAttempt(command.usuario, command.ip, resultado.ok);

  if (!resultado.ok) {
    await recordAudit({
      actorId: null,
      actorName: command.usuario,
      action: "sso_login_failed",
      /* O DN vai para a auditoria, a senha não. O DN diz contra qual objeto o
         bind foi tentado — útil para investigar, e não é segredo. */
      target: `ldap:${diretorio.kind}`,
      outcome: "denied",
      ip: command.ip,
    });

    return { status: 401, error: resultado.error };
  }

  return concluirLogin(command, diretorio, dn.dn);
}

/**
 * O diretório aceitou. Agora: quem é esta pessoa aqui dentro?
 *
 * A mesma decisão do OIDC, e de propósito — `decideLink` é a única regra que
 * decide se alguém entra numa conta existente, ganha uma nova ou é recusado.
 * Duas cópias divergiriam, e a que ficasse para trás daria acesso onde a outra
 * negaria.
 */
async function concluirLogin(
  command: LdapLoginCommand,
  diretorio: Awaited<ReturnType<typeof directoryById>>,
  dn: string,
): Promise<LdapLoginOutcome> {
  if (!diretorio) return { status: 403, error: "Diretório não encontrado." };

  const email = emailDe(command.usuario, diretorio.domain);

  if (diretorio.allowedDomains.length > 0) {
    const dominio = email.split("@")[1] ?? "";
    if (!diretorio.allowedDomains.includes(dominio)) {
      return { status: 403, error: "Este usuário não pertence a um domínio autorizado." };
    }
  }

  /* O `subject` do LDAP é o DN: é o que o diretório tem de mais estável para
     identificar um objeto. O nome de login muda quando alguém troca de
     sobrenome; o DN de uma conta, não. */
  const decisao = decideLink({
    provider: `ldap:${diretorio.kind}`,
    subject: dn,
    email,
    fullName: null,
    linked: await findIdentity(command.tenantId, `ldap:${diretorio.kind}`, dn),
    byEmail: await findAccountByEmail(command.tenantId, email),
    allowJit: diretorio.allowJit,
    jitRole: diretorio.jitRole,
  });

  let userId: string;

  switch (decisao.kind) {
    case "login":
      await touchIdentityLogin(command.tenantId, `ldap:${diretorio.kind}`, dn);
      userId = decisao.userId;
      break;

    case "link-and-login":
      await linkIdentity(command.tenantId, decisao.userId, `ldap:${diretorio.kind}`, dn, email);
      await recordAudit({
        actorId: decisao.userId,
        actorName: email,
        action: "sso_identity_linked",
        target: `ldap:${diretorio.kind}`,
        outcome: "allowed",
        ip: command.ip,
      });
      userId = decisao.userId;
      break;

    case "create": {
      const novo = await createSsoUser(
        command.tenantId,
        decisao.email,
        decisao.fullName,
        decisao.role,
      );
      await linkIdentity(command.tenantId, novo, `ldap:${diretorio.kind}`, dn, email);
      await recordAudit({
        actorId: novo,
        actorName: email,
        action: "sso_identity_linked",
        target: `ldap:${diretorio.kind} (conta criada pelo diretório)`,
        outcome: "allowed",
        ip: command.ip,
      });
      userId = novo;
      break;
    }

    case "refuse":
      return { status: 403, error: decisao.reason };
  }

  const sessao = await createSession(userId, {
    remember: false,
    userAgent: command.userAgent,
    ip: command.ip,
  });
  await touchLastAccess(userId);

  await recordAudit({
    actorId: userId,
    actorName: email,
    action: "login",
    target: `ldap:${diretorio.kind}`,
    outcome: "allowed",
    ip: command.ip,
  });

  return { status: 200, token: sessao.token, expiresAt: sessao.expiresAt, userId };
}

/**
 * O e-mail de quem entrou.
 *
 * O diretório não devolve nada além de "sim" no bind simples — não há busca. O
 * e-mail é DEDUZIDO: quem digita `ana@acme.com.br` já informou; quem digita
 * `ana` num Active Directory recebe o domínio configurado.
 *
 * Sem domínio e sem arroba, o próprio nome vira o identificador. Não é um
 * e-mail válido, e é assumido: serve para distinguir uma pessoa da outra numa
 * instalação OpenLDAP que não usa e-mail como login. Quem quiser o e-mail de
 * verdade preenche o cadastro depois.
 */
function emailDe(usuario: string, domain: string | null): string {
  const limpo = usuario.trim().toLowerCase();

  if (limpo.includes("@")) return limpo;
  if (domain) return `${limpo}@${domain.trim().toLowerCase()}`;

  return limpo;
}
