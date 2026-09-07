/**
 * O que entra num backup — F5-06 (guia §24 e §5).
 *
 * A lista é EXPLÍCITA, e não "todas as tabelas". Três razões:
 *
 *  1. Nem tudo deve ser copiado. Sessão, tentativa de login e token de troca de
 *     senha são estado momentâneo: restaurar sessões antigas seria devolver
 *     acesso a quem já saiu.
 *  2. A ORDEM importa na restauração. Um módulo referencia um curso; inserir na
 *     ordem errada quebra a chave estrangeira. A ordem aqui é a ordem de
 *     inserção.
 *  3. Uma tabela nova precisa de uma DECISÃO. "Todas as tabelas" faria a
 *     próxima migração entrar no backup sem ninguém pensar se ela deve — e
 *     tabela com dado de outro cliente entraria junto.
 */

export interface TabelaDoBackup {
  nome: string;
  /**
   * Como a linha se liga ao cliente.
   *
   * `tenant` — tem `tenant_id` próprio.
   * `curso` — pertence a um curso, e o recorte vem por ele.
   * `matricula` — pertence a uma matrícula.
   * `pessoa` — pertence a um usuário do cliente.
   */
  vinculo: "tenant" | "curso" | "matricula" | "pessoa" | "modulo" | "aula" | "questao" | "prova" | "topico" | "trabalho" | "rubrica" | "tentativa" | "webhook" | "trilha" | "turma" | "comentario";
  /** A coluna que faz o vínculo, quando não é `tenant_id`. */
  chave?: string;
  /** Entra no backup de UM curso, além do backup do cliente inteiro. */
  noBackupDeCurso?: boolean;
}

/**
 * As tabelas, na ordem em que devem ser inseridas.
 *
 * Quem referencia vem depois de quem é referenciado.
 */
export const TABELAS_DO_BACKUP: TabelaDoBackup[] = [
  /* Estrutura do cliente. */
  { nome: "org_units", vinculo: "tenant" },
  { nome: "users", vinculo: "tenant" },
  { nome: "tenant_features", vinculo: "tenant" },
  { nome: "email_templates", vinculo: "tenant" },
  { nome: "tags", vinculo: "tenant" },
  { nome: "course_categories", vinculo: "tenant" },

  /* Catálogo. */
  { nome: "courses", vinculo: "tenant", noBackupDeCurso: true },
  { nome: "modules", vinculo: "curso", chave: "course_id", noBackupDeCurso: true },
  { nome: "lessons", vinculo: "modulo", chave: "module_id", noBackupDeCurso: true },
  { nome: "materials", vinculo: "aula", chave: "lesson_id", noBackupDeCurso: true },
  { nome: "course_tags", vinculo: "curso", chave: "course_id", noBackupDeCurso: true },
  { nome: "course_classes", vinculo: "tenant", noBackupDeCurso: true },
  { nome: "unlock_rules", vinculo: "tenant", noBackupDeCurso: true },
  { nome: "tracks", vinculo: "tenant" },
  { nome: "track_courses", vinculo: "trilha", chave: "track_id" },

  /* Avaliação.

     `question_categories` vem DEPOIS de `courses`: uma categoria de questão
     pode pertencer a um curso, e inserir antes quebra a chave estrangeira. */
  { nome: "question_categories", vinculo: "tenant" },
  { nome: "questions", vinculo: "tenant", noBackupDeCurso: true },
  { nome: "question_options", vinculo: "questao", chave: "question_id", noBackupDeCurso: true },
  { nome: "question_tags", vinculo: "questao", chave: "question_id", noBackupDeCurso: true },
  { nome: "quizzes", vinculo: "tenant", noBackupDeCurso: true },
  { nome: "quiz_questions", vinculo: "prova", chave: "quiz_id", noBackupDeCurso: true },
  { nome: "assignments", vinculo: "tenant", noBackupDeCurso: true },
  { nome: "rubrics", vinculo: "tenant", noBackupDeCurso: true },
  { nome: "rubric_criteria", vinculo: "rubrica", chave: "rubric_id", noBackupDeCurso: true },
  { nome: "scorm_packages", vinculo: "tenant", noBackupDeCurso: true },

  /* O que as pessoas fizeram. Não entra no backup de UM curso: o histórico é
     do cliente, e levá-lo junto ao migrar um curso levaria dado de aluno para
     onde ninguém pediu. */
  { nome: "enrollments", vinculo: "curso", chave: "course_id" },
  { nome: "lesson_progress", vinculo: "matricula", chave: "enrollment_id" },
  { nome: "quiz_attempts", vinculo: "matricula", chave: "enrollment_id" },
  { nome: "quiz_answers", vinculo: "tentativa", chave: "attempt_id" },
  { nome: "submissions", vinculo: "matricula", chave: "enrollment_id" },
  { nome: "submission_files", vinculo: "trabalho", chave: "submission_id" },
  { nome: "grade_entries", vinculo: "tenant" },
  { nome: "rubric_scores", vinculo: "trabalho", chave: "submission_id" },
  { nome: "scorm_tracking", vinculo: "matricula", chave: "enrollment_id" },
  { nome: "scorm_interactions", vinculo: "tentativa", chave: "tracking_id" },

  /* Comunidade. */
  { nome: "comments", vinculo: "aula", chave: "lesson_id" },
  { nome: "comment_votes", vinculo: "comentario", chave: "comment_id" },
  { nome: "forum_topics", vinculo: "tenant" },
  { nome: "forum_posts", vinculo: "topico", chave: "topic_id" },
  { nome: "forum_attachments", vinculo: "topico", chave: "post_id" },
  { nome: "forum_subscriptions", vinculo: "topico", chave: "topic_id" },

  /* Avisos e integrações. */
  { nome: "notifications", vinculo: "pessoa", chave: "user_id" },
  { nome: "notification_preferences", vinculo: "pessoa", chave: "user_id" },
  { nome: "webhooks", vinculo: "tenant" },
  { nome: "api_keys", vinculo: "tenant" },

  /* Auditoria por último: é o volume maior, e é a única tabela que SAI no
     arquivo mas NÃO volta na restauração — ver `NAO_RESTAURA` abaixo. */
  { nome: "audit_log", vinculo: "tenant" },
];

