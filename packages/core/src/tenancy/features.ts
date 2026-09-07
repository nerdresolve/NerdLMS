/**
 * Catálogo de funcionalidades — o que um cliente pode ligar e desligar.
 *
 * A plataforma é white-label: nem toda empresa quer tudo. Uma pode não querer
 * comentários; outra quer comentários mas não o marcador de "útil"; uma
 * terceira não usa gamificação nenhuma.
 *
 * A chave é hierárquica (`comentarios.upvotes`) e a resolução respeita a
 * herança: desligar o pai desliga os filhos, sem precisar tocar em cada um.
 * Um booleano por módulo não resolveria — o cliente que quer comentários sem
 * upvote precisaria de um "meio ligado" que não existe.
 *
 * Este arquivo é o CATÁLOGO, não o estado: aqui vive o que existe e qual é o
 * padrão; o que cada cliente escolheu vive em `tenant_features`, no banco.
 */

export interface FeatureDefinition {
  /** Chave hierárquica, separada por ponto. */
  key: string;
  /** Nome curto, como aparece na tela de administração. */
  label: string;
  /** O que a pessoa perde ao desligar. Aparece abaixo do nome. */
  description: string;
  /**
   * Ligada quando o cliente não disse nada.
   *
   * O padrão é `true` para o que a Exemplo S.A. já usa hoje: um cliente existente não
   * pode perder funcionalidade porque o catálogo nasceu. Recurso novo entra
   * desligado, para ninguém ser surpreendido por uma tela que apareceu
   * sozinha.
   */
  defaultOn: boolean;
}

/**
 * Tudo que pode ser ligado ou desligado.
 *
 * A ordem é a da tela de administração: agrupada por área, do mais estrutural
 * para o mais periférico.
 */
export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    key: "comentarios",
    label: "Comentários nas aulas",
    description:
      "Conversa dentro da aula. Desligar esconde a seção inteira e mantém o que já foi escrito.",
    defaultOn: true,
  },
  {
    key: "comentarios.respostas",
    label: "Responder comentário",
    description: "Sem isto, a conversa fica plana: cada pessoa comenta, ninguém responde.",
    defaultOn: true,
  },
  {
    key: "comentarios.upvotes",
    label: "Marcar comentário como útil",
    description: "O contador de úteis. Desligar não apaga os votos já dados.",
    defaultOn: true,
  },

  {
    key: "forum",
    label: "Fórum do curso",
    description:
      "Tópicos e respostas por curso. Desligar esconde o fórum e mantém o que já foi escrito.",
    defaultOn: true,
  },
  {
    key: "forum.anexos",
    label: "Anexos no fórum",
    description: "Permite anexar arquivo a um tópico ou resposta.",
    defaultOn: true,
  },
  {
    key: "forum.denuncias",
    label: "Denunciar mensagem",
    description:
      "O botão de denunciar. Sem ele, a moderação depende de alguém avisar o instrutor por fora.",
    defaultOn: true,
  },

  {
    key: "notificacoes",
    label: "Notificações",
    description:
      "Avisos de matrícula, nota, prazo e certificado. Desligar silencia o produto inteiro.",
    defaultOn: true,
  },
  {
    key: "notificacoes.email",
    label: "Notificações por e-mail",
    description:
      "Além do aviso dentro da plataforma. Alguns clientes preferem não receber e-mail do sistema.",
    defaultOn: true,
  },

  {
    key: "trilhas",
    label: "Trilhas de aprendizagem",
    description: "Sequências de cursos com pré-requisito entre eles.",
    defaultOn: true,
  },
  {
    key: "agenda",
    label: "Agenda e avisos",
    description: "Calendário de treinamentos, prazos e comunicados.",
    defaultOn: true,
  },

  {
    key: "gamificacao",
    label: "Gamificação",
    description: "Moedas, distintivos e loja de recompensas.",
    defaultOn: true,
  },
  {
    key: "gamificacao.distintivos",
    label: "Distintivos",
    description: "Selos por conquista, no perfil de quem os ganhou.",
    defaultOn: true,
  },
  {
    key: "gamificacao.loja",
    label: "Loja de recompensas",
    description: "Troca de moedas por benefícios.",
    defaultOn: true,
  },

  {
    key: "certificados",
    label: "Certificados",
    description: "Emissão em PDF ao concluir, com código de verificação público.",
    defaultOn: true,
  },
  {
    key: "favoritos",
    label: "Favoritar cursos",
    description: "O marcador que guarda um curso para ver depois.",
    defaultOn: true,
  },
  {
    key: "busca",
    label: "Busca global",
    description: "A lupa da barra do topo, que procura em cursos e aulas.",
    defaultOn: true,
  },
];

const PORCHAVE = new Map(FEATURE_CATALOG.map((f) => [f.key, f]));

/** A definição de uma chave, ou `undefined` se ela não existe no catálogo. */
export function featureDefinition(key: string): FeatureDefinition | undefined {
  return PORCHAVE.get(key);
}

/**
 * Os ancestrais de uma chave, do mais próximo ao mais distante.
 *
 * `comentarios.upvotes.detalhe` devolve `["comentarios.upvotes", "comentarios"]`.
 */
export function ancestorsOf(key: string): string[] {
  const partes = key.split(".");
  const saida: string[] = [];

  for (let i = partes.length - 1; i > 0; i -= 1) {
    saida.push(partes.slice(0, i).join("."));
  }

  return saida;
}

/**
 * Decide se uma funcionalidade está ligada para este cliente.
 *
 * A regra, em ordem:
 *
 * 1. **Pai desligado desliga o filho, sempre.** Um `comentarios.upvotes: true`
 *    com `comentarios: false` não vale — senão a garantia "este cliente não tem
 *    comentários" deixaria de valer, e o upvote apareceria numa seção que não
 *    existe.
 * 2. A escolha explícita do cliente, se houver.
 * 3. O padrão do catálogo.
 *
 * Chave fora do catálogo devolve `false`: é erro de digitação, e uma tela que
 * aparece por causa de um typo é pior que uma que não aparece.
 *
 * @param overrides o que o cliente escolheu, só as chaves que ele mexeu.
 */
export function isFeatureEnabled(key: string, overrides: Map<string, boolean>): boolean {
  const definition = PORCHAVE.get(key);
  if (!definition) return false;

  /* O pai vem primeiro, e vence. */
  for (const ancestral of ancestorsOf(key)) {
    if (!isFeatureEnabled(ancestral, overrides)) return false;
  }

  const escolha = overrides.get(key);
  return escolha ?? definition.defaultOn;
}

/**
 * O estado de todas as chaves, já resolvido.
 *
 * Serve à tela de administração e ao contexto que as páginas consomem: com o
 * mapa pronto, cada consulta é uma leitura, não uma nova subida pela árvore.
 */
export function resolveFeatures(overrides: Map<string, boolean>): Map<string, boolean> {
  return new Map(FEATURE_CATALOG.map((f) => [f.key, isFeatureEnabled(f.key, overrides)]));
}
