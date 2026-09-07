import type { ContentKind } from "./content.ts";
/**
 * Modelo de domínio de aprendizagem.
 *
 * Derivado do PRD.md (proposta executiva + definição de perfis). Os pontos
 * ainda em aberto estão marcados no PRD §2 como "A CONFIRMAR".
 */

import type { Role } from "../auth/permissions.ts";

export type LessonStatus = "not_started" | "in_progress" | "completed";

/**
 * Tipo de conteúdo da aula.
 *
 * SCORM está aqui porque a proposta promete upload de "SCORM, vídeo, imagem,
 * slide, doc" e a Exemplo S.A. já usa hoje. **A conclusão de uma aula SCORM não segue
 * a regra dos 90%**: quem decide é o próprio pacote, pela API dele. Misturar as
 * duas fontes daria dois donos para a mesma verdade. Ver DEC-041.
 */
/**
 * O que a aula É.
 *
 * O guia §4 pede que a LMS aceite muito mais que vídeo. A lista vive em
 * `content.ts` junto das regras que dependem dela — duas listas divergiriam no
 * primeiro tipo novo.
 */
export type LessonKind = ContentKind;

export interface Lesson {
  /**
   * Estado do arquivo de mídia. Ausente é o normal: pronto.
   *
   * `splitting` é o vídeo longo esperando o corte automático em aulas de
   * quinze minutos; `failed` é o corte que não deu certo depois das tentativas.
   * A tela precisa dizer as duas coisas — uma aula com o vídeo inteiro parecendo
   * pronta é pior que uma aula que avisa que ainda está sendo preparada.
   */
  mediaStatus?: "splitting" | "failed";
  id: string;
  title: string;
  /** Duração total em segundos. Para SCORM é estimativa, não critério. */
  durationSeconds: number;
  kind?: LessonKind;
  /** Chave do arquivo no storage. Ausente na aula de texto e de link. */
  mediaKey?: string;
  /** Conteúdo escrito no editor, na aula de texto. */
  textContent?: string;
  /** Endereço externo, na aula de link. */
  externalUrl?: string;
  /**
   * Páginas do documento.
   *
   * É o denominador de "chegou ao fim": sem ele não há como distinguir quem
   * leu as quarenta páginas de quem abriu a primeira.
   */
  pageCount?: number;
  /** Segundos mínimos na aula antes de poder concluir (guia §10). */
  minSeconds?: number;
  /**
   * Como esta aula conclui.
   *
   * `auto` fecha sozinha ao cruzar o limiar de consumo — é o padrão e o
   * comportamento histórico. `manual` exige que alguém marque: uma leitura ou
   * um encontro presencial não têm o que medir, e sob a regra automática
   * jamais concluiriam.
   */
  completionMode?: CompletionMode;
}

/** Ver `Lesson.completionMode`. */
export type CompletionMode = "auto" | "manual";

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Índice da arte gerada da capa (0–3). Não há upload de imagem no MVP. */
  artwork: 0 | 1 | 2 | 3;
  /** Instructor que criou o curso. Define quem pode editar e destacar respostas. */
  authorId: string;
  /**
   * Como a pessoa entra no curso.
   *
   * `open`: o aluno se inscreve sozinho — é o caso dos cursos livres e dos
   * abertos a terceirizados, que numa operação de campo somam milhares de
   * pessoas. Matricular uma a uma nessa escala é inviável.
   * `assigned`: alguém matricula — treinamento obrigatório, atribuído pelo
   * gestor do campo. Ver DEC-039.
   */
  enrollmentMode: "open" | "assigned";
  /** Projeto a que o curso pertence, quando não for aberto a todos. */
  project?: string;
  /**
   * Rascunho não aparece para o aluno. Sem este estado não existe "editar antes
   * de publicar", que a proposta pressupõe no backoffice.
   */
  /**
   * `archived` existe no schema desde a 001 e faltava aqui — um curso
   * arquivado no banco chegava com um valor fora do tipo. Arquivar é como se
   * aposenta conteúdo sem apagar histórico de quem já o cursou.
   */
  status: "draft" | "published" | "archived";
  modules: Module[];

  /* ---------------------------------------------------------- metadados
     Tudo opcional: curso antigo não tem nada disso preenchido, e exigir
     curadoria retroativa transformaria uma migration em projeto. */

  /** Categoria a que pertence. A árvore vive em `course_categories`. */
  category?: CourseCategoryRef;
  /** Identificador do RH: "NR-10", "INT-001". Único por tenant. */
  code?: string;
  /**
   * Carga horária DECLARADA, em minutos.
   *
   * Não é a soma dos vídeos: um curso com 40 minutos de vídeo pode valer "4
   * horas" no certificado, contando leitura e exercício. É este número que vai
   * para o certificado e para o relatório de compliance.
   */
  workloadMinutes?: number;
  level?: CourseLevel;
  /** BCP 47: "pt-BR", "en". */
  language?: string;
  /** Um objetivo por linha. */
  objectives?: string;
  audience?: string;
  /** ISO 8601 sem hora (AAAA-MM-DD): a data não tem fuso que signifique algo. */
  startsOn?: string;
  endsOn?: string;
  /**
   * Quem enxerga o curso JÁ publicado.
   *
   * Separada de `status`, que é o ciclo editorial. Um treinamento sigiloso está
   * publicado e fora do catálogo — sem esta distinção, isso não se expressa.
   */
  visibility?: CourseVisibility;
  tags?: Tag[];
  /**
   * Como o conteúdo é liberado (F2-05).
   *
   * `sequential` abre cada aula quando a anterior conclui — atalho para o caso
   * mais comum de liberação progressiva, derivado da POSIÇÃO. Escrever uma
   * regra por aula daria N-1 regras que o instrutor esqueceria de refazer ao
   * inserir uma aula no meio.
   */
  contentRelease?: "open" | "sequential";
  /**
   * A trava do player vale neste curso?
   *
   * Ausente é LIGADA. O padrão precisa ser o restritivo: um curso importado
   * sem o campo, ou uma leitura que esqueça a coluna, não pode liberar o
   * avanço em silêncio.
   */
  watchGuard?: boolean;
  /**
   * Nota mínima para o certificado, em percentual (F3-09).
   *
   * Ausente mantém o comportamento histórico: concluir as aulas basta. Um
   * curso existente não passa a exigir prova que ele não tem.
   */
  minGradePercent?: number;
}

