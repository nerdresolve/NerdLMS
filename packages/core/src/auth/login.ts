/**
 * Contrato e regra da autenticação.
 *
 * Fica no domínio, e não no app, por dois motivos: o contrato da API é decisão
 * de negócio (o que entra, o que sai, o que nunca sai), e assim a regra é
 * testável sem subir servidor nem banco.
 *
 * A separação segue o que o SCE API faz com `Models/DTOs`: o objeto que
 * atravessa a fronteira **não** é a linha do banco. `AccountRecord` é o que a
 * consulta devolve — inclui o hash da senha; `SessionUser` é o que a resposta
 * carrega — nunca inclui.
 */

import type { Role } from "./permissions.ts";
import { verifyPassword } from "./password.ts";

/** Entrada do POST /api/auth/login. */
export interface LoginRequest {
  identifier: string;
  password: string;
  remember?: boolean;
}

/**
 * O usuário como a sessão o enxerga.
 *
 * Repare no que **não** está aqui: `passwordHash`. O tipo é a garantia de que
 * um refactor distraído não devolve o hash para o cliente — o compilador
 * recusa.
 */
export interface SessionUser {
  id: string;
  /** Primeiro nome, para a saudação do painel. Derivado, não guardado. */
  firstName: string;
  fullName: string;
  email: string | null;
  role: Role;
  project: string | null;
  /**
   * A função da pessoa, que vem do `title` do diretório.
   *
   * Circula na sessão pelo mesmo motivo que `project`: é o recorte da trilha, e
   * a página do aluno precisa dele para saber o que mostrar sem uma segunda
   * viagem ao banco.
   */
  jobTitle: string | null;
  /**
   * O cliente a que esta pessoa pertence.
   *
   * Vem na mesma consulta da sessão, não numa viagem separada: toda página
   * precisa dele — para o recorte dos dados e para o vocabulário da tela — e
   * uma segunda consulta por requisição não se justifica.
   */
  tenant: TenantContext;
}

/**
 * O que a interface precisa saber sobre o cliente.
 *
 * `unitLabel` é o que impede a palavra "projeto" de ficar escrita no código:
 * a Exemplo S.A. chama suas unidades de "Campo", uma rede de varejo chamaria
 * de "Filial". O termo é dado do cliente, não vocabulário da plataforma.
 */
export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  unitLabel: string;
  /** Identidade visual. Campo nulo significa "usa o padrão do produto". */
  branding: {
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
    faviconUrl: string | null;
    brandColor: string | null;
  };
}

/**
 * O tenant com as funcionalidades já resolvidas.
 *
 * Separado de `TenantContext` porque o mapa só é carregado onde há sessão: a
 * landing e a recuperação de senha precisam do tenant, não do que ele ligou.
 */
export interface TenantWithFeatures extends TenantContext {
  /** Chave do catálogo → ligada. Herança já aplicada. */
  features: Record<string, boolean>;
}

/** Primeiro nome a partir do nome completo. O banco guarda só o completo. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** A linha de `users` que a autenticação precisa. Nunca sai desta camada. */
export interface AccountRecord extends SessionUser {
  passwordHash: string | null;
  status: "active" | "pending" | "inactive";
}

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: LoginFailure };

/**
 * Motivos de recusa.
 *
 * `invalid_credentials` cobre "não existe", "senha errada" e "sem senha
 * definida" de propósito: distinguir os três diria a um atacante quais e-mails
 * existem na base (, a mesma razão do 404 em vez de 403).
 *
 * `inactive_account` é separado porque não é ambíguo — quem foi desativado
 * precisa saber que o problema não é a senha.
 */
export type LoginFailure = "invalid_credentials" | "inactive_account";

export const LOGIN_FAILURE_MESSAGE: Record<LoginFailure, string> = {
  invalid_credentials: "Usuário ou senha inválidos.",
  inactive_account: "Esta conta está inativa. Fale com seu administrador.",
};

/** Descarta o hash e devolve só o que pode circular. */
export function toSessionUser(account: AccountRecord): SessionUser {
  return {
    id: account.id,
    firstName: firstNameOf(account.fullName),
    fullName: account.fullName,
    email: account.email,
    role: account.role,
    project: account.project,
    jobTitle: account.jobTitle,
    tenant: account.tenant,
  };
}

/**
 * Decide se as credenciais autenticam.
 *
 * Recebe a conta já carregada em vez de consultar: mantém a regra pura,
 * testável sem banco, e deixa a consulta com quem sabe consultar.
 *
 * Quando a conta não existe, `account` é `null` — e mesmo assim a função
 * verifica uma senha descartável. Sem isso, "usuário inexistente" responderia
 * na hora e "senha errada" demoraria o tempo do Argon2: a diferença de tempo
 * revelaria quais contas existem.
 */
export function authenticate(account: AccountRecord | null, password: string): LoginResult {
  if (!account || !account.passwordHash) {
    verifyPassword(password, HASH_DE_COMPARACAO);
    return { ok: false, reason: "invalid_credentials" };
  }

  if (!verifyPassword(password, account.passwordHash)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (account.status !== "active") {
    return { ok: false, reason: "inactive_account" };
  }

  return { ok: true, user: toSessionUser(account) };
}

/**
 * Hash descartável, só para gastar o mesmo tempo quando a conta não existe.
 *
 * PRECISA SER UM SCRYPT DE VERDADE, e este é o ponto.
 *
 * Era um Argon2id, e `verifyPassword` só entende o formato scrypt: ela olhava a
 * string, não reconhecia, e devolvia `false` NA HORA. A defesa contra ataque
 * por temporização não rodava — e a diferença não era de microssegundos:
 *
 *   e-mail inexistente  ~0,03 s
 *   e-mail existente     ~0,60 s
 *
 * Vinte vezes. Bastava cronometrar o login para varrer a base inteira e
 * descobrir quais endereços existem, que é exatamente o que a mensagem única
 * "Usuário ou senha inválidos" existe para impedir.
 *
 * É um scrypt real, dos MESMOS parâmetros de custo que as senhas de verdade —
 * um custo menor devolveria a diferença de tempo por outro caminho. A senha de
 * origem foi sorteada e descartada; ninguém a conhece, e nenhuma senha a
 * reproduz.
 */
export const HASH_DE_COMPARACAO =
  "$scrypt$ln=17,r=8,p=1$++U6IToDR54nwfAaYgZ17g$xXDupaGiR890PyV0qO48e2VB6nf19GXqvhSNKeMQF6A";
