import {
  gruposDe,
  guidToString,
  texto,
  textos,
} from "@nerdlms/core/ldap/attributes.ts";
import { buildBindDn, type DirectoryKind } from "@nerdlms/core/ldap/directory.ts";
import { pessoaPorIdentificador } from "@nerdlms/core/ldap/filter.ts";
import { resolverPapel, type Role } from "@nerdlms/core/ldap/mapping.ts";
import {
  MOTIVO,
  mensagemDoMotivo,
  SCOPE,
  type SearchEntry,
} from "@nerdlms/core/ldap/protocol.ts";
import { decideLink } from "@nerdlms/core/sso/linking.ts";

import { recordAudit } from "../audit/audit-repository.ts";
import { createSession, recentFailures, recordLoginAttempt } from "../auth/sessions-repository.ts";
import { touchLastAccess } from "../auth/users-repository.ts";
import { abrir } from "../crypto/secret-box.ts";
import {
  createSsoUser,
  findAccountByEmail,
  findIdentity,
  linkIdentity,
  touchIdentityLogin,
} from "../sso/sso-repository.ts";
import { conectar, type Sessao } from "./ldap-client.ts";
import {
  currentRoleAndProject,
  type LdapDirectory,
  directoryById,
  groupRoles,
  syncFromDirectory,
} from "./ldap-repository.ts";

/**
 * Login pelo diretório da empresa.
 *
 * Diferente do OIDC em uma coisa que muda tudo: a SENHA PASSA POR AQUI. No OIDC
 * a pessoa digita no provedor e nós nunca a vemos; no LDAP ela chega ao nosso
 * servidor e é repassada ao diretório.
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
 * A ORDEM DAS OPERAÇÕES, E POR QUE ELA É ESSA
 *
 *   1. Autentica (bind com a senha de quem está entrando).
 *   2. Só então busca quem é essa pessoa.
 *
 * Nunca o contrário. Buscar antes seria responder perguntas sobre o diretório a
 * quem ainda não provou nada — e é o que abre a porta de sondagem: mande
 * `ana`, `bruno`, `carlos` e descubra quem trabalha na empresa sem nunca
 * acertar uma senha. O SCE faz uma busca prévia com conta de serviço para
 * distinguir conta bloqueada de senha errada; aqui essa distinção vem do
 * próprio bind, que já a carrega e a carrega mais exata.
 */

/** Acima disto, o IP espera. O mesmo teto do login por senha. */
const MAX_FAILURES_PER_IP = 10;

/**
 * O que se pergunta ao diretório sobre a pessoa.
 *
 * Lista fechada, e curta de propósito: cada atributo aqui é um dado pessoal que
 * passa a trafegar e a ser gravado. `postOfficeBox` (centro de custo), que o SCE
 * traz, fica de fora — nenhuma tela deste produto o mostra, e coletar dado sem
 * consumidor é criar exposição sem uso.
 *
 * `title` (o cargo) ficava de fora pela mesma razão, e passou a entrar quando a
 * razão deixou de valer: a matriz de treinamento recorta trilha por FUNÇÃO, e a
 * função é ele. Sem o atributo, a matriz teria uma dimensão só.
 *
 * `userAccountControl` também saiu: ele diria se a conta está desabilitada, e
 * conta desabilitada NÃO CONSEGUE fazer o bind — a pergunta já foi respondida
 * antes de a busca acontecer. `distinguishedName` idem: o DN do objeto vem no
 * cabeçalho da resposta, não como atributo.
 */
const ATRIBUTOS = [
  "displayName",
  "mail",
  "sAMAccountName",
  "title",
  "department",
  /* `department` é o nome no Active Directory. O esquema padrão do LDAP
     (`inetOrgPerson`, RFC 2798) não tem esse atributo e usa `departmentNumber`
     — pedir só o primeiro deixava a área em branco em qualquer diretório que
     não fosse AD, sem nada indicando por quê. Pedir os dois custa zero: o
     servidor devolve o que tiver. */
  "departmentNumber",
  "memberOf",
  "objectGUID",
];

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
  | { status: 400 | 401 | 403 | 429 | 502; error: string };

