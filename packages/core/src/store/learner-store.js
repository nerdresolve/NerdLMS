/**
 * Estado do aluno no protótipo — TASK-042.
 *
 * Escrito em JavaScript puro, com tipos em JSDoc, por um motivo prático: este
 * mesmo arquivo é carregado pelo navegador no protótipo estático **e** importado
 * pelo app React. Se fosse TypeScript, o protótipo precisaria de uma cópia — e
 * cópia de regra é o que faz duas telas discordarem sobre o mesmo número.
 *
 * O que ele NÃO é: um cliente de API. Quando o backend existir (TASK-004/006),
 * `hydrate` passa a receber a resposta do servidor e cada ação vira uma chamada;
 * a forma do estado e os seletores não mudam.
 *
 * Persistência: `sessionStorage`, para o estado sobreviver à navegação entre as
 * telas do protótipo. Se o navegador bloquear (aba anônima, política restrita),
 * cai para memória e a plataforma continua funcionando — só não lembra ao trocar
 * de tela. Nunca guarda dado sensível: só ids de curso, aula e texto do próprio
 * aluno.
 */

const STORAGE_KEY = "nerdlms.learner.v1";

/**
 * Formas do rascunho. São descritas aqui, e não importadas de
 * `../courses/types.ts`, porque este arquivo é carregado direto pelo
 * navegador no protótipo (DEC-031): um `import` de tipo apontaria para um
 * módulo que só existe depois do build.
 *
 * @typedef {Object} DraftLesson
 * @property {string} id
 * @property {string} title
 * @property {number} durationSeconds
 */

/**
 * @typedef {Object} DraftModule
 * @property {string} id
 * @property {string} title
 * @property {DraftLesson[]} lessons
 */

/**
 * @typedef {Object} DraftCourse
 * @property {string} id
 * @property {string} title
 * @property {string} [status]
 * @property {DraftModule[]} modules
 */

/**
 * @typedef {Object} StoredComment
 * @property {string} id
 * @property {string} lessonId
 * @property {string} authorId
 * @property {string} authorName
 * @property {string} body
 * @property {string} createdAt
 * @property {boolean} highlighted
 * @property {string} [parentId]
 */

/**
 * @typedef {Object} LearnerState
 * @property {Record<string, number>} progress  segundos assistidos por aula
 * @property {Record<string, true>} saved       cursos marcados para depois
 * @property {Record<string, true>} enrolled    matrículas do aluno
 * @property {StoredComment[]} comments         comentários, inclusive os novos
 * @property {Record<string, DraftCourse>} drafts cursos em edição pelo instrutor
 */

/** @returns {LearnerState} */
function emptyState() {
  return { progress: {}, saved: {}, enrolled: {}, comments: [], drafts: {} };
}

/**
 * Percentual de conclusão. É a mesma regra de `courseProgress` em
 * `../courses/progress.ts`, e existe um teste que compara as duas — se
 * divergirem, ele quebra.
 *
 * @param {number} completed
 * @param {number} total
 * @returns {number} inteiro de 0 a 100
 */
