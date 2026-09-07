/**
 * Modelo de dados do SCORM 1.2 — F5-03.
 *
 * O conteúdo SCORM é um pacote de terceiro que roda num iframe e conversa com
 * a plataforma por uma API JavaScript (`window.API`). Ele chama
 * `LMSGetValue("cmi.core.lesson_status")`, `LMSSetValue(...)` e espera strings
 * exatamente no formato do padrão.
 *
 * Estas funções são a tradução entre aquele vocabulário e o nosso — e vivem no
 * domínio, puras, porque a mesma regra decide o que gravar no servidor e o que
 * devolver ao conteúdo.
 *
 * **Os nomes espelham o padrão de propósito.** Traduzir `cmi.core.lesson_status`
 * para um vocabulário próprio criaria uma camada de conversão que erra na
 * primeira divergência — e divergência com conteúdo de terceiro é indepurável.
 */

/** Os oito valores que o 1.2 admite. */
export type LessonStatus =
  | "passed"
  | "completed"
  | "failed"
  | "incomplete"
  | "browsed"
  | "not attempted";

const STATUS_VALIDOS: LessonStatus[] = [
  "passed",
  "completed",
  "failed",
  "incomplete",
  "browsed",
  "not attempted",
];

export interface ScormState {
  lessonStatus: LessonStatus;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  /** Acumulado entre sessões, em segundos. */
  totalTimeSeconds: number;
  /** Estado interno do conteúdo — opaco para nós, essencial para retomar. */
  suspendData?: string;
  lessonLocation?: string;
}

/**
 * `HHHH:MM:SS.SS` → segundos.
 *
 * Devolve 0 no que não casa: o conteúdo é de terceiro, e um valor torto não
 * pode derrubar o salvamento do progresso de quem está estudando.
 */
export function parseCmiTime(valor: string): number {
  const m = /^(\d{2,4}):([0-5]\d):([0-5]\d)(\.\d{1,2})?$/.exec(valor.trim());
  if (!m) return 0;

  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  const segundos = Number(m[3]);
  const centesimos = m[4] ? Number(m[4]) : 0;

  return horas * 3600 + minutos * 60 + segundos + centesimos;
}

/** Segundos → `HHHH:MM:SS`, como o padrão espera. */
export function formatCmiTime(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Se o SCORM conta como concluído.
 *
 * `failed` NÃO conclui: reprovado é diferente de terminado, e quem reprovou
 * precisa refazer. `browsed` também não — é quem passou os olhos sem fazer.
 */
export function isCompleted(state: ScormState): boolean {
  return state.lessonStatus === "completed" || state.lessonStatus === "passed";
}

/**
 * Se aprovou.
 *
 * O `passed` explícito ganha da nota de corte: se o próprio conteúdo diz que
 * passou, ele conhece a regra dele melhor que nós.
 *
 * Com nota de corte declarada e SEM nota registrada, reprova — liberar seria
 * aprovar quem não foi medido.
 */
export function isPassed(state: ScormState, masteryScore: number | undefined): boolean {
  if (state.lessonStatus === "passed") return true;
  if (state.lessonStatus === "failed") return false;

  if (masteryScore !== undefined) {
    return state.scoreRaw !== undefined && state.scoreRaw >= masteryScore;
  }

  return isCompleted(state);
}

/**
 * `LMSGetValue` — o que o conteúdo lê.
 *
 * Devolve string SEMPRE, e vazio no que não existe: o conteúdo espera string, e
 * `undefined` viraria a palavra "undefined" na tela dele.
 */
export function scormValue(state: ScormState, element: string): string {
  switch (element) {
    case "cmi.core.lesson_status":
      return state.lessonStatus;

    case "cmi.core.score.raw":
      return state.scoreRaw !== undefined ? String(state.scoreRaw) : "";
    case "cmi.core.score.min":
      return state.scoreMin !== undefined ? String(state.scoreMin) : "";
    case "cmi.core.score.max":
      return state.scoreMax !== undefined ? String(state.scoreMax) : "";

    case "cmi.core.total_time":
      return formatCmiTime(state.totalTimeSeconds);

    case "cmi.suspend_data":
      return state.suspendData ?? "";
    case "cmi.core.lesson_location":
      return state.lessonLocation ?? "";

    /* Fixos. O conteúdo consulta os dois antes de decidir se registra nota:
       em `no-credit` ou `review`, muitos pacotes não gravam nada. */
    case "cmi.core.credit":
      return "credit";
    case "cmi.core.lesson_mode":
      return "normal";

    case "cmi.core.entry":
      /* "resume" faz o conteúdo restaurar o `suspend_data`; "ab-initio" o faz
         começar do zero. É esta linha que liga a retomada. */
      return state.suspendData ? "resume" : "ab-initio";

    default:
      return "";
  }
}

/**
 * `LMSSetValue` — o que o conteúdo escreve.
 *
 * Devolve um estado NOVO: o chamador decide quando persistir, e mutar aqui
 * faria o valor mudar debaixo de quem ainda não gravou.
 *
 * Valor inválido é IGNORADO, não gravado: um `lesson_status` livre quebraria
 * `isCompleted`, e o conteúdo é de terceiro.
 */
export function setScormValue(state: ScormState, element: string, valor: string): ScormState {
  switch (element) {
    case "cmi.core.lesson_status": {
      const status = valor.trim().toLowerCase() as LessonStatus;
      if (!STATUS_VALIDOS.includes(status)) return state;
      return { ...state, lessonStatus: status };
    }

    case "cmi.core.score.raw": {
      const n = Number(valor);
      return Number.isFinite(n) ? { ...state, scoreRaw: n } : state;
    }
    case "cmi.core.score.min": {
      const n = Number(valor);
      return Number.isFinite(n) ? { ...state, scoreMin: n } : state;
    }
    case "cmi.core.score.max": {
      const n = Number(valor);
      return Number.isFinite(n) ? { ...state, scoreMax: n } : state;
    }

    /* A sessão SOMA no total. O SCORM informa só a duração da sessão atual, e
       é por isso que `total_time` é campo separado e somente-leitura. */
    case "cmi.core.session_time":
      return { ...state, totalTimeSeconds: state.totalTimeSeconds + parseCmiTime(valor) };

    case "cmi.suspend_data":
      return { ...state, suspendData: valor };
    case "cmi.core.lesson_location":
      return { ...state, lessonLocation: valor };

    /* `total_time`, `credit`, `lesson_mode` e `entry` são somente-leitura no
       padrão. Aceitar escrita neles deixaria o conteúdo forjar o tempo total. */
    default:
      return state;
  }
}
