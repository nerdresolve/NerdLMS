/**
 * O plano de formação de um cargo: o que forma alguém por completo.
 *
 * A PERGUNTA QUE ISTO RESPONDE
 *
 * "O que forma um Analista de Desenvolvimento PLENO?" A resposta é um conjunto
 * de trilhas, cursos e competências — e, para cada pessoa naquele cargo, quanto
 * disso já está cumprido.
 *
 * TRÊS TIPOS DE EXIGÊNCIA, PORQUE SÃO TRÊS PERGUNTAS
 *
 *   trilha      — cumpriu a jornada inteira?
 *   curso       — fez este curso específico?
 *   competência — sabe fazer, e em que nível?
 *
 * Competência já existia e responde uma coisa que curso não responde: alguém
 * pode saber por experiência e nunca ter feito o curso. Trilha e curso
 * respondem o oposto — a formação aconteceu, independentemente do que a pessoa
 * já sabia. Um plano que só tivesse competência obrigaria a inventar uma
 * competência por trilha, um degrau que não significa nada.
 *
 * O PERCENTUAL NÃO É MÉDIA DE PERCENTUAIS
 *
 * Uma trilha meio feita não é "meio cumprida" para efeito de formação: ou a
 * pessoa está formada naquilo, ou não está. O percentual do plano é
 * cumpridos ÷ total de exigências. Somar frações de trilha daria um número que
 * parece progresso e não autoriza nada.
 */

import { currentLevel, type Evidence } from "./proficiency.ts";

export type TipoDeExigencia = "trilha" | "curso" | "competencia";

export interface Exigencia {
  id: string;
  tipo: TipoDeExigencia;
  /** Id da trilha, do curso ou da competência. */
  alvoId: string;
  /** Como a tela chama isto. */
  nome: string;
  /** Só para competência: o nível exigido. */
  nivelExigido?: number;
}

export interface OQuePessoaTem {
  /** Ids de trilha concluídas por inteiro. */
  trilhasConcluidas: string[];
  /** Ids de curso concluídos. */
  cursosConcluidos: string[];
  /** As evidências de competência da pessoa. */
  evidencias: Evidence[];
}

export interface ExigenciaAvaliada extends Exigencia {
  cumprida: boolean;
  /** Só para competência: o nível que a pessoa tem hoje. `0` é nada. */
  nivelAtual?: number;
}

export interface FormacaoDaPessoa {
  itens: ExigenciaAvaliada[];
  cumpridas: number;
  total: number;
  /** 0 a 100, inteiro. */
  percentual: number;
  /** Formada por completo: todas as exigências cumpridas. */
  completa: boolean;
}

/**
 * Quanto desta formação a pessoa já cumpriu.
 *
 * Plano sem exigência nenhuma NÃO é 100%. É um plano vazio, e dizer que alguém
 * está formado por um plano que não pede nada seria a pior resposta possível
 * para quem confia no número.
 */
export function formacaoDaPessoa(
  exigencias: Exigencia[],
  tem: OQuePessoaTem,
  agora = new Date(),
): FormacaoDaPessoa {
  const trilhas = new Set(tem.trilhasConcluidas);
  const cursos = new Set(tem.cursosConcluidos);

  const itens = exigencias.map((exigencia): ExigenciaAvaliada => {
    if (exigencia.tipo === "trilha") {
      return { ...exigencia, cumprida: trilhas.has(exigencia.alvoId) };
    }

    if (exigencia.tipo === "curso") {
      return { ...exigencia, cumprida: cursos.has(exigencia.alvoId) };
    }

    /* Competência: vale o nível VIGENTE, que já desconta evidência vencida e
       revogada. Quem operou uma ETA em 2019 e nunca mais voltou não cumpre a
       exigência hoje. */
    const daCompetencia = tem.evidencias.filter((e) => e.competencyId === exigencia.alvoId);
    const nivelAtual = currentLevel(daCompetencia, agora);

    return {
      ...exigencia,
      nivelAtual,
      cumprida: nivelAtual >= (exigencia.nivelExigido ?? 1),
    };
  });

  const cumpridas = itens.filter((item) => item.cumprida).length;
  const total = itens.length;

  return {
    itens,
    cumpridas,
    total,
    percentual: total === 0 ? 0 : Math.round((cumpridas / total) * 100),
    completa: total > 0 && cumpridas === total,
  };
}

export interface PessoaDoCargo {
  id: string;
  nome: string;
  formacao: FormacaoDaPessoa;
}

export interface ResumoDoCargo {
  /** O cargo, como está no cadastro. */
  cargo: string;
  pessoas: number;
  /** Quantas cumpriram TUDO. */
  formadas: number;
  /** Média dos percentuais individuais, inteira. */
  percentualMedio: number;
}

/**
 * O resumo de um cargo, para a tela que pergunta "como está a equipe".
 *
 * A MÉDIA AQUI É DE PESSOAS, e não de exigências: "as pessoas estão em média a
 * 70% da formação" é uma frase sobre gente. Somar exigências cumpridas de todo
 * mundo e dividir pelo total daria mais peso a quem tem plano maior, e ninguém
 * lê o número esperando isso.
 *
 * `formadas` é o número que decide: é ele que responde quantas pessoas podem
 * assumir o posto hoje.
 */
export function resumoDoCargo(cargo: string, pessoas: PessoaDoCargo[]): ResumoDoCargo {
  if (pessoas.length === 0) {
    return { cargo, pessoas: 0, formadas: 0, percentualMedio: 0 };
  }

  const soma = pessoas.reduce((total, pessoa) => total + pessoa.formacao.percentual, 0);

  return {
    cargo,
    pessoas: pessoas.length,
    formadas: pessoas.filter((pessoa) => pessoa.formacao.completa).length,
    percentualMedio: Math.round(soma / pessoas.length),
  };
}

