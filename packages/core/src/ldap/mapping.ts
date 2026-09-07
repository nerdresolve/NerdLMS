/**
 * De grupo do diretório para papel aqui dentro.
 *
 * É a peça que faz valer o argumento inteiro de usar o Active Directory: o
 * desligamento de alguém acontece UMA vez, no diretório, e vale aqui no acesso
 * seguinte — sem depender de alguém lembrar de repetir a mudança nesta tela.
 *
 * O DIRETÓRIO É A FONTE DA VERDADE, E ISSO TEM DOIS LADOS
 *
 * Quem entra num grupo ganha o papel. Quem SAI do grupo perde — e é este lado
 * que dá sentido ao outro. Um mapeamento que só concede vira um sistema onde
 * todo mundo acumula permissão para sempre, que é o problema que ele deveria
 * resolver.
 *
 * A consequência prática precisa estar dita: com mapeamento configurado, mudar
 * o papel de alguém pela tela de usuários não dura. O próximo acesso recalcula
 * a partir dos grupos. A tela precisa avisar isso — uma alteração que se desfaz
 * sozinha e em silêncio é pior que uma alteração recusada.
 */

export type Role = "admin" | "manager" | "instructor" | "learner";

/**
 * Do mais poderoso para o menos.
 *
 * A ordem existe porque uma pessoa pode estar em vários grupos mapeados ao
 * mesmo tempo, e aqui cada uma tem UM papel. Somar não é opção; escolher, sim —
 * e a escolha é o maior. O contrário faria alguém que ganhou um grupo a mais
 * perder acesso, que é o oposto do que entrar num grupo significa.
 */
const FORCA: Record<Role, number> = {
  admin: 4,
  manager: 3,
  instructor: 2,
  learner: 1,
};

export interface GroupRole {
  /** O nome do grupo no diretório, como aparece no `CN`. */
  groupCn: string;
  role: Role;
}

export interface ResolveInput {
  /** Os grupos da pessoa, já extraídos do `memberOf`. */
  grupos: string[];
  mapeamentos: GroupRole[];
  /** O papel de quem não casa com nenhum grupo. */
  padrao: Role;
  /**
   * Exigir grupo para entrar.
   *
   * Ligado, o diretório passa a decidir também QUEM entra, não só com que
   * papel: quem não está em nenhum grupo mapeado é recusado. É o que se quer
   * quando o Active Directory tem a empresa inteira e o treinamento é de uma
   * parte dela.
   */
  exigirGrupo: boolean;
}

export type ResolveResult =
  | { ok: true; role: Role; via: string | null }
  | { ok: false; motivo: string };

export function resolverPapel(input: ResolveInput): ResolveResult {
  /* Sem mapeamento configurado, o diretório não opina sobre papel — ele só
     autentica, e o papel é o de quem chega. Tratar "nenhum mapeamento" como
     "nenhum grupo casou" recusaria todo mundo no dia em que o recurso fosse
     ligado sem ser preenchido. */
  if (input.mapeamentos.length === 0) {
    return { ok: true, role: input.padrao, via: null };
  }

  /* Comparação sem maiúsculas: o AD não diferencia, e quem digita o nome do
     grupo na tela de administração não vai copiar a grafia exata do esquema. */
  const meus = new Set(input.grupos.map((g) => g.trim().toLowerCase()));

  let escolhido: { role: Role; via: string } | null = null;

  for (const mapeamento of input.mapeamentos) {
    const alvo = mapeamento.groupCn.trim().toLowerCase();
    if (!alvo || !meus.has(alvo)) continue;

    if (!escolhido || FORCA[mapeamento.role] > FORCA[escolhido.role]) {
      escolhido = { role: mapeamento.role, via: mapeamento.groupCn };
    }
  }

  if (escolhido) return { ok: true, role: escolhido.role, via: escolhido.via };

  if (input.exigirGrupo) {
    /* Sem dizer QUAL grupo falta. O nome dos grupos de acesso é informação de
       quem administra, e recitá-la na tela de login dá a quem sonda o mapa das
       permissões da empresa. Quem precisa saber pergunta ao suporte, que lê a
       auditoria. */
    return {
      ok: false,
      motivo: "Sua conta da rede não tem acesso liberado a esta plataforma. Procure o suporte de TI.",
    };
  }

  return { ok: true, role: input.padrao, via: null };
}
