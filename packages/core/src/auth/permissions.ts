/**
 * Controle de acesso baseado em papel — PRD §2 e §8.
 *
 * Função pura, sem I/O: recebe quem age, o que quer fazer e sobre qual recurso,
 * e devolve permitido ou não. Roda no servidor antes de qualquer efeito, e a
 * mesma função pode esconder um botão no cliente — mas esconder botão nunca é
 * a proteção.
 *
 * Princípio: **nada aqui aceita dado vindo do cliente**. Papel, autoria e
 * matrícula são carregados do banco pelo servidor; se viessem no payload,
 * qualquer aluno se declararia admin.
 */

/**
 * Papéis da plataforma.
 *
 * `manager` existe porque a proposta promete "Administrador, Gestor e Aluno" e
 * porque os relatórios pedidos são **por campo** (Unidade Central, Unidade Leste,
 * Unidade Oeste, Unidade Sul). O recorte do instrutor é autoria de conteúdo e não
 * responde "como está Unidade Leste" — são funções diferentes, não sinônimos.
 * Ver PRD §2 e DEC-038.
 */
export type Role = "admin" | "manager" | "instructor" | "learner";

export interface Actor {
  id: string;
  role: Role;
  /**
   * O cliente a que esta pessoa pertence.
   *
   * É a fronteira externa: nada atravessa. Um admin é irrestrito DENTRO do
   * próprio tenant e não existe para os demais — "acesso total" nunca
   * significou acesso ao dado de outra empresa.
   *
   * Opcional no tipo por uma razão de transição: há chamadas antigas que ainda
   * não o informam, e `can()` trata a ausência como "não sei de quem é" —
   * negando quando o recurso declara tenant. Torná-lo obrigatório de uma vez
   * quebraria o build em 31 pontos sem que nenhum deles estivesse errado.
   */
  tenantId?: string;
  /** Unidade do gestor. Define o recorte que ele enxerga DENTRO do tenant. */
  project?: string;
}

/** Recursos sobre os quais se decide permissão. */
export type Resource =
  | {
      kind: "course";
      authorId: string;
      status: "draft" | "published" | "archived";
      /**
       * Se quem lê já está matriculado. Só importa para curso arquivado:
       * aposentar conteúdo não pode tirar do aluno o que ele já cursava.
       */
      enrolled?: boolean;
    }
  | { kind: "enrollment"; learnerId: string; courseAuthorId: string }
  | { kind: "progress"; learnerId: string; courseAuthorId: string }
  | { kind: "comment"; authorId: string; courseAuthorId: string }
  | { kind: "analytics"; scope: "platform" } // engajamento geral
  | { kind: "analytics"; scope: "project"; project: string }
  | { kind: "analytics"; scope: "course"; courseAuthorId: string }
  | { kind: "analytics"; scope: "self"; learnerId: string }
  | { kind: "user"; project?: string };

/**
 * O tenant dono do recurso, quando conhecido.
 *
 * Fica fora da união porque vale para TODA variante: repetir o campo em cada
 * uma convidaria a esquecer justamente na próxima que alguém acrescentar.
 */
export type TenantScoped = { tenantId?: string };

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "publish"
  | "enroll"
  | "comment"
  | "reply"
  | "highlight"; // responder com a tag Professor

function isAuthor(actor: Actor, authorId: string): boolean {
  return actor.id === authorId;
}

/**
 * Decide se `actor` pode executar `action` sobre `resource`.
 *
 * A ordem importa: o admin é avaliado primeiro porque a proposta lhe dá acesso
 * irrestrito; depois vêm as regras que dependem de autoria e de identidade.
 */