/** O que a busca contou sobre quem entrou. */
interface Perfil {
  /** `objectGUID` como texto. O identificador estável — quando existe. */
  guid: string | null;
  dn: string;
  fullName: string | null;
  email: string | null;
  conta: string | null;
  project: string | null;
  jobTitle: string | null;
  grupos: string[];
}

export async function ldapLoginUseCase(
  command: LdapLoginCommand,
): Promise<LdapLoginOutcome> {
  if (!command.usuario.trim() || !command.senha) {
    return { status: 400, error: "Informe usuário e senha." };
  }

  /* Byte nulo e caractere de controle são recusados ANTES de tocar em qualquer
     coisa.

     O `login_attempts` grava o nome de quem tentou, e o Postgres recusa texto
     com nulo — a rota devolvia 500 em vez de "usuário inválido", o que
     transforma uma tentativa malformada num erro de servidor. Foi o que o teste
     pela API encontrou.

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

  const conexao = await conectar({
    host: diretorio.host,
    port: diretorio.port,
    allowSelfSigned: diretorio.allowSelfSigned,
  });

  if (!conexao.ok) {
    /* Diretório fora do ar não é senha errada. Contar como tentativa faria uma
       queda do servidor bloquear o IP de quem tentou — e essas pessoas voltam
       assim que ele volta. */
    return { status: 502, error: conexao.error };
  }

  try {
    return await comSessao(command, diretorio, dn.dn, conexao.sessao);
  } finally {
    /* Fecha sempre. Um retorno por qualquer um dos caminhos acima deixaria o
       socket aberto até o tempo limite, e são dez segundos de conexão presa no
       diretório por login que falhou. */
    conexao.sessao.close();
  }
}

async function comSessao(
  command: LdapLoginCommand,
  diretorio: LdapDirectory,
  dn: string,
  sessao: Sessao,
): Promise<LdapLoginOutcome> {
  const autenticacao = await sessao.bind(dn, command.senha);

  await recordLoginAttempt(command.usuario, command.ip, autenticacao.ok);

  if (!autenticacao.ok) {
    await recordAudit({
      actorId: null,
      tenantId: command.tenantId,
      actorName: command.usuario,
      action: "sso_login_failed",
      /* O DN vai para a auditoria, a senha não. O DN diz contra qual objeto o
         bind foi tentado — útil para investigar, e não é segredo. */
      target: `ldap:${diretorio.kind}`,
      outcome: "denied",
      ip: command.ip,
    });

    /* Quando o Active Directory disse o motivo real no diagnóstico, ele vale
       mais que a mensagem genérica: quem tem a conta bloqueada e recebe
       "usuário ou senha inválidos" tenta de novo, esgota a política e liga para
       o suporte descrevendo o problema errado. */
    const mensagem = autenticacao.motivo && autenticacao.motivo !== MOTIVO.CREDENCIAL
      ? mensagemDoMotivo(autenticacao.motivo)
      : autenticacao.error;

    return { status: 401, error: mensagem };
  }

  const perfil = await buscarPerfil(command, diretorio, dn, sessao);

  return concluirLogin(command, diretorio, dn, perfil);
}

/**
 * Quem é esta pessoa, segundo o diretório.
 *
 * Devolve o mínimo — DN e nada mais — quando a busca não acontece ou não acha.
 * A BUSCA NÃO PODE DERRUBAR O LOGIN: o bind já provou que a senha está certa, e
 * recusar depois disso por causa de uma leitura que falhou transformaria um
 * problema de permissão de leitura no diretório em "não consigo entrar", sem
 * ninguém entender por quê. O que se perde é a sincronização daquele acesso.
 *
 * A exceção está em `concluirLogin`: quando o cliente EXIGE grupo, não saber os
 * grupos é motivo para recusar — aí a leitura deixou de ser enfeite.
 */
