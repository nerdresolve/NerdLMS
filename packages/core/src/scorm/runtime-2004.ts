/**
 * Modelo de dados do SCORM 2004 — o guia §23 pede 1.2 e 2004.
 *
 * O 2004 não é uma versão nova do 1.2: é outro vocabulário. Um pacote 2004
 * chama `GetValue("cmi.completion_status")` e recebe vazio de uma API 1.2, que
 * só conhece `cmi.core.lesson_status`. O conteúdo não avisa — ele simplesmente
 * não registra progresso, e o aluno refaz a aula achando que é problema dele.
 *
 * AS TRÊS DIFERENÇAS QUE IMPORTAM
 *
 *   CONCLUIR E PASSAR SÃO COISAS SEPARADAS. No 1.2, `lesson_status` guarda as
 *   duas numa palavra só: `passed` implica concluído, e `completed` não diz
 *   nada sobre ter passado. O 2004 divide em `completion_status` (viu tudo?) e
 *   `success_status` (acertou?) — e a divisão é útil: dá para concluir uma aula
 *   e reprovar na prova dela.
 *
 *   O TEMPO É ISO 8601. `PT1H30M` no lugar de `0001:30:00.00`. Formatos
 *   diferentes o bastante para que um parser errado devolva zero em silêncio.
 *
 *   A NOTA É NORMALIZADA. `cmi.score.scaled` vai de -1 a 1, e é a que o padrão
 *   manda usar para decidir aprovação, contra `cmi.scaled_passing_score`. A
 *   nota bruta continua existindo, mas não é mais a autoridade.
 *
 * O `cmi.exit` também é novo, e é ele que diz se a sessão terminou ou foi
 * suspensa — no 1.2 isso se deduzia do `suspend_data`.
 */

export type CompletionStatus = "completed" | "incomplete" | "not attempted" | "unknown";
export type SuccessStatus = "passed" | "failed" | "unknown";
export type ExitMode = "" | "time-out" | "suspend" | "logout" | "normal";

const COMPLETION_VALIDOS: CompletionStatus[] = [
  "completed",
  "incomplete",
  "not attempted",
  "unknown",
];
const SUCCESS_VALIDOS: SuccessStatus[] = ["passed", "failed", "unknown"];
const EXIT_VALIDOS: ExitMode[] = ["", "time-out", "suspend", "logout", "normal"];

export interface Scorm2004State {
  completionStatus: CompletionStatus;
  successStatus: SuccessStatus;
  /** -1 a 1. A nota que o padrão manda usar para decidir aprovação. */
  scoreScaled?: number;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  /** Acumulado entre sessões, em segundos. */
  totalTimeSeconds: number;
  /** Estado interno do conteúdo — opaco para nós, essencial para retomar. */
  suspendData?: string;
  location?: string;
  exit: ExitMode;
  /** Vem do manifesto, não do conteúdo: quanto basta para passar. */
  scaledPassingScore?: number;
}

/**
 * Duração ISO 8601 → segundos.
 *
 * `PT1H30M45S`, `PT30M`, `PT0.5S`. A parte de data (`P1DT...`) existe no
 * padrão e é aceita aqui: um pacote que declare dias não pode zerar o tempo de
 * quem estudou.
 *
 * Devolve 0 no que não casa. O conteúdo é de terceiro, e um valor torto não
 * pode derrubar o salvamento do progresso de quem está estudando.
 */
export function parseIso8601Duration(valor: string): number {
  const texto = valor.trim().toUpperCase();

  const m = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
    texto,
  );
  if (!m) return 0;

  /* `P` sozinho casa o regex e não significa duração nenhuma. */
  if (!/\d/.test(texto)) return 0;

  const num = (v: string | undefined): number => (v === undefined ? 0 : Number(v));

  /* Ano e mês são aproximados por definição — o padrão não fixa a duração
     deles. Aparecem em tempo de curso praticamente nunca; convertê-los com um
     valor médio é melhor que ignorá-los e devolver zero. */
  return (
    num(m[1]) * 365 * 24 * 3600 +
    num(m[2]) * 30 * 24 * 3600 +
    num(m[3]) * 24 * 3600 +
    num(m[4]) * 3600 +
    num(m[5]) * 60 +
    num(m[6])
  );
}