export function percentOf(completed, total) {
  // Curso vazio é 0%, não 100%: não existe conquista sem conteúdo.
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/** Fração assistida a partir da qual a aula conta como concluída. */
export const COMPLETION_THRESHOLD = 0.9;

/**
 * @param {number} watchedSeconds
 * @param {number} durationSeconds
 */
export function isComplete(watchedSeconds, durationSeconds) {
  if (!(durationSeconds > 0)) return false;
  return watchedSeconds / durationSeconds >= COMPLETION_THRESHOLD - 1e-9;
}

export function createStore() {
  /** @type {LearnerState} */
  let state = emptyState();
  /** @type {Set<() => void>} */
  const listeners = new Set();
  /** @type {Storage | null} */
  let storage = null;

  try {
    // Um acesso de teste: navegadores que bloqueiam storage lançam já aqui.
    globalThis.sessionStorage?.getItem(STORAGE_KEY);
    storage = globalThis.sessionStorage ?? null;
  } catch {
    storage = null;
  }

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Cota cheia ou modo restrito: seguir sem persistir é melhor que quebrar.
    }
  }

  function emit() {
    persist();
    for (const listener of listeners) listener();
  }

  return {
    /**
     * Estado inicial vindo do servidor (hoje, dos dados fictícios).
     * @param {Partial<LearnerState>} seed
     */
    hydrate(seed) {
      const saved = storage?.getItem(STORAGE_KEY);
      if (saved) {
        try {
          state = { ...emptyState(), ...JSON.parse(saved) };
          return;
        } catch {
          // JSON corrompido: recomeça do seed em vez de travar a tela.
        }
      }
      state = { ...emptyState(), ...seed };
      persist();
    },

    getState() {
      return state;
    },

    /** @param {() => void} listener */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Marca a aula como concluída registrando a duração inteira.
     * @param {string} lessonId
     * @param {number} durationSeconds
     */
    completeLesson(lessonId, durationSeconds) {
      state = { ...state, progress: { ...state.progress, [lessonId]: durationSeconds } };
      emit();
    },

    /**
     * Registra a posição assistida, sem nunca retroceder o máximo alcançado.
     * @param {string} lessonId
     * @param {number} seconds
     */
    trackProgress(lessonId, seconds) {
      const current = state.progress[lessonId] ?? 0;
      if (seconds <= current) return;
      state = { ...state, progress: { ...state.progress, [lessonId]: seconds } };
      emit();
    },

    /**
     * @param {string} lessonId
     * @param {number} durationSeconds
     */
    isLessonComplete(lessonId, durationSeconds) {
      return isComplete(state.progress[lessonId] ?? 0, durationSeconds);
    },

    /** @param {string} courseId */
    toggleSaved(courseId) {
      const saved = { ...state.saved };
      if (saved[courseId]) delete saved[courseId];
      else saved[courseId] = true;
      state = { ...state, saved };
      emit();
    },

    /** @param {string} courseId */
    isSaved(courseId) {
      return state.saved[courseId] === true;
    },

    /** @param {string} courseId */
    enroll(courseId) {
      if (state.enrolled[courseId]) return;
      state = { ...state, enrolled: { ...state.enrolled, [courseId]: true } };
      emit();
    },

    /** @param {string} courseId */
    isEnrolled(courseId) {
      return state.enrolled[courseId] === true;
    },

    /**
     * Acrescenta um comentário.
     *
     * `highlighted` **não** é parâmetro: o destaque de professor é decidido pelo
     * papel e pela autoria do curso, no servidor (PRD §8). Aqui o autor é sempre
     * o aluno, então é sempre falso.
     *
     * O parâmetro aceita campos extras de propósito: existe um teste que passa
     * `highlighted: true` simulando um payload adulterado, e a store precisa
     * ignorá-lo em vez de recusar a chamada no compilador.
     *
     * @param {{ lessonId: string, authorId: string, authorName: string, body: string, parentId?: string } & Record<string, unknown>} dados
     * @returns {StoredComment}
     */
    addComment({ lessonId, authorId, authorName, body, parentId }) {
      const comment = {
        id: `local-${Date.now()}-${state.comments.length}`,
        lessonId,
        authorId,
        authorName,
        body: body.trim(),
        createdAt: new Date().toISOString(),
        highlighted: false,
        ...(parentId ? { parentId } : {}),
      };
      state = { ...state, comments: [...state.comments, comment] };
      emit();
      return comment;
    },

    /** @param {string} lessonId */
    commentsFor(lessonId) {
      return state.comments.filter((comment) => comment.lessonId === lessonId);
    },

    /* ------------------------------------------------ edição de curso ----
       Estas ações pertencem ao Instructor. A autorização real acontece no
       servidor (`can(actor, "update", curso)`); aqui elas só existem para a
       tela funcionar antes da API. */

    /**
     * Carrega um curso para edição, se ainda não estiver em rascunho.
     * @param {DraftCourse} course
     * @returns {DraftCourse}
     */
    openDraft(course) {
      const existing = state.drafts[course.id];
      if (existing) return existing;
      /** @type {DraftCourse} */
      const draft = JSON.parse(JSON.stringify(course));
      state = { ...state, drafts: { ...state.drafts, [course.id]: draft } };
      emit();
      return draft;
    },

    /**
     * @param {string} courseId
     * @returns {DraftCourse | null}
     */
    getDraft(courseId) {
      return state.drafts[courseId] ?? null;
    },

    /**
     * @param {string} courseId
     * @param {Partial<DraftCourse>} changes
     * @returns {DraftCourse | null}
     */
    updateDraft(courseId, changes) {
      const draft = state.drafts[courseId];
      if (!draft) return null;
      const next = { ...draft, ...changes };
      state = { ...state, drafts: { ...state.drafts, [courseId]: next } };
      emit();
      return next;
    },

    /**
     * @param {string} courseId
     * @param {string} title
     * @returns {DraftModule | null}
     */
    addModule(courseId, title) {
      const draft = state.drafts[courseId];
      if (!draft) return null;
      const module = {
        id: `${courseId}-m${draft.modules.length + 1}-${Date.now()}`,
        title: title.trim() || `Módulo ${draft.modules.length + 1}`,
        lessons: [],
      };
      const next = { ...draft, modules: [...draft.modules, module] };
      state = { ...state, drafts: { ...state.drafts, [courseId]: next } };
      emit();
      return module;
    },

    /**
     * @param {string} courseId
     * @param {string} moduleId
     */
    removeModule(courseId, moduleId) {
      const draft = state.drafts[courseId];
      if (!draft) return;
      const next = { ...draft, modules: draft.modules.filter((module) => module.id !== moduleId) };
      state = { ...state, drafts: { ...state.drafts, [courseId]: next } };
      emit();
    },

    /**
     * Acrescenta uma aula ao módulo.
     *
     * `durationMinutes` é `unknown` de propósito: vem de um `<input>`, que
     * entrega string, e a pessoa pode digitar qualquer coisa. Declarar
     * `number` obrigaria a converter antes de chamar — e o lugar certo de
     * tratar entrada inválida é aqui, uma vez, não em cada chamada.
     *
     * @param {string} courseId
     * @param {string} moduleId
     * @param {{ title: string, durationMinutes: unknown }} dados
     * @returns {DraftLesson | null}
     */
    addLesson(courseId, moduleId, { title, durationMinutes }) {
      const draft = state.drafts[courseId];
      if (!draft) return null;

      // Duração inválida vira 0 em vez de NaN: NaN contamina todo o cálculo
      // de progresso adiante.
      const minutes = Number(durationMinutes);
      const durationSeconds = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0;

      /** @type {DraftLesson | null} */
      let created = null;
      const modules = draft.modules.map((module) => {
        if (module.id !== moduleId) return module;
        created = {
          id: `${moduleId}-l${module.lessons.length + 1}-${Date.now()}`,
          title: title.trim() || `Aula ${module.lessons.length + 1}`,
          durationSeconds,
        };
        return { ...module, lessons: [...module.lessons, created] };
      });

      state = { ...state, drafts: { ...state.drafts, [courseId]: { ...draft, modules } } };
      emit();
      return created;
    },

    /**
     * @param {string} courseId
     * @param {string} moduleId
     * @param {string} lessonId
     */
    removeLesson(courseId, moduleId, lessonId) {
      const draft = state.drafts[courseId];
      if (!draft) return;
      const modules = draft.modules.map((module) =>
        module.id === moduleId
          ? { ...module, lessons: module.lessons.filter((lesson) => lesson.id !== lessonId) }
          : module,
      );
      state = { ...state, drafts: { ...state.drafts, [courseId]: { ...draft, modules } } };
      emit();
    },

    /**
     * Publica o rascunho.
     *
     * Recusa curso sem aula: publicar um curso vazio matricularia alunos em
     * nada, e o progresso de um curso sem aulas é 0% para sempre.
     * @param {string} courseId
     * @returns {{ok: true, reason?: undefined} | {ok: false, reason: string}}
     */
    publishDraft(courseId) {
      const draft = state.drafts[courseId];
      if (!draft) return { ok: false, reason: "Curso não encontrado." };

      const lessons = draft.modules.reduce((total, module) => total + module.lessons.length, 0);
      if (lessons === 0) {
        return { ok: false, reason: "Adicione ao menos uma aula antes de publicar." };
      }
      if (!draft.title.trim()) {
        return { ok: false, reason: "O curso precisa de um título." };
      }

      const next = { ...draft, status: "published" };
      state = { ...state, drafts: { ...state.drafts, [courseId]: next } };
      emit();
      return { ok: true };
    },

    /**
     * Volta ao estado fornecido. Usado pelo protótipo para reiniciar a demo.
     * @param {Partial<LearnerState>} seed
     */
    reset(seed) {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        /* sem storage, nada a limpar */
      }
      state = { ...emptyState(), ...seed };
      emit();
    },

    get persists() {
      return storage !== null;
    },
  };
}

/** Instância única. O app React e o protótipo compartilham esta. */
export const learnerStore = createStore();
