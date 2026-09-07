/**
 * A quem uma trilha se destina.
 *
 * A matriz que a operação pede tem duas dimensões: o LOCAL e a FUNÇÃO. Quem
 * opera a válvula e quem assina a permissão de trabalho estão na mesma unidade
 * e precisam de treinamentos diferentes; a mesma função em duas unidades pode
 * precisar do procedimento local de cada uma.
 *
 * VAZIO É "TODO MUNDO"
 *
 * Um campo em branco não é um filtro que não casa com ninguém — é a ausência de
 * filtro. Uma trilha sem local e sem função vale para a organização inteira, que
 * é o caso mais comum (integração, código de conduta, LGPD).
 *
 * O inverso seria pior de descobrir: trilha nova, campos em branco, ninguém a
 * enxerga, e nada na tela explicando por quê.
 *
 * A COMPARAÇÃO É FROUXA DE PROPÓSITO
 *
 * "Operador de Campo" e "operador de campo " são a mesma função. O cargo vem
 * digitado por gente, do Active Directory, e exigir igualdade exata faria a
 * trilha sumir por causa de um espaço no fim — sem erro, sem aviso, sem nada
 * para investigar.
 */

/** O recorte declarado na trilha. Ambos opcionais. */
export interface AlvoDaTrilha {
  /** A unidade ou área. Nulo: qualquer uma. */
  project?: string | null;
  /** A função. Nulo: qualquer uma. */
  jobTitle?: string | null;
}

/** Quem está sendo alcançado. */
export interface PessoaAlcancada {
  project?: string | null;
  jobTitle?: string | null;
}

/**
 * Normaliza para comparar: sem acento, sem caixa, sem espaço sobrando.
 *
 * Devolve `null` para vazio e para só-espaços, porque os dois significam a
 * mesma coisa — "não informado" — e tratá-los diferente faria uma trilha com
 * `project = " "` desaparecer.
 */
export function chaveDoAlvo(valor: string | null | undefined): string | null {
  if (typeof valor !== "string") return null;

  const limpo = valor
    .normalize("NFD")
    /* Mesma normalização do slug: \p{Diacritic} sobre o NFD. Escrever o
       intervalo com os caracteres em si funcionaria e seria ilegível — eles
       são invisíveis no arquivo. */
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

  return limpo === "" ? null : limpo;
}

/** Uma dimensão: o alvo em branco alcança qualquer valor. */
function dimensaoAlcanca(doAlvo: string | null, daPessoa: string | null): boolean {
  if (doAlvo === null) return true;
  return doAlvo === daPessoa;
}

/**
 * A trilha alcança esta pessoa?
 *
 * As duas dimensões precisam casar. Uma trilha de "Operador de Campo" em
 * "Unidade Central" não vale para o operador de Unidade Oeste nem para o supervisor de
 * Unidade Central — é o cruzamento que define o treinamento obrigatório de cada um.
 */
export function trilhaAlcanca(alvo: AlvoDaTrilha, pessoa: PessoaAlcancada): boolean {
  return (
    dimensaoAlcanca(chaveDoAlvo(alvo.project), chaveDoAlvo(pessoa.project)) &&
    dimensaoAlcanca(chaveDoAlvo(alvo.jobTitle), chaveDoAlvo(pessoa.jobTitle))
  );
}

/** Como a tela descreve, em uma linha, a quem a trilha se destina. */
export function alvoEmPalavras(alvo: AlvoDaTrilha): string {
  const local = chaveDoAlvo(alvo.project) === null ? null : (alvo.project as string).trim();
  const funcao = chaveDoAlvo(alvo.jobTitle) === null ? null : (alvo.jobTitle as string).trim();

  if (local && funcao) return `${funcao} · ${local}`;
  if (funcao) return `${funcao}, em qualquer unidade`;
  if (local) return `Qualquer função, em ${local}`;

  return "Toda a organização";
}

export interface CelulaDaMatriz {
  /** A função, como ela aparece no cadastro. `null` é quem está sem função. */
  funcao: string | null;
  pessoas: number;
  /** Títulos das trilhas que alcançam esta função, em ordem. */
  trilhas: string[];
}

export interface PessoaNaMatriz extends PessoaAlcancada {
  id: string;
}

export interface TrilhaNaMatriz extends AlvoDaTrilha {
  title: string;
}

/**
 * A matriz de treinamento: uma linha por função, com quem cai nela e o que
 * essa função tem para fazer.
 *
 * Quem está SEM função aparece numa linha própria, e não some. É justamente a
 * linha que interessa a quem for arrumar o cadastro: são as pessoas que só
 * recebem as trilhas gerais, porque nenhuma trilha de função as alcança.
 *
 * A ordem é a das funções em ordem alfabética, com os sem função por último —
 * uma pendência de cadastro não deve encabeçar a tela.
 */
export function matrizDeTreinamento(
  pessoas: PessoaNaMatriz[],
  trilhas: TrilhaNaMatriz[],
): CelulaDaMatriz[] {
  const porFuncao = new Map<string | null, { rotulo: string | null; pessoas: PessoaNaMatriz[] }>();

  for (const pessoa of pessoas) {
    const chave = chaveDoAlvo(pessoa.jobTitle);
    const atual = porFuncao.get(chave);

    if (atual) {
      atual.pessoas.push(pessoa);
      continue;
    }

    porFuncao.set(chave, {
      /* O rótulo é o texto ORIGINAL da primeira pessoa daquela função, não a
         chave normalizada: a tela mostra "Operador de Campo", não
         "operador de campo". */
      rotulo: chave === null ? null : (pessoa.jobTitle as string).trim(),
      pessoas: [pessoa],
    });
  }

  const linhas: CelulaDaMatriz[] = [];

  for (const { rotulo, pessoas: doGrupo } of porFuncao.values()) {
    /* Uma trilha entra na linha se alcança QUALQUER pessoa daquela função.

       Não basta olhar a função: uma trilha de "Operador · Unidade Central" alcança
       os operadores de Unidade Central e não os de Unidade Oeste, e os dois grupos estão
       nesta mesma linha. A tela mostra o que aquela função encontra pela
       organização; o cruzamento com o local aparece no rótulo da trilha. */
    const alcancam = trilhas.filter((trilha) =>
      doGrupo.some((pessoa) => trilhaAlcanca(trilha, pessoa)),
    );

    linhas.push({
      funcao: rotulo,
      pessoas: doGrupo.length,
      trilhas: alcancam.map((trilha) => trilha.title),
    });
  }

  return linhas.sort((a, b) => {
    if (a.funcao === null) return 1;
    if (b.funcao === null) return -1;
    return a.funcao.localeCompare(b.funcao, "pt-BR");
  });
}
