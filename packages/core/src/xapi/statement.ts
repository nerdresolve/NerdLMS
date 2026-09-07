/**
 * xAPI — statements — F6-03 (guia §26).
 *
 * Um statement é uma frase: **ator, verbo, objeto**. "Maria completou a
 * simulação de parada de bomba." O resto — resultado, contexto, tempo — é
 * detalhe dessa frase.
 *
 * O que o xAPI resolve, e que este produto não resolvia: registrar aprendizado
 * que aconteceu FORA da plataforma. Um simulador, um treinamento presencial
 * apontado num tablet, um app de campo sem rede que sincroniza depois.
 *
 * Este arquivo é puro: valida e normaliza. Guardar é do backend.
 */

/** Os verbos do vocabulário ADL, que é o que outros sistemas entendem. */
export const VERBS = {
  completed: {
    id: "http://adlnet.gov/expapi/verbs/completed",
    display: "completou",
  },
  passed: {
    id: "http://adlnet.gov/expapi/verbs/passed",
    display: "foi aprovado em",
  },
  failed: {
    id: "http://adlnet.gov/expapi/verbs/failed",
    display: "não foi aprovado em",
  },
  experienced: {
    id: "http://adlnet.gov/expapi/verbs/experienced",
    display: "acessou",
  },
  attended: {
    id: "http://adlnet.gov/expapi/verbs/attended",
    display: "participou de",
  },
  answered: {
    id: "http://adlnet.gov/expapi/verbs/answered",
    display: "respondeu",
  },
  initialized: {
    id: "http://adlnet.gov/expapi/verbs/initialized",
    display: "iniciou",
  },
  progressed: {
    id: "http://adlnet.gov/expapi/verbs/progressed",
    display: "avançou em",
  },
  /** Anulação: o mecanismo que o padrão define no lugar de apagar. */
  voided: {
    id: "http://adlnet.gov/expapi/verbs/voided",
    display: "anulou",
  },
} as const;

export type VerbKey = keyof typeof VERBS;

export interface StatementActor {
  /** `mailto:` no padrão; aceitamos o e-mail cru e normalizamos. */
  mbox?: string;
  name?: string;
  /** Conta em outro sistema, quando não há e-mail. */
  account?: { homePage: string; name: string };
}

export interface StatementObject {
  id: string;
  name?: string;
  description?: string;
  objectType?: string;
}

export interface StatementResult {
  success?: boolean;
  completion?: boolean;
  score?: { scaled?: number; raw?: number; min?: number; max?: number };
  /** ISO 8601 de duração: "PT1H30M". */
  duration?: string;
  response?: string;
}

export interface Statement {
  id?: string;
  actor: StatementActor;
  verb: { id: string; display?: Record<string, string> };
  object: StatementObject;
  result?: StatementResult;
  context?: {
    registration?: string;
    extensions?: Record<string, unknown>;
  };
  timestamp?: string;
}

/**
 * Duração ISO 8601 em segundos.
 *
 * O padrão manda "PT1H30M45S". Guardamos segundos porque é o que se soma num
 * relatório — converter na leitura obrigaria a fazê-lo em toda consulta.
 *
 * Aceita fração no segundo ("PT4.5S"): o padrão permite, e simuladores a usam.
 * Dia, mês e ano são aceitos porque a gramática os define; a aproximação de mês
 * é registrada onde ela existe.
 */
export function parseIsoDuration(duracao: string): number | null {
  const casamento =
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      duracao.trim(),
    );

  if (!casamento) return null;

  const [, anos, meses, semanas, dias, horas, minutos, segundos] = casamento;

  /* "P" sozinho casa a expressão mas não é duração nenhuma. */
  if (![anos, meses, semanas, dias, horas, minutos, segundos].some((v) => v !== undefined)) {
    return null;
  }

  const n = (valor: string | undefined) => (valor === undefined ? 0 : Number(valor));

  /* Ano e mês são aproximados — 365 dias e 30 dias. É o que dá para fazer sem
     uma data de referência, e uma duração de treinamento em anos é cenário
     artificial: o que aparece de verdade é hora e minuto. */
  return Math.round(
    n(anos) * 365 * 86400 +
      n(meses) * 30 * 86400 +
      n(semanas) * 7 * 86400 +
      n(dias) * 86400 +
      n(horas) * 3600 +
      n(minutos) * 60 +
      n(segundos),
  );
}