/**
 * Segundos → duração ISO 8601.
 *
 * Sempre com `PT`, nunca com dias: `PT100H` é válido e é o que um LMS espera
 * ver num campo de tempo de estudo. Converter para `P4DT4H` estaria certo pelo
 * padrão e seria ilegível no relatório.
 */
export function formatIso8601Duration(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "PT0S";

  const total = Math.round(segundos * 100) / 100;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round((total % 60) * 100) / 100;

  let saida = "PT";
  if (h > 0) saida += `${h}H`;
  if (m > 0) saida += `${m}M`;
  /* O segundo entra quando é o único componente: `PT` sozinho não é válido. */
  if (s > 0 || saida === "PT") saida += `${s}S`;

  return saida;
}

/**
 * A aula está concluída?
 *
 * Só `completion_status`. `success_status` responde outra pergunta — se a
 * pessoa acertou —, e misturar as duas é o erro que o 2004 existe para
 * corrigir: quem reprova numa prova VIU a aula inteira, e o progresso do curso
 * tem de reconhecer isso.
 */
export function isCompleted2004(state: Scorm2004State): boolean {
  return state.completionStatus === "completed";
}

/**
 * A pessoa passou?
 *
 * O `success_status` que o conteúdo declarou vem primeiro: ele conhece as
 * regras dele. Só quando ele não se pronuncia (`unknown`) a nota decide, e aí
 * pela `scaled` contra o `scaled_passing_score` — que é o que o padrão manda.
 *
 * Sem nota e sem declaração, `false`: não passou é diferente de reprovou, e
 * quem não tem evidência de aprovação não pode receber certificado.
 */
export function isPassed2004(state: Scorm2004State): boolean {
  if (state.successStatus === "passed") return true;
  if (state.successStatus === "failed") return false;

  if (state.scoreScaled === undefined) return false;

  /* Sem nota de corte declarada, qualquer nota registrada passa. É o
     comportamento que o padrão descreve, e o pacote que se importa declara. */
  const corte = state.scaledPassingScore;
  return corte === undefined ? true : state.scoreScaled >= corte;
}

/**
 * `GetValue` — o que o conteúdo lê.
 *
 * Devolve string SEMPRE, e vazio no que não existe: o conteúdo espera string, e
 * `undefined` viraria a palavra "undefined" na tela dele.
 */
export function scorm2004Value(state: Scorm2004State, element: string): string {
  switch (element) {
    case "cmi.completion_status":
      return state.completionStatus;
    case "cmi.success_status":
      return state.successStatus;

    case "cmi.score.scaled":
      return state.scoreScaled !== undefined ? String(state.scoreScaled) : "";
    case "cmi.score.raw":
      return state.scoreRaw !== undefined ? String(state.scoreRaw) : "";
    case "cmi.score.min":
      return state.scoreMin !== undefined ? String(state.scoreMin) : "";
    case "cmi.score.max":
      return state.scoreMax !== undefined ? String(state.scoreMax) : "";

    case "cmi.total_time":
      return formatIso8601Duration(state.totalTimeSeconds);

    case "cmi.suspend_data":
      return state.suspendData ?? "";
    case "cmi.location":
      return state.location ?? "";
    case "cmi.exit":
      return state.exit;

    case "cmi.scaled_passing_score":
      return state.scaledPassingScore !== undefined ? String(state.scaledPassingScore) : "";

    /* Fixos. O conteúdo consulta os dois antes de decidir se registra nota:
       em `no-credit` ou `review`, muitos pacotes não gravam nada. */
    case "cmi.credit":
      return "credit";
    case "cmi.mode":
      return "normal";

    case "cmi.entry":
      /* "resume" faz o conteúdo restaurar o `suspend_data`; "ab-initio" o faz
         começar do zero. É esta linha que liga a retomada. */
      return state.suspendData ? "resume" : "ab-initio";

    /* O 2004 exige que a API declare a versão. Um pacote que leia outra coisa
       aqui pode se recusar a rodar. */
    case "cmi._version":
      return "1.0";

    default:
      return "";
  }
}

