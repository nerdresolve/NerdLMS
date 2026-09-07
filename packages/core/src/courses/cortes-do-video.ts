/**
 * Onde cortar um vídeo para nenhuma parte passar do teto.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * Cortar sem recodificar (`-c copy`) só é possível em quadro-chave: o corte no
 * meio de um grupo de quadros deixa a parte seguinte sem a referência que os
 * quadros dela usam, e o vídeo abre com a imagem quebrada até o próximo
 * quadro-chave.
 *
 * O `-segment_time 900` do ffmpeg escolhe o primeiro quadro-chave DEPOIS dos
 * 900 segundos. Sempre depois. Foi assim que as aulas ficaram com 15 minutos e
 * 1 segundo — e uma regra de "no máximo 15 minutos" que produz partes de 15:02
 * não é uma regra, é uma sugestão.
 *
 * A CORREÇÃO
 *
 * Escolher o último quadro-chave ANTES do teto, e não o primeiro depois. A
 * parte fica um pouco menor que 15 minutos, que é exatamente o que se pede:
 * "pode ser menor, nunca maior".
 *
 * QUANDO NÃO DÁ
 *
 * Se dois quadros-chave estiverem a mais de 15 minutos um do outro, nenhum
 * corte por cópia respeita o teto. A função devolve o corte assim mesmo, com a
 * marca `excedeu`, para quem chamar decidir — recodificar o vídeo, ou recusar o
 * upload explicando. Fingir que coube seria o defeito de novo, com outra
 * origem.
 */

/** O teto por aula, em segundos. */
export const TETO_DA_AULA_SEGUNDOS = 15 * 60;

export interface ParteDoVideo {
  /** Início, em segundos desde o começo do vídeo. */
  inicio: number;
  /** Fim, em segundos. Igual à duração total na última parte. */
  fim: number;
  /** A parte passou do teto porque não havia quadro-chave utilizável. */
  excedeu: boolean;
}

export interface PlanoDeCorte {
  partes: ParteDoVideo[];
  /** Alguma parte passou do teto. */
  temExcesso: boolean;
}

/**
 * Divide o vídeo nos quadros-chave, sem nenhuma parte passar do teto.
 *
 * `quadrosChave` são os instantes, em segundos, dos quadros-chave do vídeo —
 * o que o `ffprobe` devolve. Não precisam vir ordenados nem sem repetição.
 *
 * O primeiro quadro-chave é sempre o instante zero, e ele não conta como corte:
 * cortar no início produziria uma parte vazia.
 */
export function planoDeCorte(
  duracao: number,
  quadrosChave: number[],
  teto = TETO_DA_AULA_SEGUNDOS,
): PlanoDeCorte {
  if (!(duracao > 0)) return { partes: [], temExcesso: false };

  /* Vídeo que já cabe não se corta. Uma parte só, do começo ao fim. */
  if (duracao <= teto) {
    return { partes: [{ inicio: 0, fim: duracao, excedeu: false }], temExcesso: false };
  }

  const candidatos = [...new Set(quadrosChave)]
    .filter((t) => Number.isFinite(t) && t > 0 && t < duracao)
    .sort((a, b) => a - b);

  const partes: ParteDoVideo[] = [];
  let inicio = 0;

  while (duracao - inicio > teto) {
    const limite = inicio + teto;

    /* O ÚLTIMO quadro-chave até o limite, e não o primeiro depois dele.

       `<=` e não `<`: um quadro-chave exatamente no limite dá uma parte de
       exatamente 15 minutos, que cabe. */
    let corte = 0;
    for (const t of candidatos) {
      if (t > inicio && t <= limite) corte = t;
      if (t > limite) break;
    }

    if (corte === 0) {
      /* Nenhum quadro-chave utilizável dentro da janela. O primeiro depois do
         limite é o menor corte possível por cópia; sem nenhum, o resto do
         vídeo vira uma parte só. */
      const seguinte = candidatos.find((t) => t > inicio);
      const fim = seguinte ?? duracao;

      partes.push({ inicio, fim, excedeu: true });
      inicio = fim;

      /* `seguinte` indefinido significa que não há mais corte possível: o que
         sobrou é uma parte única, e insistir no laço o repetiria para sempre. */
      if (seguinte === undefined) break;
      continue;
    }

    partes.push({ inicio, fim: corte, excedeu: false });
    inicio = corte;
  }

  if (inicio < duracao) {
    partes.push({ inicio, fim: duracao, excedeu: duracao - inicio > teto });
  }

  return { partes, temExcesso: partes.some((parte) => parte.excedeu) };
}

/** A duração de cada parte, em segundos, arredondada para baixo. */
export function duracoesDoPlano(plano: PlanoDeCorte): number[] {
  return plano.partes.map((parte) => Math.floor(parte.fim - parte.inicio));
}

/**
 * Como nomear cada parte na lista de aulas.
 *
 * "Parte 1 de 4" e não "Parte 1": sem o total, quem abre a primeira não sabe se
 * faltam duas ou dez, e a decisão de começar agora ou depois depende disso.
 *
 * Uma parte só devolve o título original — um vídeo que coube inteiro não vira
 * "Parte 1 de 1", que sugeriria uma segunda parte que não existe.
 */
export function nomeDaParte(titulo: string, indice: number, total: number): string {
  if (total <= 1) return titulo;
  return `${titulo} (parte ${indice + 1} de ${total})`;
}