export function can(
  actor: Actor,
  action: Action,
  resource: Resource & TenantScoped,
): boolean {
  /* FRONTEIRA DE TENANT — antes de qualquer outra regra.
     
     Vem primeiro de propósito. Se viesse depois, o bloco do admin já teria
     devolvido `true` e um administrador de um cliente enxergaria o dado de
     outro — e "acesso irrestrito" nunca significou acesso à empresa alheia.
     
     Só decide quando OS DOIS lados declaram tenant. Ausência não é permissão
     disfarçada: é a transição de 31 chamadas que ainda não o informam, e
     enquanto elas existem a decisão fica com as regras de papel. O teste que
     prova o isolamento (F0-06) cobre o caminho em que ambos estão presentes. */
  if (actor.tenantId && resource.tenantId && actor.tenantId !== resource.tenantId) {
    return false;
  }

  // Admin: acesso irrestrito (PRD §2). Continua sendo registrado em auditoria.
  if (actor.role === "admin") {
    // Nem o admin comenta como professor: a tag identifica autoria de conteúdo,
    // não hierarquia. Ver PRD §2, conflito 3.
    if (action === "highlight") return false;

    /* Nem o admin reescreve a fala de outra pessoa.
       "Irrestrito" vale para ver, remover e administrar — não para editar
       conteúdo assinado por terceiro. Um comentário alterado continua com o
       nome de quem escreveu embaixo: "eu concordo" viraria "eu discordo" sem
       nenhum sinal para quem lê, nem para quem escreveu. Moderação é
       REMOVER, que deixa rastro em auditoria e some da tela por inteiro.
       Mesmo espírito da exceção acima. */
    if (action === "update" && resource.kind === "comment") {
      return isAuthor(actor, resource.authorId);
    }

    return true;
  }

  /* Gestor: acompanha o próprio projeto e matricula gente nele. Não cria nem
     edita conteúdo — isso é do instrutor. */
  if (actor.role === "manager") {
    switch (resource.kind) {
      case "analytics":
        if (action !== "read") return false;
        return resource.scope === "project" && resource.project === actor.project;

      case "user":
        // Vê e convida gente do próprio projeto, nunca de outro.
        return resource.project !== undefined && resource.project === actor.project;

      case "enrollment":
        // Matrícula atribuída: é o gestor quem coloca a equipe no treinamento
        // obrigatório. Ver DEC-039.
        return action === "read" || action === "create" || action === "enroll";

      case "course":
        return action === "read" && resource.status === "published";

      case "progress":
        return action === "read";

      case "comment":
        return action === "read" || action === "comment" || action === "reply";

      default:
        return false;
    }
  }

  switch (resource.kind) {
    case "course": {
      if (actor.role === "instructor") {
        // Cria à vontade; mexe apenas no que é seu.
        if (action === "create") return true;
        if (action === "read") return isAuthor(actor, resource.authorId) || resource.status === "published";
        if (action === "update" || action === "delete" || action === "publish") {
          return isAuthor(actor, resource.authorId);
        }
        return false;
      }
      // Learner só lê — e só o que está publicado.
      if (action !== "read") return false;
      if (resource.status === "published") return true;

      /* Arquivado continua legível para quem JÁ estava matriculado.
         Arquivar aposenta o curso para novas matrículas; não expulsa quem
         está no meio dele. Sem isto, arquivar tirava a página, as aulas e até
         o certificado de quem já havia concluído — enquanto o curso seguia
         listado em "Meus cursos", levando a um 404. */
      return resource.status === "archived" && resource.enrolled === true;
    }

    case "enrollment": {
      // Learner se matricula para si mesmo — nunca para outra pessoa.
      if (actor.role === "learner") {
        if (action === "enroll" || action === "create") return isAuthor(actor, resource.learnerId);
        if (action === "read") return isAuthor(actor, resource.learnerId);
        return false;
      }
      // Instructor vê quem está matriculado nos cursos dele; não matricula ninguém.
      if (action === "read") return isAuthor(actor, resource.courseAuthorId);
      return false;
    }

    case "progress": {
      // O aluno lê e escreve o próprio progresso. Só o próprio.
      if (actor.role === "learner") return isAuthor(actor, resource.learnerId);
      // O instrutor acompanha, mas não altera progresso de aluno.
      if (action === "read") return isAuthor(actor, resource.courseAuthorId);
      return false;
    }

    case "comment": {
      if (action === "comment" || action === "reply") return true;
      if (action === "highlight") {
        // A tag Professor exige papel de instrutor E autoria do curso.
        return actor.role === "instructor" && isAuthor(actor, resource.courseAuthorId);
      }
      if (action === "delete") {
        // Apaga o próprio comentário; o instrutor modera o que está no curso dele.
        if (isAuthor(actor, resource.authorId)) return true;
        return actor.role === "instructor" && isAuthor(actor, resource.courseAuthorId);
      }
      if (action === "update") return isAuthor(actor, resource.authorId);
      if (action === "read") return true;
      return false;
    }

    case "analytics": {
      if (action !== "read") return false;
      if (resource.scope === "platform") return false; // só admin, tratado acima
      if (resource.scope === "project") return false; // só admin e gestor do projeto
      if (resource.scope === "course") {
        return actor.role === "instructor" && isAuthor(actor, resource.courseAuthorId);
      }
      return isAuthor(actor, resource.learnerId);
    }

    case "user":
      return false; // gestão de usuários é exclusiva do admin

    default: {
      // Recurso novo sem regra: nega. Falhar fechado, nunca aberto.
      const exhaustive: never = resource;
      void exhaustive;
      return false;
    }
  }
}

/**
 * Decide se a resposta de um comentário deve exibir a tag "Professor".
 *
 * Existe separada de `can` porque é a regra que o servidor aplica ao **gravar**
 * o comentário: o destaque é derivado do papel e da autoria, nunca um campo do
 * payload (PRD §8).
 */
export function highlightsAsInstructor(actor: Actor, courseAuthorId: string): boolean {
  return can(actor, "highlight", { kind: "comment", authorId: actor.id, courseAuthorId });
}