/**
 * Tabelas que o backup LEVA mas a restauração NÃO traz de volta.
 *
 * `audit_log` é o caso: o registro de auditoria precisa sair no arquivo — é
 * dado do cliente, e o guia §5 pede exportação completa por tenant. Mas
 * restaurá-lo é outra coisa.
 *
 * O `id` dela é `GENERATED ALWAYS`, então não pode ser inserido, e sem ele não
 * há chave única para o `ON CONFLICT DO NOTHING` comparar: cada restauração
 * DUPLICARIA a auditoria inteira. E uma auditoria duplicada é pior que uma
 * auditoria faltando — ela passa a afirmar que ações aconteceram duas vezes,
 * que é exatamente o que um registro de auditoria não pode fazer.
 *
 * A própria restauração já se registra na auditoria do destino, com quem fez e
 * quando. É esse o rastro que importa lá.
 */
export const NAO_RESTAURA = new Set(["audit_log"]);

/**
 * O que NÃO entra, com o motivo.
 *
 * Está aqui para ser lido, não para ser consultado por código: quem for
 * restaurar precisa saber o que não vai voltar ANTES de contar com isso.
 */
export const FORA_DO_BACKUP: Array<{ tabela: string; motivo: string }> = [
  {
    tabela: "sessions",
    motivo:
      "Sessão aberta é estado do momento. Restaurar devolveria acesso a quem já saiu, de um navegador que talvez nem exista mais.",
  },
  {
    tabela: "login_attempts",
    motivo:
      "Serve ao bloqueio por tentativa e envelhece em minutos. Restaurar tentativas antigas bloquearia gente por algo de meses atrás.",
  },
  {
    tabela: "password_reset_tokens",
    motivo:
      "Token de troca de senha vale por pouco tempo e dá acesso à conta. Restaurar um lote deles é reabrir uma porta que já fechou.",
  },
  {
    tabela: "webhook_deliveries",
    motivo:
      "Registro de entrega é diagnóstico, não conteúdo. O que importa restaurar é o webhook; o histórico de tentativas dele, não.",
  },
  {
    tabela: "coin_spends",
    motivo: "Depende de saldo e catálogo de recompensa, que a restauração não recompõe.",
  },
  {
    tabela: "forum_reports",
    motivo:
      "Denúncia pendente é fila de moderação viva. Restaurá-la traria de volta decisões que já foram tomadas.",
  },
  {
    tabela: "events",
    motivo: "Agenda derivada do que já está nos cursos e nas matrículas.",
  },
  {
    tabela: "tenants",
    motivo:
      "O cliente de destino já existe — é ele que recebe a restauração. Trazer a linha do backup sobrescreveria domínio, marca e configuração de quem está restaurando, e num destino diferente da origem isso é justamente o que ninguém quer.",
  },
];

