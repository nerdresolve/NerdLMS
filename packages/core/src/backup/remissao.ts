/**
 * Migração de conteúdo entre CLIENTES.
 *
 * O backup guarda as linhas com os UUIDs de origem, e é assim que as chaves
 * estrangeiras entre elas continuam válidas na restauração. Isso funciona no
 * mesmo cliente e falha no outro: lá, esses mesmos UUIDs já existem — são as
 * linhas do cliente de origem, na mesma tabela — e o `ON CONFLICT DO NOTHING`
 * pula todas. O resultado seria uma migração que diz ter funcionado e não moveu
 * nada, que é pior que uma que recusa.
 *
 * A SAÍDA É REEMITIR CADA UUID e reescrever toda referência a ele.
 *
 * O que este módulo faz: recebe as linhas, sorteia um id novo para cada um dos
 * antigos, e troca. Reescreve tanto a chave primária quanto QUALQUER coluna
 * que aponte para um id conhecido — a lista de colunas vem de quem chama, que
 * a lê do próprio banco, porque uma lista escrita à mão envelhece na primeira
 * migração de schema.
 *
 * O QUE NÃO É REEMITIDO
 *
 * O `tenant_id`, que passa a ser o do destino, e qualquer id que não esteja no
 * mapa — uma referência a algo que o backup não trouxe. Essa segunda parte é a
 * mais importante do módulo, e está em `referenciaOrfa`: apontar para um id do
 * cliente de origem seria vazamento entre clientes, e é o pior defeito que uma
 * migração poderia ter.
 */

/** Uma linha do backup: colunas e valores, como saíram do banco. */
export type Linha = Record<string, unknown>;