export type CourseLevel = "basic" | "intermediate" | "advanced";
export type CourseVisibility = "catalog" | "unlisted";

/** O bastante para exibir e navegar; a árvore completa vem por consulta. */
export interface CourseCategoryRef {
  id: string;
  name: string;
  slug: string;
  /** Nome da categoria mãe, quando esta é subcategoria. */
  parentName?: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

/** Categoria com as filhas — a árvore que a navegação percorre. */
export interface CourseCategory extends CourseCategoryRef {
  children: CourseCategory[];
  /** Cursos publicados nesta categoria e nas descendentes. */
  courseCount: number;
}

/** Como a aula foi dada por concluída. */
export type CompletionSource = "auto" | "manual";

/**
 * Posição do aluno em uma aula.
 *
 * Consumo e conclusão são coisas separadas (guia §5: "assistir 20% do vídeo
 * não necessariamente significa concluir uma aula"), e por isso são três
 * campos e não um:
 *
 * - `watchedSeconds` mede quanto se viu. Só cresce.
 * - `lastPositionSeconds` diz onde parou. Pode diminuir — quem volta para
 *   rever um trecho e sai deve retomar dali, não do ponto mais distante.
 * - `completedAt` registra a conclusão como FATO. Antes ela era recalculada a
 *   cada leitura a partir de `watchedSeconds`, o que tornava impossível
 *   concluir uma aula sem vídeo, desmarcar, ou saber a data real.
 */
export interface LessonProgress {
  lessonId: string;
  watchedSeconds: number;
  /** Onde o vídeo deve recomeçar. */
  lastPositionSeconds: number;
  /** ISO 8601. Ausente enquanto a aula não foi concluída. */
  completedAt?: string;
  completionSource?: CompletionSource;
  /** Páginas do documento por onde passou (aula de conteúdo). */
  pagesSeen?: number[];
  /** Segundos de permanência na aula. Distinto da posição no vídeo. */
  secondsOnPage?: number;
}

export interface Enrollment {
  courseId: string;
  /** Aluno a quem o progresso pertence. */
  learnerId: string;
  /**
   * Quem matriculou. `self` quando o aluno se inscreveu sozinho; o id de um
   * admin quando foi atribuída. As duas formas existem porque a regra ainda
   * não foi decidida — PRD §2, conflito 2.
   */
  enrolledBy: string | "self";
  /** Progresso por aula, indexado por lessonId. */
  progress: Record<string, LessonProgress>;
  /** Última aula aberta pelo aluno, se houver. */
  lastLessonId?: string;
  /** Curso marcado pelo aluno para assistir depois (ícone de bookmark). */
  saved?: boolean;
}

export interface User {
  id: string;
  role: Role;
  firstName: string;
  fullName: string;
  email?: string;
  /**
   * Último acesso registrado. É o que define "usuário ativo" no relatório de
   * período — a métrica que hoje está travada em 500 pela licença. Ver DEC-040.
   */
  lastAccessAt?: string;
  /**
   * Pendente = convidado, ainda não acessou. É o estado que a proposta mostra
   * na gestão de usuários e o que a Kessia hoje controla por planilha.
   */
  status?: "active" | "pending" | "inactive";
  /**
   * Campo a que a pessoa pertence: Unidade Norte, Siririzinho, Riachuelo,
   * Aguilhada. Sem este campo os relatórios por unidade não existem
   * (ISSUE-023).
   */
  project?: string;
  /** Região, pelo mesmo motivo. */
  region?: string;
}

/** Aluno é um usuário com papel `learner`. Mantido por clareza nas telas. */
export type Student = User;

/** Anexo de aula: PDF, planilha ou slide. Vídeo é a aula em si, não material. */
export interface LessonMaterial {
  id: string;
  name: string;
  kind: "pdf" | "spreadsheet" | "slides" | "document";
  /** Tamanho já formatado para leitura, no padrão pt-BR. */
  sizeLabel: string;
}

/**
 * Comentário de aula.
 *
 * `highlighted` é **derivado no servidor** a partir do papel do autor e da
 * autoria do curso (PRD §8). Nunca aceitar este campo vindo do cliente: seria
 * o caminho direto para um aluno se passar por professor.
 */
export interface Comment {
  id: string;
  lessonId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** Resposta a outro comentário, quando houver. */
  parentId?: string;
  /** Exibe a tag "Professor". Derivado, nunca declarado. */
  highlighted: boolean;
  /** Quantas pessoas marcaram como útil. */
  upvotes: number;
  /** Se QUEM ESTÁ VENDO já marcou — o botão precisa saber em que estado nasce. */
  votedByViewer: boolean;
  /** Presente só se foi editado. A tela sinaliza; quem responde merece saber. */
  editedAt?: string;
}
