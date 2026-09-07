/**
 * Como uma identidade do provedor vira uma conta da plataforma.
 *
 * É a decisão mais delicada do SSO. Errar aqui não dá erro: dá acesso à conta
 * errada, silenciosamente, para alguém que parece ter feito um login normal.
 *
 * A regra tem três casos, nesta ordem:
 *
 *   JÁ VINCULADA — existe um vínculo (provedor, sub). Entra. É o caminho de
 *   todo dia, e o único que não depende do e-mail.
 *
 *   MESMO E-MAIL, SEM VÍNCULO — a pessoa já tinha conta e agora entra pelo
 *   provedor pela primeira vez. Vincula e entra, porque o provedor confirmou
 *   o e-mail e o e-mail é único aqui dentro.
 *
 *   NINGUÉM — cria, se o cliente permitir; senão, recusa.
 *
 * O vínculo é por `sub`, não por e-mail, porque e-mail muda: quem casa e troca
 * de sobrenome recebe outro endereço e continua a mesma pessoa. `sub` é estável
 * e é o que o provedor promete não reaproveitar.
 */

export interface LinkedIdentity {
  provider: string;
  subject: string;
  userId: string;
}

export interface ExistingAccount {
  id: string;
  email: string;
  status: string;
  /** `true` quando esta conta já tem vínculo com ALGUM provedor. */
  hasAnyLink: boolean;
}

export interface LinkInput {
  provider: string;
  subject: string;
  email: string;
  fullName: string | null;
  /** O vínculo (provedor, sub), se existir. */
  linked: LinkedIdentity | null;
  /** A conta com este e-mail, se existir. */
  byEmail: ExistingAccount | null;
  /** O cliente aceita que o SSO crie contas novas. */
  allowJit: boolean;
  /** Papel de quem for criado pelo SSO. */
  jitRole: string;
}

export type LinkDecision =
  | { kind: "login"; userId: string }
  | { kind: "link-and-login"; userId: string }
  | { kind: "create"; email: string; fullName: string; role: string }
  | { kind: "refuse"; reason: string };

/**
 * Decide o que fazer com quem acabou de autenticar no provedor.
 *
 * Função pura de propósito: recebe o que o banco já respondeu e devolve a
 * decisão, sem escrever nada. Quem escreve é o backend — e assim a regra pode
 * ser testada em todos os casos sem um banco por perto.
 */
export function decideLink(input: LinkInput): LinkDecision {
  const email = input.email.trim().toLowerCase();

  if (input.linked) {
    /* O vínculo aponta para uma conta que pode ter sido desativada depois. Sem
       esta conferência, desligar alguém no painel não tiraria o acesso dela
       pelo SSO — que é exatamente o acesso que uma empresa mais quer cortar no
       dia de um desligamento. */
    if (input.byEmail && input.byEmail.id === input.linked.userId) {
      const bloqueio = contaBloqueada(input.byEmail.status);
      if (bloqueio) return { kind: "refuse", reason: bloqueio };
    }

    return { kind: "login", userId: input.linked.userId };
  }

  if (input.byEmail) {
    const bloqueio = contaBloqueada(input.byEmail.status);
    if (bloqueio) return { kind: "refuse", reason: bloqueio };

    return { kind: "link-and-login", userId: input.byEmail.id };
  }

  if (!input.allowJit) {
    return {
      kind: "refuse",
      reason: "Você não tem conta nesta plataforma. Fale com o administrador.",
    };
  }

  return {
    kind: "create",
    email,
    /* Sem nome, o e-mail vira o nome: é melhor que uma lista de pessoas com
       campos vazios, e a pessoa corrige no perfil. */
    fullName: input.fullName?.trim() || email,
    role: input.jitRole,
  };
}

function contaBloqueada(status: string): string | null {
  if (status === "active") return null;
  if (status === "pending") return null;

  return "Esta conta está inativa. Fale com o administrador.";
}