/**
 * `SetValue` — o que o conteúdo escreve.
 *
 * Devolve um estado NOVO: o chamador decide quando persistir, e mutar aqui
 * faria o valor mudar debaixo de quem ainda não gravou.
 *
 * Valor inválido é IGNORADO, não gravado. O conteúdo é de terceiro, e um
 * `completion_status` livre quebraria `isCompleted2004` — que é o que decide
 * se a aula conta como feita.
 */
export function setScorm2004Value(
  state: Scorm2004State,
  element: string,
  valor: string,
): Scorm2004State {
  switch (element) {
    case "cmi.completion_status": {
      const status = valor.trim().toLowerCase() as CompletionStatus;
      if (!COMPLETION_VALIDOS.includes(status)) return state;
      return { ...state, completionStatus: status };
    }

    case "cmi.success_status": {
      const status = valor.trim().toLowerCase() as SuccessStatus;
      if (!SUCCESS_VALIDOS.includes(status)) return state;
      return { ...state, successStatus: status };
    }

    case "cmi.score.scaled": {
      const n = Number(valor);
      /* O padrão fixa a faixa em -1 a 1. Fora dela é erro do pacote, e aceitar
         faria uma nota de 85 (que ele quis dizer em bruto) virar aprovação
         absurda contra um corte de 0,7. */
      if (!Number.isFinite(n) || n < -1 || n > 1) return state;
      return { ...state, scoreScaled: n };
    }

    case "cmi.score.raw": {
      const n = Number(valor);
      return Number.isFinite(n) ? { ...state, scoreRaw: n } : state;
    }
    case "cmi.score.min": {
      const n = Number(valor);
      return Number.isFinite(n) ? { ...state, scoreMin: n } : state;
    }
    case "cmi.score.max": {
      const n = Number(valor);
      return Number.isFinite(n) ? { ...state, scoreMax: n } : state;
    }

    case "cmi.session_time": {
      /* Soma ao acumulado. O conteúdo reporta a sessão ATUAL; o total entre
         sessões é conta nossa — e é o que sobrevive a fechar o navegador. */
      const segundos = parseIso8601Duration(valor);
      return segundos > 0
        ? { ...state, totalTimeSeconds: state.totalTimeSeconds + segundos }
        : state;
    }

    case "cmi.suspend_data":
      return { ...state, suspendData: valor };
    case "cmi.location":
      return { ...state, location: valor };

    case "cmi.exit": {
      const modo = valor.trim().toLowerCase() as ExitMode;
      if (!EXIT_VALIDOS.includes(modo)) return state;
      return { ...state, exit: modo };
    }

    /* Somente-leitura pelo padrão: vêm do manifesto ou da plataforma. Um
       pacote que tente escrever recebe o estado inalterado, e não um erro —
       ignorar é o comportamento que o padrão define para elemento de escrita
       proibida quando não há canal de erro. */
    default:
      return state;
  }
}

/**
 * Traduz o estado 2004 para o vocabulário que a plataforma já grava.
 *
 * Existe para que uma aula SCORM seja uma aula, independentemente da versão do
 * pacote: o progresso, a nota e a conclusão entram nas mesmas colunas, e nada
 * fora deste arquivo precisa saber se o conteúdo era 1.2 ou 2004.
 */
export function to2004Summary(state: Scorm2004State): {
  completed: boolean;
  passed: boolean;
  /** 0 a 100, para a coluna de nota. */
  scorePercent: number | null;
  totalTimeSeconds: number;
} {
  /* A `scaled` primeiro, porque é a autoridade no 2004. A bruta só entra
     quando não há scaled E há uma faixa declarada — sem `max`, um "80" pode
     ser 80 de 100 ou 80 de 500. */
  let percentual: number | null = null;

  if (state.scoreScaled !== undefined) {
    percentual = Math.round(state.scoreScaled * 100);
  } else if (state.scoreRaw !== undefined && state.scoreMax !== undefined && state.scoreMax > 0) {
    const min = state.scoreMin ?? 0;
    const faixa = state.scoreMax - min;
    percentual = faixa > 0 ? Math.round(((state.scoreRaw - min) / faixa) * 100) : null;
  }

  return {
    completed: isCompleted2004(state),
    passed: isPassed2004(state),
    scorePercent: percentual === null ? null : Math.max(0, Math.min(100, percentual)),
    totalTimeSeconds: state.totalTimeSeconds,
  };
}
