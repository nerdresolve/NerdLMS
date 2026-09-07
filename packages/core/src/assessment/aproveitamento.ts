/**
 * Em que tentativa as pessoas passam.
 *
 * A taxa de aprovação sozinha esconde a informação que interessa. "82%
 * aprovados" pode significar que a prova está calibrada, ou que quase todo
 * mundo reprovou uma vez e refez. As duas situações pedem ações opostas: a
 * primeira não pede nada, a segunda diz que a aula não prepara para a prova.
 *
 * Recebe dados e devolve números. A consulta fica no repositório.
 */

/** O resultado de uma pessoa numa prova, já reduzido ao que importa aqui. */
export interface TentativaDoAluno {
  /** Em que tentativa passou. `null` para quem ainda não passou. */
  passouNa: number | null;
  /** Quantas tentativas gastou até agora, tenha passado ou não. */
  tentativas: number;
}

export interface FaixaDeAproveitamento {
  /** 1, 2, 3… e `null` na faixa de quem não passou. */
  tentativa: number | null;
  rotulo: string;
  pessoas: number;
  /** Percentual sobre quem TENTOU, com uma casa. */
  percentual: number;
}

export interface Aproveitamento {
  /** Quem enviou ao menos uma tentativa. Quem nunca tentou fica de fora. */
  tentaram: number;
  aprovados: number;
  /** Percentual de aprovação sobre quem tentou. */
  taxaDeAprovacao: number;
  /**
   * Média de tentativas de QUEM PASSOU.
   *
   * Sobre os aprovados, e não sobre todos: incluir quem ainda não passou
   * misturaria "gastou três e conseguiu" com "gastou três e continua devendo",
   * que são leituras diferentes.
   */
  mediaAteAprovar: number;
  faixas: FaixaDeAproveitamento[];
}

/** Até esta tentativa cada faixa é própria; daí em diante, agrupadas. */
const FAIXAS_SEPARADAS = 3;

function rotuloDa(tentativa: number): string {
  if (tentativa === 1) return "Passou de primeira";
  if (tentativa === 2) return "Passou de segunda";
  if (tentativa === 3) return "Passou de terceira";
  return `Passou da ${FAIXAS_SEPARADAS + 1}ª em diante`;
}

const arredonda = (valor: number): number => Math.round(valor * 10) / 10;

/**
 * Distribui as pessoas pela tentativa em que passaram.
 *
 * As faixas 1, 2 e 3 aparecem SEMPRE, mesmo zeradas. Uma tabela que omite a
 * faixa vazia faz "ninguém passou de primeira" parecer com "a métrica não
 * existe", e quem lê não distingue os dois.
 */
export function aproveitamentoPorTentativa(
  alunos: TentativaDoAluno[],
): Aproveitamento {
  const tentaram = alunos.filter((aluno) => aluno.tentativas > 0);
  const aprovados = tentaram.filter((aluno) => aluno.passouNa !== null);

  const percentual = (quantos: number): number =>
    tentaram.length === 0 ? 0 : arredonda((quantos / tentaram.length) * 100);

  const faixas: FaixaDeAproveitamento[] = [];

  for (let n = 1; n <= FAIXAS_SEPARADAS; n++) {
    const pessoas = aprovados.filter((aluno) => aluno.passouNa === n).length;
    faixas.push({ tentativa: n, rotulo: rotuloDa(n), pessoas, percentual: percentual(pessoas) });
  }

  /* A faixa aberta só aparece quando tem gente: numa prova de uma tentativa,
     "da 4ª em diante" com zero seria ruído em toda tabela. */
  const acima = aprovados.filter(
    (aluno) => aluno.passouNa !== null && aluno.passouNa > FAIXAS_SEPARADAS,
  ).length;

  if (acima > 0) {
    faixas.push({
      tentativa: FAIXAS_SEPARADAS + 1,
      rotulo: rotuloDa(FAIXAS_SEPARADAS + 1),
      pessoas: acima,
      percentual: percentual(acima),
    });
  }

  const naoPassaram = tentaram.length - aprovados.length;

  /* Sempre presente, inclusive zerada: é a faixa que fecha a soma com o total
     de quem tentou, e sem ela a tabela não bate. */
  faixas.push({
    tentativa: null,
    rotulo: "Ainda não passou",
    pessoas: naoPassaram,
    percentual: percentual(naoPassaram),
  });

  const somaDasTentativas = aprovados.reduce((soma, aluno) => soma + (aluno.passouNa ?? 0), 0);

  return {
    tentaram: tentaram.length,
    aprovados: aprovados.length,
    taxaDeAprovacao: percentual(aprovados.length),
    mediaAteAprovar:
      aprovados.length === 0 ? 0 : arredonda(somaDasTentativas / aprovados.length),
    faixas,
  };
}

/**
 * A leitura que o número sozinho não dá.
 *
 * Existe porque "82% de aprovação" não diz o que fazer. Quem lê a tela precisa
 * saber se a prova está calibrada ou se a aula não prepara para ela, e essa
 * distinção está na PROPORÇÃO de quem passou de primeira, não no total.
 */
export function lerAproveitamento(dados: Aproveitamento): string | null {
  if (dados.tentaram < 5) return null;

  const primeira = dados.faixas.find((faixa) => faixa.tentativa === 1);
  const dePrimeira = primeira ? primeira.percentual : 0;

  if (dePrimeira >= 80) {
    return (
      "A maioria passa na primeira tentativa. Se a intenção é medir, e não " +
      "apenas registrar, vale conferir se a prova cobra o que a aula ensina."
    );
  }

  if (dePrimeira < 40 && dados.taxaDeAprovacao >= 70) {
    return (
      "Poucos passam de primeira, mas a maioria passa depois de refazer. " +
      "Costuma indicar que a aula não prepara para a prova."
    );
  }

  if (dados.taxaDeAprovacao < 50) {
    return (
      "Menos da metade de quem tentou foi aprovada. Vale revisar a prova e o " +
      "conteúdo antes de tratar como problema de quem estuda."
    );
  }

  return null;
}