/**
 * O que falta para esta pessoa, em ordem de utilidade.
 *
 * Trilha antes de curso antes de competência: a trilha é a maior peça e
 * costuma conter os cursos soltos, então começar por ela evita mandar alguém
 * fazer um curso que a trilha já traria. Competência por último porque muitas
 * são concedidas ao concluir o conteúdo — resolver o conteúdo pode resolvê-las
 * sozinho.
 */
export function oQueFalta(formacao: FormacaoDaPessoa): ExigenciaAvaliada[] {
  const ordem: Record<TipoDeExigencia, number> = { trilha: 0, curso: 1, competencia: 2 };

  return formacao.itens
    .filter((item) => !item.cumprida)
    .sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || a.nome.localeCompare(b.nome, "pt-BR"));
}

/* ---------------------------------------------------------------------------
   Herança entre planos
   ---------------------------------------------------------------------------

   "PLENO continua JR, e acrescenta isto." O comum se escreve uma vez, no plano
   de baixo, e os de cima só declaram o que muda — sem isso, o que vale para as
   três senioridades é copiado três vezes, e a primeira mudança no comum vai
   acontecer num plano e ser esquecida nos outros dois.
   --------------------------------------------------------------------------- */

export interface PlanoHerdavel {
  id: string;
  nome: string;
  /** O plano que este continua. `null` quando não continua nenhum. */
  continuaId: string | null;
  exigencias: Exigencia[];
}

export interface ExigenciaEfetiva extends Exigencia {
  /**
   * De qual plano ela veio. Nulo quando é do próprio plano.
   *
   * A tela PRECISA disto: uma exigência herdada não se edita aqui, se edita no
   * plano de origem, e sem dizer de onde veio a pessoa tenta remover e não
   * entende por que ela volta.
   */
  herdadaDe?: string;
}

/** A cadeia de um plano, do próprio até a raiz. Para a tela mostrar a origem. */
export function cadeiaDoPlano(
  planoId: string,
  porId: Map<string, PlanoHerdavel>,
): PlanoHerdavel[] {
  const cadeia: PlanoHerdavel[] = [];
  const vistos = new Set<string>();

  let atual = porId.get(planoId);

  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    cadeia.push(atual);
    atual = atual.continuaId ? porId.get(atual.continuaId) : undefined;
  }

  return cadeia;
}

/**
 * O que o plano exige DE VERDADE: o dele mais o de tudo que ele continua.
 *
 * A DUPLICATA FICA COM O PLANO MAIS PRÓXIMO
 *
 * Se PLENO e JR exigem o mesmo curso, ele conta UMA vez, e como exigência do
 * PLENO — não herdada. Contar duas vezes faria o percentual de quem cumpriu
 * aquele curso subir por uma repetição que ninguém quis declarar.
 *
 * Quando a repetição é uma COMPETÊNCIA em níveis diferentes, vale o MAIOR: o
 * plano de cima exigir menos que o de baixo seria um retrocesso na carreira, e
 * a leitura não deve ajudar a escrevê-lo.
 *
 * O CICLO NÃO TRAVA A TELA
 *
 * `vistos` para a caminhada ao revisitar um plano. O caso de uso já recusa
 * criar um ciclo; isto é a rede para um dado que chegue estragado por outro
 * caminho — e travar a tela seria a pior forma de descobrir.
 */
export function exigenciasEfetivas(
  planoId: string,
  porId: Map<string, PlanoHerdavel>,
): ExigenciaEfetiva[] {
  const saida = new Map<string, ExigenciaEfetiva>();
  const cadeia = cadeiaDoPlano(planoId, porId);

  for (const [distancia, plano] of cadeia.entries()) {
    for (const exigencia of plano.exigencias) {
      /* A chave é o par tipo+alvo: o mesmo curso exigido por dois planos é a
         mesma exigência, mesmo com ids de item diferentes. */
      const chave = `${exigencia.tipo}:${exigencia.alvoId}`;
      const jaTem = saida.get(chave);

      if (!jaTem) {
        saida.set(chave, {
          ...exigencia,
          ...(distancia > 0 ? { herdadaDe: plano.nome } : {}),
        });
        continue;
      }

      /* Já veio de um plano mais próximo. Só o nível pode subir. */
      if (exigencia.tipo === "competencia") {
        const maior = Math.max(jaTem.nivelExigido ?? 1, exigencia.nivelExigido ?? 1);
        saida.set(chave, { ...jaTem, nivelExigido: maior });
      }
    }
  }

  return [...saida.values()];
}

/**
 * Criar este vínculo fecharia um ciclo?
 *
 * Um ciclo torna a resolução infinita e, pior, torna a pergunta "o que este
 * plano exige" sem resposta. É recusado na escrita; a leitura ainda se protege
 * sozinha, porque um dado pode chegar estragado por restauração de backup ou
 * por escrita direta no banco.
 */
export function fechariaCiclo(
  planoId: string,
  novoPaiId: string,
  porId: Map<string, PlanoHerdavel>,
): boolean {
  if (planoId === novoPaiId) return true;

  /* Subir a partir do PAI proposto: se o próprio plano aparecer no caminho, o
     vínculo fecharia o laço. */
  return cadeiaDoPlano(novoPaiId, porId).some((plano) => plano.id === planoId);
}
