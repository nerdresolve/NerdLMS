/**
 * Auditoria de sistema — TASK-058.
 *
 * A proposta promete "rastreabilidade total das ações na plataforma". O que
 * isso significa em código, e por que a tela vem antes da API:
 *
 * **O registro de auditoria não é log de aplicação.** Log serve para depurar e
 * pode ser perdido; auditoria serve para responder "quem fez o quê, quando, e
 * foi permitido?" meses depois. Consequências que já valem como especificação:
 *
 * - **Só se escreve, nunca se altera.** Um registro que pode ser editado não
 *   prova nada. Sem `update`, sem `delete` — nem para o admin.
 * - **Tentativa negada é tão importante quanto ação permitida.** Um IDOR
 *   bloqueado só vira sinal se ficar registrado; dez negações seguidas do mesmo
 *   usuário são um alerta.
 * - **Nunca guardar o dado sensível em si.** Registra-se que a pessoa exportou
 *   um relatório, não o conteúdo dele. Auditoria que copia dado vira uma
 *   segunda base para vazar.
 */

export type AuditAction =
  | "login"
  | "login_failed"
  | "course_created"
  | "course_published"
  | "course_deleted"
  | "user_invited"
  | "user_deactivated"
  | "role_changed"
  | "report_exported"
  /* Configuração do tenant: funcionalidade ligada ou desligada, marca trocada.
     Entra na auditoria porque muda o que TODO MUNDO daquele cliente enxerga. */
  | "config_changed"
  | "enrollment_created"
  | "comment_deleted"
  | "access_denied"
  | "password_reset"
  /* Importação em massa: um clique que cria dezenas de contas de uma vez. */
  | "users_imported"
  /* Idem para questões — muda o que vai ser perguntado numa prova. */
  | "questions_imported"
  /* E para cursos: uma planilha pode criar um catálogo inteiro. */
  | "courses_imported"
  /* Backup: levar o cliente inteiro para um arquivo, e trazê-lo de volta. */
  | "backup_generated"
  | "backup_restored"
  /* Badges (F6-01): criar o badge, emitir à mão e revogar. */
  | "badge_created"
  | "badge_awarded"
  | "badge_revoked"
  /* Competências (F6-02): configurar o framework, atestar e revogar. */
  | "competency_configured"
  | "competency_attested"
  | "competency_revoked"
  /* Eficácia do treinamento: o instrutor volta depois da conclusão e registra
     se o desempenho mudou. É evidência de conformidade, e mora em tabela
     própria — aqui fica só o rastro de que a avaliação aconteceu, com quem e
     quando, junto das demais ações de gestão. */
  | "effectiveness_reviewed"
  /* SSO (F5-04): entrar pelo provedor da empresa é `login`, como qualquer
     outro. Estas duas são o que só o SSO produz — a recusa do provedor, que
     não é senha errada e não conta para o bloqueio por força bruta, e o
     vínculo de uma conta a uma identidade externa, que passa a ser uma
     segunda forma de entrar nela. */
  | "sso_login_failed"
  | "sso_identity_linked";

export type AuditOutcome = "allowed" | "denied";

export interface AuditEvent {
  id: string;
  /** Instante em ISO 8601 com fuso. Aqui o instante importa, ao contrário da agenda. */
  at: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  /** O que foi afetado, em texto legível. Nunca o conteúdo do dado. */
  target: string;
  outcome: AuditOutcome;
  /** Origem da requisição, quando conhecida. */
  ip?: string;
}

/** Ações que merecem destaque na revisão: mexem em acesso ou em dado. */
export const SENSITIVE_ACTIONS: AuditAction[] = [
  "role_changed",
  "user_deactivated",
  "course_deleted",
  "report_exported",
  /* Redefinir senha é sensível pelo mesmo motivo que mudar papel: quem troca a
     senha de uma conta passa a controlá-la. */
  "password_reset",
  /* Criar uma conta é sensível; criar duzentas de uma vez, mais ainda — e o
     registro é o único lugar onde isso fica visível depois. */
  "users_imported",
  /* Um backup é o cliente inteiro num arquivo que sai daqui; uma restauração
     escreve em todas as tabelas de uma vez. As duas coisas mais sensíveis que
     o produto faz. */
  "backup_generated",
  "backup_restored",
  /* Revogar um badge desfaz um reconhecimento público — quem o compartilhou
     passa a ter um link que diz "revogado". */
  "badge_revoked",
  /* Atestar competência pode mandar alguém para um campo onde a falta dela
     machuca; revogá-la tira de alguém uma qualificação. As duas exigem rastro. */
  "competency_attested",
  "competency_revoked",
  /* Vincular uma conta a uma identidade externa cria uma segunda porta para
     ela. Quem revisa acesso precisa ver quando essa porta apareceu. */
  "sso_identity_linked",
];

export function isSensitive(event: AuditEvent): boolean {
  return SENSITIVE_ACTIONS.includes(event.action);
}

export interface AuditQuery {
  /** Texto livre sobre autor e alvo. */
  search?: string;
  outcome?: AuditOutcome | "all";
  /** Só ações sensíveis. */
  sensitiveOnly?: boolean;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Mais recentes primeiro — é a ordem em que se investiga. */
export function queryAudit(events: AuditEvent[], query: AuditQuery = {}): AuditEvent[] {
  const { search = "", outcome = "all", sensitiveOnly = false } = query;
  const term = normalize(search.trim());

  return events
    .filter((event) => (outcome === "all" ? true : event.outcome === outcome))
    .filter((event) => (sensitiveOnly ? isSensitive(event) : true))
    .filter((event) => {
      if (!term) return true;
      return normalize(`${event.actorName} ${event.target}`).includes(term);
    })
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface AuditSummary {
  total: number
  denied: number;
  sensitive: number;
  /** Autores distintos no período. */
  actors: number;
}

export function auditSummary(events: AuditEvent[]): AuditSummary {
  return {
    total: events.length,
    denied: events.filter((event) => event.outcome === "denied").length,
    sensitive: events.filter(isSensitive).length,
    actors: new Set(events.map((event) => event.actorId)).size,
  };
}

/**
 * Autores com muitas negações seguidas.
 *
 * Não é detecção de intrusão — é o sinal mínimo que a tela precisa dar para
 * alguém olhar. Um usuário com várias tentativas negadas ou está com permissão
 * mal configurada, ou está tentando o que não deve.
 */
export function repeatedDenials(events: AuditEvent[], threshold = 3): Array<{ actorId: string; actorName: string; denials: number }> {
  const byActor = new Map<string, { actorName: string; denials: number }>();

  for (const event of events) {
    if (event.outcome !== "denied") continue;
    const current = byActor.get(event.actorId) ?? { actorName: event.actorName, denials: 0 };
    current.denials += 1;
    byActor.set(event.actorId, current);
  }

  return [...byActor.entries()]
    .filter(([, data]) => data.denials >= threshold)
    .map(([actorId, data]) => ({ actorId, ...data }))
    .sort((a, b) => b.denials - a.denials);
}
