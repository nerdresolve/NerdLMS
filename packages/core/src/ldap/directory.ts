/**
 * Diretórios pré-configurados.
 *
 * O mesmo princípio do OIDC: quem implanta não deveria precisar saber que o
 * Active Directory aceita `usuario@empresa.com` e o OpenLDAP exige
 * `uid=usuario,ou=people,dc=empresa,dc=com`. Isso é conhecimento do produto,
 * não do cliente.
 *
 * O QUE MUDA POR CLIENTE: o endereço do servidor e o domínio (ou a base). O
 * resto vem daqui.
 */

export type DirectoryKind = "ad" | "openldap" | "generico";

export interface DirectoryPreset {
  id: DirectoryKind;
  label: string;
  /**
   * Como o nome de quem entra vira o identificador que o diretório espera.
   *
   * `{user}` é o que a pessoa digitou; `{domain}` e `{base}` vêm da
   * configuração do cliente.
   */
  dnTemplate: string;
  /** Porta padrão com TLS. */
  defaultPort: number;
  /** O que o cliente precisa preencher além do servidor. */
  requires: "domain" | "base";
  hint: string;
}

export const DIRECTORY_PRESETS: DirectoryPreset[] = [
  {
    id: "ad",
    label: "Active Directory",
    /* O AD aceita o "userPrincipalName" — `ana@empresa.com.br` — e é a única
       forma que funciona sem saber onde a conta mora na árvore. Montar um DN
       completo exigiria conhecer a OU de cada pessoa, que muda por empresa e
       às vezes por departamento. */
    dnTemplate: "{user}@{domain}",
    defaultPort: 636,
    requires: "domain",
    hint:
      "O domínio do Active Directory, como aparece no login das pessoas, normalmente o mesmo do e-mail corporativo.",
  },
  {
    id: "openldap",
    label: "OpenLDAP",
    /* O OpenLDAP não tem equivalente ao userPrincipalName: o DN é montado a
       partir da base que o cliente informa. `ou=people` é a convenção que
       praticamente toda instalação segue. */
    dnTemplate: "uid={user},ou=people,{base}",
    defaultPort: 636,
    requires: "base",
    hint:
      "A base do diretório, no formato dc=empresa,dc=com,dc=br. Quem administra o servidor sabe de cor.",
  },
  {
    id: "generico",
    label: "Outro diretório LDAP",
    /* Sem suposição: quem escolhe genérico escreve o molde inteiro. */
    dnTemplate: "",
    defaultPort: 636,
    requires: "base",
    hint:
      "Escreva o molde do DN usando {user} onde entra o nome de quem faz login. Exemplo: cn={user},ou=usuarios,dc=empresa,dc=com",
  },
];

const POR_ID = new Map(DIRECTORY_PRESETS.map((d) => [d.id, d]));

export function directoryPreset(id: string): DirectoryPreset | undefined {
  return POR_ID.get(id as DirectoryKind);
}

/**
 * Caracteres que têm significado especial num DN, pelo RFC 4514.
 *
 * Um nome com `,` ou `=` mudaria a estrutura do DN em vez de virar texto: quem
 * digitasse `ana,ou=admins` estaria descrevendo outro lugar da árvore. Escapar
 * é o que impede o nome de quem faz login de virar parte da consulta.
 */
const ESPECIAIS = /[\\,+\"<>;=\r\n]/g;

export function escapeDnValue(valor: string): string {
  return valor
    .replace(ESPECIAIS, (c) => `\\${c}`)
    /* Espaco e `#` so sao especiais no INICIO, e o espaco tambem no fim.
       Escapa-los sempre alteraria nomes legitimos que os contenham no meio. */
    .replace(/^ /, "\\ ")
    .replace(/^#/, "\\#")
    .replace(/ $/, "\\ ");
}

export type DnResult =
  | { ok: true; dn: string }
  | { ok: false; error: string };

/**
 * Monta o DN de quem está entrando.
 *
 * Recusa em vez de montar torto, e a recusa é sempre a mesma mensagem: dizer
 * "esse nome tem caractere inválido" confirmaria a um atacante que o campo
 * chega até o diretório.
 */
export function buildBindDn(input: {
  template: string;
  user: string;
  domain?: string | null;
  base?: string | null;
}): DnResult {
  const user = input.user.trim();

  if (!user) return { ok: false, error: "Informe o usuário." };

  /* Barra invertida e nulo NÃO são escapados — são recusados. Um nulo trunca
     a string em C, e boa parte dos servidores LDAP é escrita em C: o resto do
     DN sumiria e o bind aconteceria contra outro objeto. */
  if (user.includes("\0")) {
    return { ok: false, error: "Usuário ou senha inválidos." };
  }

  /* O `*` é curinga em filtro LDAP. Aqui vai para um DN, onde ele não tem
     poder, mas recusá-lo custa nada e protege se um dia este valor for
     reaproveitado numa busca. */
  if (user.includes("*")) {
    return { ok: false, error: "Usuário ou senha inválidos." };
  }

  const template = input.template.trim();
  if (!template.includes("{user}")) {
    return { ok: false, error: "O molde do DN não tem o marcador {user}." };
  }

  const domain = (input.domain ?? "").trim();
  const base = (input.base ?? "").trim();

  /* O molde pede um valor que não foi preenchido.

     A conferência é ANTES da substituição, e é essencial: `replaceAll` trocaria
     `{domain}` por string vazia e o DN sairia `ana@` — um endereço incompleto
     que o servidor recusaria com um erro sobre o diretório, quando o problema
     é a configuração. Foi o que o teste pegou. */
  if (template.includes("{domain}") && !domain) {
    return { ok: false, error: "O diretório está configurado pela metade." };
  }
  if (template.includes("{base}") && !base) {
    return { ok: false, error: "O diretório está configurado pela metade." };
  }

  const dn = template
    .replaceAll("{user}", escapeDnValue(user))
    .replaceAll("{domain}", domain)
    .replaceAll("{base}", base);

  return { ok: true, dn };
}

/**
 * A base da busca, deduzida do domínio.
 *
 * `empresa.local` vira `DC=empresa,DC=local`. É a tradução mecânica que o
 * Active Directory usa para nomear a raiz de um domínio, e ela existe aqui para
 * que quem configura não precise saber que ela existe: o domínio já foi
 * informado no campo do login, e pedir a mesma coisa noutro formato é pedir
 * duas vezes.
 *
 * Quem tem árvore grande — ou quer limitar a busca a uma OU — informa a base à
 * mão e este cálculo não é usado.
 *
 * Cada pedaço é escapado pela regra do DN: um domínio com caractere especial é
 * patológico, mas montar o DN sem escapar seria confiar em nunca encontrá-lo.
 */
export function baseDnDoDominio(domain: string | null | undefined): string {
  const limpo = (domain ?? "").trim();
  if (!limpo) return "";

  return limpo
    .split(".")
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => `DC=${escapeDnValue(parte)}`)
    .join(",");
}
