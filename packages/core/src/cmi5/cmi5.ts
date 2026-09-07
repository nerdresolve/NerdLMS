/**
 * cmi5 — o guia §26, que pede a camada, não "mais um formato de upload".
 *
 * cmi5 é uma especificação SOBRE xAPI. O LRS já existe neste produto; o que
 * faltava é o contrato que transforma statements soltos numa sessão de curso
 * com começo, fim e resultado — que é o que distingue cmi5 de xAPI cru.
 *
 * O QUE cmi5 RESOLVE QUE O xAPI NÃO RESOLVE
 *
 * xAPI aceita qualquer verbo sobre qualquer objeto. Isso é poderoso e
 * inutilizável para dizer se alguém concluiu um curso: dois conteúdos podem
 * relatar a mesma coisa de formas diferentes, e a plataforma não tem como
 * comparar. cmi5 fixa nove verbos, define QUEM pode emitir cada um — a
 * plataforma ou o conteúdo — e amarra tudo a uma sessão identificada.
 *
 * A REGRA QUE MAIS IMPORTA: `moveOn`.
 *
 * É a unidade que diz o que basta para dar o curso por cumprido — só
 * concluído, só aprovado, os dois, qualquer um, ou nada. Sem ela, a plataforma
 * teria de adivinhar se um `passed` sem `completed` vale, e a resposta muda por
 * conteúdo. Com ela, o autor declara e a plataforma obedece.
 */

/** Os verbos que o cmi5 define, e mais ninguém pode inventar. */
export const CMI5_VERBS = {
  /** A PLATAFORMA emite ao abrir a unidade. */
  launched: "http://adlnet.gov/expapi/verbs/launched",
  /** O CONTEÚDO emite ao começar. */
  initialized: "http://adlnet.gov/expapi/verbs/initialized",
  /** O CONTEÚDO emite ao terminar normalmente. */
  terminated: "http://adlnet.gov/expapi/verbs/terminated",
  /** O CONTEÚDO emite ao ser fechado sem terminar. */
  abandoned: "https://w3id.org/xapi/adl/verbs/abandoned",
  completed: "http://adlnet.gov/expapi/verbs/completed",
  passed: "http://adlnet.gov/expapi/verbs/passed",
  failed: "http://adlnet.gov/expapi/verbs/failed",
  /** A PLATAFORMA emite quando a unidade é dispensada. */
  waived: "https://w3id.org/xapi/adl/verbs/waived",
  /** A PLATAFORMA emite quando o `moveOn` foi satisfeito. */
  satisfied: "https://w3id.org/xapi/adl/verbs/satisfied",
} as const;

export type Cmi5Verb = keyof typeof CMI5_VERBS;

const POR_IRI = new Map<string, Cmi5Verb>(
  Object.entries(CMI5_VERBS).map(([chave, iri]) => [iri as string, chave as Cmi5Verb]),
);

export function verbFromIri(iri: string): Cmi5Verb | null {
  return POR_IRI.get(iri) ?? null;
}

/**
 * Quem pode emitir cada verbo.
 *
 * Não é burocracia: um conteúdo que emitisse `satisfied` estaria decidindo
 * sozinho que o curso foi cumprido, ignorando o `moveOn` que o próprio autor
 * declarou. A separação é o que mantém a decisão com a plataforma.
 */
const DO_CONTEUDO: Cmi5Verb[] = ["initialized", "terminated", "abandoned", "completed", "passed", "failed"];
const DA_PLATAFORMA: Cmi5Verb[] = ["launched", "waived", "satisfied"];

export function podeSerEmitidoPeloConteudo(verbo: Cmi5Verb): boolean {
  return DO_CONTEUDO.includes(verbo);
}

export function ehDaPlataforma(verbo: Cmi5Verb): boolean {
  return DA_PLATAFORMA.includes(verbo);
}

/**
 * O critério de conclusão declarado pelo autor, no curso.
 *
 * `NotApplicable` existe para a unidade que é só leitura — um vídeo
 * introdutório que ninguém "passa" nem "conclui" formalmente. Sem esse valor,
 * o autor seria obrigado a escolher um critério que não se aplica, e a unidade
 * ficaria pendente para sempre.
 */
export type MoveOn =
  | "Passed"
  | "Completed"
  | "CompletedAndPassed"
  | "CompletedOrPassed"
  | "NotApplicable";

export const MOVE_ON_VALIDOS: MoveOn[] = [
  "Passed",
  "Completed",
  "CompletedAndPassed",
  "CompletedOrPassed",
  "NotApplicable",
];