/** Segundos de volta para ISO 8601, para o statement que sai daqui. */
export function toIsoDuration(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));

  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = total % 60;

  /* "PT0S" e não "PT": duração zero é duração, e "PT" sozinho é inválido. */
  if (total === 0) return "PT0S";

  return `PT${horas > 0 ? `${horas}H` : ""}${minutos > 0 ? `${minutos}M` : ""}${resto > 0 ? `${resto}S` : ""}`;
}

/** O e-mail do ator, sem o `mailto:` e em minúsculas. */
export function actorEmail(actor: StatementActor): string | null {
  if (!actor.mbox) return null;

  const email = actor.mbox.replace(/^mailto:/i, "").trim().toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export type ValidationError =
  | "missing_actor"
  | "missing_verb"
  | "missing_object"
  | "invalid_verb_iri"
  | "invalid_object_iri"
  | "invalid_score"
  | "invalid_timestamp"
  | "invalid_id";

export interface ValidStatement {
  id: string | null;
  actorEmail: string | null;
  actorName: string | null;
  verbId: string;
  verbDisplay: string;
  objectId: string;
  objectName: string | null;
  objectType: string;
  success: boolean | null;
  completion: boolean | null;
  scoreScaled: number | null;
  scoreRaw: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  durationSeconds: number | null;
  response: string | null;
  timestamp: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Confere e normaliza um statement recebido.
 *
 * RECUSA em vez de consertar. Um LRS que "corrige" o que chega devolve, na
 * consulta, algo diferente do que foi mandado — e quem integra passa a
 * depender de uma correção que não está escrita em lugar nenhum. Melhor um 400
 * com o motivo.
 */
export function validateStatement(
  entrada: unknown,
): { ok: true; statement: ValidStatement } | { ok: false; error: ValidationError } {
  if (typeof entrada !== "object" || entrada === null) {
    return { ok: false, error: "missing_actor" };
  }

  const bruto = entrada as Partial<Statement>;

  if (typeof bruto.actor !== "object" || bruto.actor === null) {
    return { ok: false, error: "missing_actor" };
  }

  if (typeof bruto.verb !== "object" || bruto.verb === null || typeof bruto.verb.id !== "string") {
    return { ok: false, error: "missing_verb" };
  }

  if (
    typeof bruto.object !== "object" ||
    bruto.object === null ||
    typeof bruto.object.id !== "string"
  ) {
    return { ok: false, error: "missing_object" };
  }

  /* IRI de verdade, não uma palavra. É o IRI que torna o verbo comparável
     entre sistemas — "completed" solto não significa nada fora daqui. */
  if (!/^https?:\/\/.+/.test(bruto.verb.id)) {
    return { ok: false, error: "invalid_verb_iri" };
  }

  if (!/^https?:\/\/.+/.test(bruto.object.id)) {
    return { ok: false, error: "invalid_object_iri" };
  }

  if (bruto.id !== undefined && (typeof bruto.id !== "string" || !UUID.test(bruto.id))) {
    return { ok: false, error: "invalid_id" };
  }

  const result = bruto.result;
  const score = result?.score;

  if (score?.scaled !== undefined) {
    /* O padrão define `scaled` entre -1 e 1. Fora disso é erro de quem envia, e
       aceitar produziria um percentual absurdo em qualquer relatório. */
    if (
      typeof score.scaled !== "number" ||
      !Number.isFinite(score.scaled) ||
      score.scaled < -1 ||
      score.scaled > 1
    ) {
      return { ok: false, error: "invalid_score" };
    }
  }

  let timestamp = new Date().toISOString();

  if (bruto.timestamp !== undefined) {
    const data = new Date(bruto.timestamp);
    if (Number.isNaN(data.getTime())) return { ok: false, error: "invalid_timestamp" };
    timestamp = data.toISOString();
  }

  /* O display vem num mapa por idioma. Preferimos português, caímos para
     inglês, e por fim para o que houver — um verbo sem nenhum display legível
     ainda tem o IRI, que é o que importa para máquina. */
  const display = bruto.verb.display ?? {};
  const verbDisplay =
    display["pt-BR"] ??
    display["pt"] ??
    display["en-US"] ??
    display["en"] ??
    Object.values(display)[0] ??
    bruto.verb.id.split("/").pop() ??
    "fez";

  const duracao = result?.duration ? parseIsoDuration(result.duration) : null;

  return {
    ok: true,
    statement: {
      id: bruto.id ?? null,
      actorEmail: actorEmail(bruto.actor),
      actorName: bruto.actor.name ?? null,
      verbId: bruto.verb.id,
      verbDisplay,
      objectId: bruto.object.id,
      objectName: bruto.object.name ?? null,
      objectType: bruto.object.objectType ?? "Activity",
      success: typeof result?.success === "boolean" ? result.success : null,
      completion: typeof result?.completion === "boolean" ? result.completion : null,
      scoreScaled: typeof score?.scaled === "number" ? score.scaled : null,
      scoreRaw: typeof score?.raw === "number" ? score.raw : null,
      scoreMin: typeof score?.min === "number" ? score.min : null,
      scoreMax: typeof score?.max === "number" ? score.max : null,
      durationSeconds: duracao,
      response: typeof result?.response === "string" ? result.response : null,
      timestamp,
    },
  };
}

export const VALIDATION_MESSAGE: Record<ValidationError, string> = {
  missing_actor: "O statement precisa de um `actor`.",
  missing_verb: "O statement precisa de um `verb` com `id`.",
  missing_object: "O statement precisa de um `object` com `id`.",
  invalid_verb_iri: "O `verb.id` precisa ser um IRI (http:// ou https://).",
  invalid_object_iri: "O `object.id` precisa ser um IRI (http:// ou https://).",
  invalid_score: "O `result.score.scaled` precisa estar entre -1 e 1.",
  invalid_timestamp: "O `timestamp` não é uma data válida.",
  invalid_id: "O `id` precisa ser um UUID.",
};

/**
 * Monta o statement que a PLATAFORMA gera para as próprias ações.
 *
 * É o outro lado do LRS: além de receber de fora, o produto registra o que
 * acontece dentro dele no mesmo formato. Sem isso, um relatório de xAPI teria
 * só metade da história — e a metade que falta é a que a plataforma conhece
 * melhor.
 */
export function buildStatement(input: {
  baseUrl: string;
  actorEmail: string | null;
  actorName: string;
  verb: VerbKey;
  objectPath: string;
  objectName: string;
  objectType?: string;
  result?: StatementResult;
  timestamp?: string;
}): Statement {
  const verbo = VERBS[input.verb];

  return {
    actor: {
      ...(input.actorEmail ? { mbox: `mailto:${input.actorEmail}` } : {}),
      name: input.actorName,
    },
    verb: {
      id: verbo.id,
      display: { "pt-BR": verbo.display, "en-US": input.verb },
    },
    object: {
      /* O IRI do objeto é a URL dele nesta instalação: é o que torna o
         statement rastreável de volta ao que aconteceu, e o que distingue a
         aula 5 daqui da aula 5 de outro cliente. */
      id: `${input.baseUrl}${input.objectPath}`,
      name: input.objectName,
      objectType: input.objectType ?? "Activity",
    },
    ...(input.result ? { result: input.result } : {}),
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}