async function buscarPerfil(
  command: LdapLoginCommand,
  diretorio: LdapDirectory,
  dn: string,
  sessao: Sessao,
): Promise<Perfil> {
  const minimo: Perfil = {
    guid: null,
    dn,
    fullName: null,
    email: null,
    conta: null,
    project: null,
    jobTitle: null,
    grupos: [],
  };

  if (!diretorio.searchBase) return minimo;

  /* A conta de serviço, quando existe, REFAZ o vínculo desta mesma conexão.
     É por isso que ela é opcional: sem ela a busca sai com a credencial da
     própria pessoa, que na maioria dos diretórios já pode ler a árvore. Ela só
     é necessária onde a leitura é fechada. */
  if (diretorio.serviceDn && diretorio.servicePasswordEncrypted) {
    const senha = abrir(diretorio.servicePasswordEncrypted, "ldap-service");

    if (!senha.ok) {
      console.error("[ldap] conta de serviço ilegível:", senha.erro);
      return minimo;
    }

    const servico = await sessao.bind(diretorio.serviceDn, senha.segredo);
    if (!servico.ok) {
      console.error("[ldap] conta de serviço recusada pelo diretório:", servico.error);
      return minimo;
    }
  }

  const busca = await sessao.search({
    baseDn: diretorio.searchBase,
    scope: SCOPE.SUBTREE,
    filter: pessoaPorIdentificador(command.usuario.trim(), diretorio.kind as DirectoryKind),
    attributes: ATRIBUTOS,
    /* Dois, para DETECTAR ambiguidade — não para escolher entre eles. */
    sizeLimit: 2,
    timeLimit: 30,
  });

  if (!busca.ok) {
    console.warn("[ldap] busca de perfil falhou:", busca.error);
    return minimo;
  }

  if (busca.entries.length !== 1) {
    /* Zero: o bind funcionou e a busca não achou — acontece quando a base
       aponta para o galho errado da árvore.

       Dois ou mais: o identificador casou com mais de uma conta. Escolher uma
       seria sortear de quem são os grupos que decidem o papel, e a chance de
       acertar não é o ponto — a de errar é. */
    console.warn(
      `[ldap] busca por perfil devolveu ${busca.entries.length} objetos; sincronização ignorada`,
    );
    return minimo;
  }

  return lerPerfil(busca.entries[0]!, dn);
}

