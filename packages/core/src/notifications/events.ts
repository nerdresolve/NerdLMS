/**
 * Notificações por evento — F4-03, F4-04, F4-05.
 *
 * O guia §15 pede aviso in-app e por e-mail, disparado por evento, com
 * preferências individuais e templates com variáveis.
 *
 * O catálogo vive no CÓDIGO, como o de features: a lista de eventos muda com o
 * produto, não com o cliente. O que o cliente escolhe é receber ou não.
 */

export type NotificationKind =
  | "announcement"
  | "reminder"
  | "achievement"
  | "enrollment"
  | "course_available"
  | "lesson_available"
  | "deadline_near"
  | "assessment_open"
  | "grade_posted"
  | "course_completed"
  | "certificate_issued"
  | "forum_reply"
  | "forum_mention";

export interface NotificationEvent {
  kind: NotificationKind;
  label: string;
  /** O que a pessoa lê na tela de preferências, para decidir. */
  description: string;
  /** Padrões de canal. A pessoa sobrescreve. */
  defaultInApp: boolean;
  defaultEmail: boolean;
}

/**
 * Os eventos, com seus padrões.
 *
 * O critério do padrão de E-MAIL é a urgência fora do sistema: nota publicada e
 * prazo próximo valem um e-mail porque quem não abriu o sistema precisa saber.
 * Resposta de fórum não — avisaria demais, e quem acompanha um tópico já entra
 * para ler.
 */
export const NOTIFICATION_CATALOG: NotificationEvent[] = [
  {
    kind: "enrollment",
    label: "Matrícula em curso",
    description: "Quando você é matriculado em um curso.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    kind: "course_available",
    label: "Curso liberado",
    description: "Quando um curso que dependia de pré-requisito é liberado para você.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    kind: "lesson_available",
    label: "Aula liberada",
    description: "Quando a próxima aula de um curso sequencial abre.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    kind: "deadline_near",
    label: "Prazo próximo",
    description: "Quando falta pouco para o prazo de uma prova ou trabalho.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    kind: "assessment_open",
    label: "Avaliação disponível",
    description: "Quando uma prova ou trabalho abre para envio.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    kind: "grade_posted",
    label: "Nota publicada",
    description: "Quando o instrutor lança a nota de uma prova ou trabalho seu.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    kind: "course_completed",
    label: "Curso concluído",
    description: "Quando você conclui todas as aulas de um curso.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    kind: "certificate_issued",
    label: "Certificado emitido",
    description: "Quando seu certificado fica disponível.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    kind: "forum_reply",
    label: "Resposta no fórum",
    description: "Quando alguém responde em um tópico que você acompanha.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    kind: "forum_mention",
    label: "Menção no fórum",
    description: "Quando alguém menciona você em uma mensagem.",
    defaultInApp: true,
    /* Menção vale e-mail: é dirigida a uma pessoa, e quem menciona espera
       resposta. */
    defaultEmail: true,
  },
  {
    kind: "announcement",
    label: "Avisos da plataforma",
    description: "Comunicados da administração.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    kind: "reminder",
    label: "Lembretes",
    description: "Lembretes de retomar um curso em andamento.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    kind: "achievement",
    label: "Conquistas",
    description: "Quando você ganha uma conquista.",
    defaultInApp: true,
    defaultEmail: false,
  },
];

const POR_CHAVE = new Map(NOTIFICATION_CATALOG.map((e) => [e.kind, e]));

export interface Channels {
  inApp: boolean;
  email: boolean;
}

/**
 * Por onde este evento chega a esta pessoa.
 *
 * Sem preferência declarada vale o padrão do catálogo — a tabela guarda só o
 * que a pessoa MUDOU, como `tenant_features`. Uma linha por pessoa por evento
 * seria a maior tabela do banco guardando, quase toda, o valor padrão.
 *
 * Evento desconhecido não notifica: é a mesma escolha de `isFeatureEnabled` —
 * melhor calar por engano do que enviar o que ninguém previu.
 */
export function channelsFor(
  kind: NotificationKind,
  preferences: Map<string, Channels>,
): Channels {
  const evento = POR_CHAVE.get(kind);
  if (!evento) return { inApp: false, email: false };

  const escolha = preferences.get(kind);

  return {
    inApp: escolha?.inApp ?? evento.defaultInApp,
    email: escolha?.email ?? evento.defaultEmail,
  };
}

/**
 * Troca `{{variavel}}` pelos valores.
 *
 * A substituição é feita numa passada só, com função de troca: substituir em
 * cadeia faria um valor que contenha `{{...}}` ser reinterpretado na passada
 * seguinte — injeção de template pelo próprio dado, e o dado aqui vem de nome
 * de pessoa e título de curso.
 *
 * Variável sem valor vira vazio, não o literal: "Olá {{nome}}," num e-mail
 * real é pior que "Olá ,".
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, chave: string) => values[chave] ?? "");
}

/** Quantas menções uma mensagem pode notificar. */
const MAX_MENCOES = 10;

/**
 * Os nomes mencionados com `@`.
 *
 * Ignora e-mail: em "fale com joao@exemplo.com.br", o `@nerdlms` não é menção — o
 * caractere anterior é parte de uma palavra, e menção começa em fronteira.
 *
 * O teto existe porque uma mensagem com cinquenta `@` notificaria cinquenta
 * pessoas de uma vez, que é o formato clássico de spam por menção.
 */
export function extractMentions(texto: string): string[] {
  const encontrados = new Set<string>();

  /* `(^|[^\w@.])` garante a fronteira: depois de letra, ponto ou outro @, não
     é menção. É o que exclui o e-mail. */
  for (const m of texto.matchAll(/(^|[^\w@.])@([a-z0-9][a-z0-9._-]*[a-z0-9]|[a-z0-9])/gi)) {
    const nome = m[2];
    if (!nome) continue;

    encontrados.add(nome.toLowerCase());
    if (encontrados.size >= MAX_MENCOES) break;
  }

  return [...encontrados];
}