export interface SessionState {
  /** Marcado quando o conteúdo emitiu `completed`. */
  completed: boolean;
  /** `true` passou, `false` reprovou, `null` não se pronunciou. */
  passed: boolean | null;
  /** A unidade foi dispensada pela plataforma. */
  waived: boolean;
  /** O conteúdo emitiu `terminated` ou `abandoned`. */
  encerrada: boolean;
}

/**
 * O `moveOn` foi satisfeito?
 *
 * É a única pergunta que decide se a unidade conta como cumprida, e o autor
 * respondeu quando escolheu o critério. A plataforma não interpreta: aplica.
 *
 * A dispensa vale para qualquer critério — quem foi dispensado não precisa
 * fazer, e é justamente esse o sentido de dispensar.
 */
export function moveOnSatisfeito(moveOn: MoveOn, estado: SessionState): boolean {
  if (estado.waived) return true;

  switch (moveOn) {
    case "NotApplicable":
      /* Nada a satisfazer: basta o conteúdo ter sido aberto e encerrado. Sem
         esta condição, uma unidade `NotApplicable` contaria como cumprida
         antes de a pessoa abri-la. */
      return estado.encerrada;

    case "Completed":
      return estado.completed;

    case "Passed":
      return estado.passed === true;

    case "CompletedAndPassed":
      return estado.completed && estado.passed === true;

    case "CompletedOrPassed":
      return estado.completed || estado.passed === true;
  }
}

export type SequenceError =
  | "sem_sessao"
  | "fora_de_ordem"
  | "sessao_encerrada"
  | "verbo_da_plataforma"
  | "duplicado";

export const SEQUENCE_MESSAGE: Record<SequenceError, string> = {
  sem_sessao: "A sessão não foi iniciada.",
  fora_de_ordem: "O conteúdo relatou resultado antes de inicializar a sessão.",
  sessao_encerrada: "A sessão já foi encerrada.",
  verbo_da_plataforma: "Este verbo só pode ser emitido pela plataforma.",
  duplicado: "Este verbo já foi registrado nesta sessão.",
};

export interface SessionLog {
  /** Os verbos já registrados nesta sessão, na ordem em que chegaram. */
  verbos: Cmi5Verb[];
}

/**
 * O statement pode entrar nesta sessão?
 *
 * cmi5 define uma ordem, e ela não é decorativa: um `completed` que chega
 * antes do `initialized` significa que o conteúdo está relatando uma sessão
 * que a plataforma nunca abriu — pode ser defeito, pode ser statement forjado
 * por quem leu a chave de API. Aceitar daria conclusão a quem nunca abriu a
 * aula.
 */
export function validarSequencia(
  verbo: Cmi5Verb,
  log: SessionLog,
): { ok: true } | { ok: false; erro: SequenceError } {
  if (ehDaPlataforma(verbo)) {
    /* `launched`, `waived` e `satisfied` não vêm do conteúdo. Se chegaram pela
       API de statements, alguém está emitindo em nome da plataforma. */
    return { ok: false, erro: "verbo_da_plataforma" };
  }

  const jaIniciou = log.verbos.includes("initialized");
  const jaEncerrou = log.verbos.includes("terminated") || log.verbos.includes("abandoned");

  if (jaEncerrou) return { ok: false, erro: "sessao_encerrada" };

  if (verbo === "initialized") {
    if (jaIniciou) return { ok: false, erro: "duplicado" };
    /* `launched` tem de existir: é a plataforma dizendo que abriu a unidade.
       Sem ele, esta sessão não foi aberta por nós. */
    if (!log.verbos.includes("launched")) return { ok: false, erro: "sem_sessao" };
    return { ok: true };
  }

  if (!jaIniciou) return { ok: false, erro: "fora_de_ordem" };

  /* Resultado não se repete: dois `passed` na mesma sessão seriam dois
     registros da mesma aprovação, e o relatório contaria duas vezes. */
  if ((verbo === "completed" || verbo === "passed" || verbo === "failed") &&
      log.verbos.includes(verbo)) {
    return { ok: false, erro: "duplicado" };
  }

  return { ok: true };
}

/**
 * O estado da sessão, a partir dos verbos registrados.
 *
 * `passed` fica `false` só quando houve `failed` explícito: quem não se
 * pronunciou não reprovou ninguém, e tratar ausência como reprovação daria
 * "não aprovado" a quem apenas não terminou.
 */
export function estadoDaSessao(log: SessionLog, waived = false): SessionState {
  const tem = (v: Cmi5Verb): boolean => log.verbos.includes(v);

  return {
    completed: tem("completed"),
    passed: tem("passed") ? true : tem("failed") ? false : null,
    waived: waived || tem("waived"),
    encerrada: tem("terminated") || tem("abandoned"),
  };
}