export interface ColunaDeReferencia {
  tabela: string;
  coluna: string;
  /** Para onde ela aponta. */
  destino: string;
  /**
   * A coluna aceita nulo?
   *
   * Decide o que fazer com uma referência que o backup não trouxe: coluna
   * opcional é ANULADA — a linha entra sem aquele vínculo. Coluna obrigatória
   * recusa a migração, porque a linha não existe sem ele.
   */
  aceitaNulo: boolean;
  /**
   * A linha EXISTE por causa desta referência?
   *
   * A coluna aceita nulo e, ainda assim, anulá-la produz uma linha sem
   * sentido. `grade_entries.lti_link_id` é o caso: um CHECK exige que a nota
   * tenha exatamente uma origem — prova, tarefa ou ferramenta LTI. Anular a
   * do LTI deixa a nota sem nenhuma, e o banco recusa a linha inteira; se o
   * CHECK não existisse, entraria uma nota que não significa mais nada.
   *
   * Nesses casos a linha é DESCARTADA da migração, e quem migra é avisado —
   * é a única saída honesta quando o conteúdo depende de algo que não veio.
   */
  descartaLinha?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

/**
 * O mapa de ids antigos para novos.
 *
 * Construído sobre TODAS as tabelas antes de qualquer troca: uma linha de
 * `lessons` referencia um `module_id` que só aparece depois no arquivo, e
 * trocar tabela por tabela deixaria a referência apontando para um id que
 * ainda não foi reemitido.
 */
export function construirMapa(
  dados: Record<string, Linha[]>,
  novoId: () => string,
): Map<string, string> {
  const mapa = new Map<string, string>();

  for (const linhas of Object.values(dados)) {
    for (const linha of linhas) {
      const id = linha["id"];
      if (!ehUuid(id)) continue;
      if (mapa.has(id)) continue;

      mapa.set(id, novoId());
    }
  }

  return mapa;
}

export interface ReferenciaOrfa {
  tabela: string;
  coluna: string;
  /** O id que não veio no backup. */
  valor: string;
}

export interface LinhaDescartada {
  tabela: string;
  coluna: string;
}

export interface Remissao {
  dados: Record<string, Linha[]>;
  /** Quantos ids foram reemitidos. */
  reemitidos: number;
  /**
   * Quantas referências opcionais foram anuladas.
   *
   * Não é erro, e por isso não está em `orfas` — mas quem migra precisa saber
   * que algum vínculo se perdeu no caminho, e quantos.
   */
  anuladas: number;
  /**
   * Linhas que não puderam vir, e por quê.
   *
   * São as que EXISTEM por causa da referência ausente: uma nota lançada por
   * ferramenta LTI não é uma nota sem origem — sem a ferramenta, ela não é
   * nada. Anular a coluna produziria uma linha que o banco recusa (o CHECK de
   * `grade_entries` exige exatamente uma origem) ou, pior, uma que ele aceita
   * e que não significa mais o que significava.
   */
  descartadas: LinhaDescartada[];
  /**
   * Referências que apontam para fora do backup.
   *
   * São o motivo de esta função existir com dois resultados em vez de um: uma
   * referência órfã apontaria para um id do cliente de ORIGEM, e migrar assim
   * levaria uma linha do destino a depender de dado que não é dele. Quem chama
   * decide — anular a coluna quando ela aceita nulo, ou recusar a migração.
   */
  orfas: ReferenciaOrfa[];
}

/**
 * Reescreve o backup inteiro com ids novos.
 *
 * `colunasDeReferencia` diz quais colunas apontam para outras linhas. Vem do
 * schema real, não de uma lista aqui: 181 chaves estrangeiras escritas à mão
 * envelheceriam na primeira migração, e o que envelhece em silêncio numa
 * função destas deixa uma referência apontando para o cliente errado.
 */
export function remapearIds(
  dados: Record<string, Linha[]>,
  colunasDeReferencia: ColunaDeReferencia[],
  novoTenantId: string,
  novoId: () => string,
): Remissao {
  const mapa = construirMapa(dados, novoId);

  /* Índice por tabela: a busca linear numa lista de 181 colunas, repetida por
     linha, custaria caro num backup de dez mil linhas. */
  const porTabela = new Map<string, ColunaDeReferencia[]>();
  for (const c of colunasDeReferencia) {
    porTabela.set(c.tabela, [...(porTabela.get(c.tabela) ?? []), c]);
  }

  const orfas: ReferenciaOrfa[] = [];
  const descartadas: LinhaDescartada[] = [];
  const saida: Record<string, Linha[]> = {};
  let anuladas = 0;

  for (const [tabela, linhas] of Object.entries(dados)) {
    const referencias = porTabela.get(tabela) ?? [];

    const mantidas: Linha[] = [];

    for (const linha of linhas) {
      const nova: Linha = { ...linha };
      /* Preenchido quando alguma referência descarta a linha inteira. */
      let descartar: string | null = null;

      /* A chave primária. */
      if (ehUuid(linha["id"])) nova["id"] = mapa.get(linha["id"] as string);

      /* O tenant passa a ser o do destino. Não entra no mapa: ele não é uma
         linha do backup, é o cliente que está recebendo. */
      if ("tenant_id" in nova) nova["tenant_id"] = novoTenantId;

      for (const ref of referencias) {
        if (ref.coluna === "id" || ref.coluna === "tenant_id") continue;

        const valor = linha[ref.coluna];
        if (valor === null || valor === undefined) continue;
        if (!ehUuid(valor)) continue;

        const novo = mapa.get(valor);

        if (novo === undefined) {
          /* Aponta para algo que o backup não trouxe.

             Acontece legitimamente: `grade_entries.lti_link_id` aponta para
             `lti_links`, que não está no manifesto — a nota existe, o vínculo
             com a ferramenta externa não vem junto. Manter o id de origem
             faria a linha do destino depender de dado de outro cliente.

             Coluna opcional é ANULADA: a linha entra sem aquele vínculo, que
             é o que ela teria num cliente novo. Coluna obrigatória vira
             recusa, porque a linha não existe sem ele. */
          if (ref.descartaLinha) {
            /* A linha não sobrevive sem a referência. Descartar é a saída
               honesta: anular produziria um registro que o banco recusa, ou
               um que ele aceita e que perdeu o significado. */
            descartar = ref.coluna;
            break;
          }

          if (ref.aceitaNulo) {
            nova[ref.coluna] = null;
            anuladas += 1;
            continue;
          }

          orfas.push({ tabela, coluna: ref.coluna, valor });
          continue;
        }

        nova[ref.coluna] = novo;
      }

      if (descartar) {
        descartadas.push({ tabela, coluna: descartar });
        continue;
      }

      mantidas.push(nova);
    }

    saida[tabela] = mantidas;
  }

  return { dados: saida, reemitidos: mapa.size, anuladas, descartadas, orfas };
}