/**
 * O que o backup NÃO carrega, além de tabelas.
 *
 * O ponto mais importante do formato, e o mais fácil de esquecer: o arquivo
 * tem os REGISTROS, não os ARQUIVOS. Vídeo, PDF e imagem vivem no storage, e a
 * restauração num ambiente sem aquele storage deixa aulas apontando para mídia
 * que não existe.
 */
export const AVISOS_DO_BACKUP = [
  "Os arquivos de mídia (vídeos, PDFs, imagens) não estão aqui — só as referências a eles. Restaurar em outro ambiente exige copiar o storage também.",
  "As senhas vêm como hash, e não em texto. Quem restaura não passa a saber a senha de ninguém.",
  "Sessões abertas, tentativas de login e tokens de senha ficam de fora: são estado do momento, não conteúdo.",
] as const;

/** Versão do formato. Muda quando o conteúdo do arquivo muda de forma. */
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupFile {
  formato: number;
  geradoEm: string;
  /** `tenant` ou `curso`. */
  escopo: "tenant" | "curso";
  origem: {
    tenantId: string;
    tenantSlug: string;
    /** Só em backup de curso. */
    courseId?: string;
    courseSlug?: string;
  };
  avisos: readonly string[];
  /** Tabela → linhas, na ordem de inserção. */
  dados: Record<string, Array<Record<string, unknown>>>;
}

/** Resumo legível de um arquivo de backup, para a tela conferir antes de restaurar. */
export function resumirBackup(arquivo: BackupFile): Array<{ tabela: string; linhas: number }> {
  return TABELAS_DO_BACKUP.filter((t) => (arquivo.dados[t.nome]?.length ?? 0) > 0).map((t) => ({
    tabela: t.nome,
    linhas: arquivo.dados[t.nome]!.length,
  }));
}

/**
 * O arquivo tem cara de backup deste produto?
 *
 * Confere antes de qualquer escrita: restaurar um JSON qualquer devolveria um
 * erro de banco no meio do processo, com metade das tabelas já mexidas.
 */
export function validarBackup(dado: unknown): { ok: true; arquivo: BackupFile } | { ok: false; erro: string } {
  if (typeof dado !== "object" || dado === null) {
    return { ok: false, erro: "O arquivo não é um backup válido." };
  }

  const candidato = dado as Partial<BackupFile>;

  if (typeof candidato.formato !== "number") {
    return { ok: false, erro: "O arquivo não diz em que formato foi gerado." };
  }

  if (candidato.formato > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      erro: `Este backup é do formato ${candidato.formato} e esta versão entende até o ${BACKUP_FORMAT_VERSION}. Atualize a plataforma antes de restaurar.`,
    };
  }

  if (candidato.escopo !== "tenant" && candidato.escopo !== "curso") {
    return { ok: false, erro: "O arquivo não diz se é backup de cliente ou de curso." };
  }

  if (typeof candidato.dados !== "object" || candidato.dados === null) {
    return { ok: false, erro: "O arquivo não tem dados." };
  }

  /* Uma tabela que este produto não conhece indica arquivo de outra origem —
     ou de uma versão que mexeu no formato sem trocar o número. */
  const conhecidas = new Set(TABELAS_DO_BACKUP.map((t) => t.nome));
  const estranhas = Object.keys(candidato.dados).filter((nome) => !conhecidas.has(nome));

  if (estranhas.length > 0) {
    return {
      ok: false,
      erro: `O arquivo tem tabelas que esta versão não conhece: ${estranhas.slice(0, 3).join(", ")}.`,
    };
  }

  return { ok: true, arquivo: candidato as BackupFile };
}