function lerPerfil(entrada: SearchEntry, dnDoBind: string): Perfil {
  const attrs = entrada.attributes;
  const guidBytes = attrs.get("objectguid")?.[0];

  return {
    guid: guidBytes ? guidToString(guidBytes) : null,
    /* O DN que a BUSCA devolveu, não o que o molde montou: no Active Directory
       o bind aceita `ana@empresa.local`, que não é o DN do objeto. O da busca é
       o de verdade. */
    dn: entrada.dn || dnDoBind,
    fullName: texto(attrs, "displayName"),
    email: texto(attrs, "mail")?.toLowerCase() ?? null,
    conta: texto(attrs, "sAMAccountName")?.toLowerCase() ?? null,
    /* A área da pessoa, que é o que este produto chama de projeto — a mesma
       coluna que os relatórios agrupam e que delimita o que um gestor enxerga.
       `department` primeiro porque é o do AD, que é o caso real; o outro cobre
       diretório de esquema padrão. */
    project: texto(attrs, "department") ?? texto(attrs, "departmentNumber"),
    /* A função, que é a outra dimensão da matriz de treinamento. `title` é o
       nome no AD e também no esquema padrão do LDAP, então um atributo basta. */
    jobTitle: texto(attrs, "title"),
    grupos: gruposDe(textos(attrs, "memberOf")),
  };
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
  diretorio: LdapDirectory,
  dnDoBind: string,
  perfil: Perfil,
): Promise<LdapLoginOutcome> {
  const email = perfil.email ?? emailDe(command.usuario, diretorio.domain);

  if (diretorio.allowedDomains.length > 0) {
    const dominio = email.split("@")[1] ?? "";
    if (!diretorio.allowedDomains.includes(dominio)) {
      return { status: 403, error: "Este usuário não pertence a um domínio autorizado." };
    }
  }

  const mapeamentos = await groupRoles(diretorio.id);

  /* Exigir grupo e não ter conseguido ler os grupos é recusa, não liberação.
     Sem isto, uma falha de leitura no diretório viraria a porta de entrada de
     quem o mapeamento existe para deixar de fora — e a falha é justamente o
     estado que ninguém está olhando. */
  if (diretorio.requireGroup && mapeamentos.length > 0 && perfil.grupos.length === 0) {
    await recordAudit({
      actorId: null,
      tenantId: command.tenantId,
      actorName: email,
      action: "sso_login_failed",
      target: `ldap:${diretorio.kind} (grupos não lidos)`,
      outcome: "denied",
      ip: command.ip,
    });

    return {
      status: 403,
      error: "Sua conta da rede não tem acesso liberado a esta plataforma. Procure o suporte de TI.",
    };
  }

  const papel = resolverPapel({
    grupos: perfil.grupos,
    mapeamentos,
    padrao: diretorio.jitRole as Role,
    exigirGrupo: diretorio.requireGroup,
  });

  if (!papel.ok) {
    await recordAudit({
      actorId: null,
      tenantId: command.tenantId,
      actorName: email,
      action: "sso_login_failed",
      target: `ldap:${diretorio.kind} (sem grupo mapeado)`,
      outcome: "denied",
      ip: command.ip,
    });

    return { status: 403, error: papel.motivo };
  }

  /* O `subject` é o `objectGUID` quando o diretório o forneceu.

     É o identificador que o Active Directory promete não reaproveitar nem
     mudar: quem troca de sobrenome muda de DN — a conta MUDA DE LUGAR na
     árvore — e continua a mesma pessoa. O DN fica como reserva para diretório
     que não devolve GUID, e para quando a busca não aconteceu.

     A CONSEQUÊNCIA para quem já entrou por LDAP antes desta mudança: o vínculo
     dela está gravado pelo DN e não será encontrado pelo GUID. Ela cai no
     segundo caso do `decideLink` — mesmo e-mail, sem vínculo —, que vincula e
     entra. Ou seja: reconecta sozinha no primeiro acesso, e o vínculo antigo
     fica órfão sem atrapalhar. Nenhuma migração de dados é necessária, e é por
     isso que a troca pode acontecer sem janela. */
  const subject = perfil.guid ?? perfil.dn ?? dnDoBind;
  const provider = `ldap:${diretorio.kind}`;

  const decisao = decideLink({
    provider,
    subject,
    email,
    fullName: perfil.fullName,
    linked: await findIdentity(command.tenantId, provider, subject),
    byEmail: await findAccountByEmail(command.tenantId, email),
    allowJit: diretorio.allowJit,
    jitRole: papel.role,
  });

  let userId: string;

  switch (decisao.kind) {
    case "login":
      await touchIdentityLogin(command.tenantId, provider, subject);
      userId = decisao.userId;
      break;

    case "link-and-login":
      await linkIdentity(command.tenantId, decisao.userId, provider, subject, email);
      await recordAudit({
        actorId: decisao.userId,
        actorName: email,
        action: "sso_identity_linked",
        target: provider,
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
      await linkIdentity(command.tenantId, novo, provider, subject, email);
      await recordAudit({
        actorId: novo,
        actorName: email,
        action: "sso_identity_linked",
        target: `${provider} (conta criada pelo diretório)`,
        outcome: "allowed",
        ip: command.ip,
      });
      userId = novo;
      break;
    }

    case "refuse":
      return { status: 403, error: decisao.reason };
  }

  await sincronizar(command, diretorio, userId, perfil, papel, mapeamentos.length > 0, email);

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
    target: provider,
    outcome: "allowed",
    ip: command.ip,
  });

  return { status: 200, token: sessao.token, expiresAt: sessao.expiresAt, userId };
}

