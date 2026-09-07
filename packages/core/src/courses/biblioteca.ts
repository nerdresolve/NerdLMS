/**
 * Biblioteca de conteúdos: procurar um documento entre muitos.
 *
 * Procedimento, norma interna, ficha de segurança. Documento que vale por si e
 * que ninguém acha navegando — se acha procurando, por assunto ou por palavra
 * do nome.
 *
 * Recebe a lista e devolve a lista filtrada. A consulta traz tudo do cliente e
 * o filtro acontece aqui, e não no SQL, por dois motivos: a biblioteca de uma
 * organização tem dezenas de documentos, não milhões, e filtrar na tela deixa a
 * resposta instantânea a cada tecla — sem uma viagem ao servidor por letra
 * digitada. O dia em que forem milhares, o filtro desce para a consulta e estes
 * testes continuam valendo.
 */

/** O que a extensão do arquivo diz que ele é. Vem da rota que registra. */
export type TipoDeConteudo = "pdf" | "spreadsheet" | "slides" | "document";

export const ROTULO_DO_TIPO: Record<TipoDeConteudo, string> = {
  pdf: "PDF",
  spreadsheet: "Planilha",
  slides: "Apresentação",
  document: "Documento",
};

export interface ItemDaBiblioteca {
  id: string;
  name: string;
  description: string | null;
  kind: TipoDeConteudo;
  sizeLabel: string;
  /** O tema, como a organização o nomeia. Nulo: sem tema. */
  tema: string | null;
}

export interface FiltroDaBiblioteca {
  /** Nome do tema, exatamente como veio na lista. Vazio: todos. */
  tema?: string | null;
  /** Vazio: todos os tipos. */
  tipo?: TipoDeConteudo | null;
  /** Texto livre, procurado no nome E na descrição. */
  busca?: string;
}

/**
 * Normaliza para procurar: sem acento, sem caixa, sem espaço sobrando.
 *
 * Quem digita "seguranca" precisa achar "Segurança". Exigir o acento faria a
 * busca falhar justamente para quem tem pressa — e é a mesma normalização que
 * o alvo da trilha usa, pelo mesmo motivo.
 */
export function chaveDeBusca(valor: string | null | undefined): string {
  if (typeof valor !== "string") return "";

  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Aplica os três filtros ao mesmo tempo.
 *
 * Cumulativos, e não alternativos: escolher "Segurança" e digitar "altura"
 * procura "altura" DENTRO de segurança. É o que se espera de uma barra de
 * filtros, e o contrário — cada filtro ampliando o resultado — não teria uso.
 *
 * Filtro vazio não filtra. Um tema `null` é "todos os temas", não "documentos
 * sem tema"; para esses últimos a tela oferece uma opção própria, porque o
 * campo vazio da barra precisa continuar significando "não estou filtrando".
 */
export function filtrarBiblioteca(
  itens: ItemDaBiblioteca[],
  filtro: FiltroDaBiblioteca = {},
): ItemDaBiblioteca[] {
  const busca = chaveDeBusca(filtro.busca);
  const tema = filtro.tema ?? null;

  return itens.filter((item) => {
    if (tema !== null && item.tema !== tema) return false;
    if (filtro.tipo && item.kind !== filtro.tipo) return false;

    if (busca === "") return true;

    /* Nome E descrição: "PO-034-rev7.pdf" não diz nada a ninguém, e é
       justamente na descrição que está a palavra que a pessoa lembra. */
    const alvo = `${chaveDeBusca(item.name)} ${chaveDeBusca(item.description)}`;
    return alvo.includes(busca);
  });
}

export interface TemaDaBiblioteca {
  nome: string;
  documentos: number;
}

/**
 * Os temas presentes na biblioteca, com quantos documentos cada um tem.
 *
 * Só os temas que TÊM documento. Uma barra de filtros que oferece "Meio
 * ambiente (0)" convida ao clique que não devolve nada, e a organização tem
 * categorias de curso que nenhum documento usa.
 *
 * Ordem alfabética, respeitando acento — é a ordem em que se procura numa
 * lista, e `localeCompare` com pt-BR põe "Água" antes de "Base".
 */
export function temasDaBiblioteca(itens: ItemDaBiblioteca[]): TemaDaBiblioteca[] {
  const contagem = new Map<string, number>();

  for (const item of itens) {
    if (item.tema === null) continue;
    contagem.set(item.tema, (contagem.get(item.tema) ?? 0) + 1);
  }

  return [...contagem]
    .map(([nome, documentos]) => ({ nome, documentos }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Quantos documentos estão sem tema, para a tela oferecer o filtro deles. */
export function semTema(itens: ItemDaBiblioteca[]): number {
  return itens.filter((item) => item.tema === null).length;
}
