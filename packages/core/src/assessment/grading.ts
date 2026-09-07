/**
 * Correção automática — F3-04.
 *
 * Função pura: a mesma regra decide a nota no servidor (ao enviar a prova) e
 * explica o resultado na tela. Duplicá-la faria o aluno ver uma nota e o banco
 * guardar outra.
 *
 * Sete dos oito tipos corrigem sozinhos. A dissertativa vai para correção
 * manual — e devolve `points: null`, não zero: zero é uma nota, e dar zero a
 * quem ainda não foi corrigido reprovaria a pessoa antes de alguém ler.
 */

export type QuestionKind =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "essay"
  | "short_answer"
  | "numeric"
  | "matching"
  | "ordering";

export interface QuestionOption {
  id: string;
  text: string;
  /** O par, na associação. */
  matchText?: string;
  isCorrect: boolean;
  position: number;
  feedback?: string;
}

export interface GradableQuestion {
  id: string;
  kind: QuestionKind;
  points: number;
  options: QuestionOption[];
  /** Margem aceita na questão numérica. */
  tolerance?: number;
}

export interface GradeResult {
  /** Pontos obtidos. `null` quando depende de correção manual. */
  points: number | null;
  needsReview: boolean;
  correct: boolean;
}

/** Forma canônica para comparar texto: sem acento, sem caixa, sem borda. */
function canonical(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Número a partir do que o cliente mandou.
 *
 * Aceita vírgula decimal: quem digita "7,2" em pt-BR quis dizer 7.2, e recusar
 * seria avaliar teclado em vez de conhecimento.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "string") {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

/** Só os ids que a questão realmente tem — o cliente pode mandar qualquer coisa. */
function selectedIds(response: unknown, question: GradableQuestion): string[] {
  if (!Array.isArray(response)) return [];

  const validos = new Set(question.options.map((o) => o.id));
  return response.filter((id): id is string => typeof id === "string" && validos.has(id));
}

function pontos(question: GradableQuestion, fracao: number): number {
  /* Duas casas: a nota é numeric(6,2) no banco, e arredondar aqui evita que a
     soma da prova divirja do que a tela mostrou. */
  return Math.round(question.points * Math.max(0, Math.min(1, fracao)) * 100) / 100;
}

/**
 * A nota de UMA resposta.
 *
 * `response` vem do cliente e é tratada como não confiável: formato errado,
 * tipo errado e id inventado resultam em zero, nunca em exceção. Um erro aqui
 * derrubaria o envio de uma prova inteira já respondida.
 */
export function gradeAnswer(question: GradableQuestion, response: unknown): GradeResult {
  const corretas = question.options.filter((o) => o.isCorrect);

  switch (question.kind) {
    /* Uma resposta certa. Marcar mais de uma é erro, não acerto parcial: a
       questão pede UMA, e marcar todas seria a forma trivial de sempre
       acertar. */
    case "single_choice":
    case "true_false": {
      const escolhidas = selectedIds(response, question);
      if (escolhidas.length !== 1) return { points: 0, needsReview: false, correct: false };

      const acertou = corretas.some((o) => o.id === escolhidas[0]);
      return { points: acertou ? question.points : 0, needsReview: false, correct: acertou };
    }

    /* Acerto parcial COM desconto por erro.

       Sem o desconto, marcar todas as alternativas garantiria nota cheia. Sem o
       parcial, uma de cinco certas valeria o mesmo que nenhuma — o que pune
       quem sabe quase tudo igual a quem não sabe nada. */
    case "multiple_choice": {
      if (corretas.length === 0) return { points: 0, needsReview: false, correct: false };

      const escolhidas = new Set(selectedIds(response, question));
      const acertos = corretas.filter((o) => escolhidas.has(o.id)).length;
      const erros = [...escolhidas].filter((id) => !corretas.some((o) => o.id === id)).length;

      const fracao = (acertos - erros) / corretas.length;
      const valor = pontos(question, fracao);

      return {
        points: valor,
        needsReview: false,
        correct: acertos === corretas.length && erros === 0,
      };
    }

    /* Qualquer das respostas cadastradas serve. A comparação é canônica: punir
       por "  Cloro " ou por falta de acento avaliaria digitação. */
    case "short_answer": {
      if (typeof response !== "string" || response.trim() === "") {
        return { points: 0, needsReview: false, correct: false };
      }

      const dada = canonical(response);
      const acertou = corretas.some((o) => canonical(o.text) === dada);

      return { points: acertou ? question.points : 0, needsReview: false, correct: acertou };
    }

    case "numeric": {
      const dada = toNumber(response);
      const esperada = toNumber(corretas[0]?.text);

      if (dada === null || esperada === null) {
        return { points: 0, needsReview: false, correct: false };
      }

      /* Sem tolerância declarada, exige o valor exato. */
      const margem = question.tolerance ?? 0;
      const acertou = Math.abs(dada - esperada) <= margem;

      return { points: acertou ? question.points : 0, needsReview: false, correct: acertou };
    }

    /* Cada par certo vale sua fração. Aqui o parcial não tem desconto: associar
       errado já custa o ponto daquele item, e descontar de novo puniria duas
       vezes o mesmo erro. */
    case "matching": {
      if (corretas.length === 0) return { points: 0, needsReview: false, correct: false };
      if (typeof response !== "object" || response === null || Array.isArray(response)) {
        return { points: 0, needsReview: false, correct: false };
      }

      const dado = response as Record<string, unknown>;
      const acertos = corretas.filter((o) => {
        const escolhido = dado[o.id];
        return typeof escolhido === "string" && canonical(escolhido) === canonical(o.matchText ?? "");
      }).length;

      return {
        points: pontos(question, acertos / corretas.length),
        needsReview: false,
        correct: acertos === corretas.length,
      };
    }

    /* Tudo ou nada. Uma sequência "quase certa" não descreve um processo que
       funciona: tratar antes de captar não é 66% correto. */
    case "ordering": {
      const esperada = [...question.options]
        .sort((a, b) => a.position - b.position)
        .map((o) => o.id);

      const dada = selectedIds(response, question);
      const igual =
        dada.length === esperada.length && dada.every((id, i) => id === esperada[i]);

      return { points: igual ? question.points : 0, needsReview: false, correct: igual };
    }

    /* `points: null` e não zero: zero é uma nota, e dar zero antes de alguém
       ler reprovaria quem ainda não foi corrigido. */
    case "essay":
      return { points: null, needsReview: true, correct: false };
  }
}

export interface AttemptScore {
  points: number;
  /** 0 a 100. */
  percent: number;
  passed: boolean;
  needsReview: boolean;
}

/**
 * A nota da tentativa inteira.
 *
 * Quando há dissertativa pendente, o percentual é o dos itens JÁ corrigidos, e
 * `needsReview` avisa que não é final. Tratar o pendente como zero mostraria
 * uma reprovação que pode virar aprovação depois da correção — e é a primeira
 * coisa que o aluno vê.
 */
export function scoreAttempt(
  respostas: { points: number | null; needsReview: boolean }[],
  totalPoints: number,
  passingScore: number,
): AttemptScore {
  const obtidos = respostas.reduce((soma, r) => soma + (r.points ?? 0), 0);
  const pendente = respostas.some((r) => r.needsReview);

  /* O denominador exclui o que ainda não foi corrigido: dividir pelo total
     mostraria 40% numa prova em que a pessoa acertou tudo o que já foi visto. */
  const avaliaveis = totalPoints;

  const percent = avaliaveis > 0 ? Math.round((obtidos / avaliaveis) * 10000) / 100 : 0;

  return {
    points: Math.round(obtidos * 100) / 100,
    percent,
    /* Aprovação só se decide com tudo corrigido. */
    passed: !pendente && percent >= passingScore,
    needsReview: pendente,
  };
}