/**
 * Traz para o cadastro o que o diretório disse, e registra o que MUDOU.
 *
 * A mudança de papel vai para a auditoria porque ela acontece sem ninguém
 * clicar em nada: alguém entra num grupo do Active Directory e vira
 * administrador aqui, ou sai e deixa de ser. Uma alteração de permissão sem
 * rastro é a que ninguém consegue explicar seis meses depois.
 */
async function sincronizar(
  command: LdapLoginCommand,
  diretorio: LdapDirectory,
  userId: string,
  perfil: Perfil,
  papel: { role: Role; via: string | null },
  temMapeamento: boolean,
  email: string,
): Promise<void> {
  if (!diretorio.syncProfile && !temMapeamento) return;

  const atual = await currentRoleAndProject(userId);
  const project = perfil.project?.trim() || null;
  const jobTitle = perfil.jobTitle?.trim() || null;

  /* Sem mapeamento configurado, o diretório não opina sobre papel — e escrever
     o padrão por cima rebaixaria todo mundo que tem papel definido aqui. */
  let novoPapel: Role | null = temMapeamento ? papel.role : null;

  /* Gestor precisa de área: a restrição `users_manager_needs_project` existe
     porque gestor sem recorte enxergaria tudo ou nada, e as duas são erradas
     (DEC-038). Um grupo do AD que promova a gestor alguém sem `department`
     preenchido violaria a restrição e o login viraria erro 500 — o que não
     explicaria nada a ninguém. Aqui a promoção simplesmente não acontece, e
     fica escrita na auditoria. */
  const areaConhecida = project ?? atual?.project ?? null;

  if (novoPapel === "manager" && !areaConhecida) {
    await recordAudit({
      actorId: userId,
      actorName: email,
      action: "access_denied",
      target: `ldap:${diretorio.kind}, grupo ${papel.via ?? "?"} pede gestor, mas a conta não tem área no diretório`,
      outcome: "denied",
      ip: command.ip,
    });

    novoPapel = null;
  }

  await syncFromDirectory({
    userId,
    fullName: diretorio.syncProfile ? perfil.fullName : null,
    /* O e-mail NÃO é sincronizado: ele é a chave por onde `decideLink` acha a
       conta, e trocá-lo aqui mudaria a identidade da pessoa a partir de um
       campo que qualquer administrador do diretório edita. Quem muda de
       endereço no AD passa a ter dois caminhos até a mesma conta — o vínculo
       pelo GUID continua valendo. */
    email: null,
    project: diretorio.syncProfile ? project : null,
    /* A função segue a mesma regra da área: o diretório manda no que ele
       preenche, e um `title` em branco no AD significa "não sei", não "apague a
       função que alguém pôs aqui". O `COALESCE` de `syncFromDirectory` é quem
       garante isso. */
    jobTitle: diretorio.syncProfile ? jobTitle : null,
    role: novoPapel,
  });

  if (novoPapel && atual && atual.role !== novoPapel) {
    await recordAudit({
      actorId: userId,
      actorName: email,
      action: "role_changed",
      target: `ldap:${diretorio.kind}, ${atual.role} → ${novoPapel} (grupo ${papel.via ?? "padrão do diretório"})`,
      outcome: "allowed",
      ip: command.ip,
    });
  }
}

/**
 * O e-mail de quem entrou, quando a busca não o trouxe.
 *
 * Com a busca funcionando, o `mail` do diretório é a fonte. Sem ela — diretório
 * sem base configurada, leitura negada, objeto não encontrado — o endereço é
 * DEDUZIDO: quem digita `ana@acme.com.br` já informou; quem digita `ana` num
 * Active Directory recebe o domínio configurado.
 *
 * Sem domínio e sem arroba, o próprio nome vira o identificador. Não é um
 * e-mail válido, e é assumido: serve para distinguir uma pessoa da outra numa
 * instalação OpenLDAP que não usa e-mail como login.
 */
function emailDe(usuario: string, domain: string | null): string {
  const limpo = usuario.trim().toLowerCase();

  if (limpo.includes("@")) return limpo;
  if (domain) return `${limpo}@${domain.trim().toLowerCase()}`;

  return limpo;
}
