/**
 * Teto de tamanho para campo de texto vindo de fora.
 *
 * POR QUE ISTO PRECISA EXISTIR
 *
 * `validation/login.ts` já dizia a regra para o identificador — "limite
 * superior obrigatório: entradas muito longas viram custo de CPU e são um vetor
 * de DoS barato" — e a regra valia só ali. Todo outro campo de texto do sistema
 * era lido como `typeof x === "string" ? x.trim() : ""`, com piso e sem teto.
 *
 * O `maxLength` do formulário não é defesa: ele existe para a pessoa não digitar
 * demais, e some no instante em que alguém chama a rota direto. Um nome de
 * assunto com 1 MB atravessava a validação inteira e só era recusado lá no
 * índice único do Postgres, que não indexa chave acima de ~2704 bytes — e o erro
 * subia pelo pool como **500**. Requisição malformada é erro de quem chama, e o
 * projeto já escreveu isso em `request-body.ts`.
 *
 * RECUSAR, E NÃO CORTAR
 *
 * Cortar em silêncio guardaria metade de um texto e diria que deu certo. Quem
 * escreveu 300 caracteres num campo de 200 precisa saber que 100 não foram
 * salvos; descobrir isso relendo o registro meses depois é pior do que o erro.
 */

/** Nome, título, rótulo — o que cabe numa linha da tela. */
export const LIMITE_DE_NOME = 200;

/** Resumo, descrição, observação — o que cabe num parágrafo. */
export const LIMITE_DE_TEXTO = 4000;

/** Caminho de objeto no armazenamento. Gerado por nós, nunca digitado. */
export const LIMITE_DE_CHAVE = 512;

/**
 * O texto pronto para uso, ou `null` quando não serve.
 *
 * `null` cobre os dois casos de uma vez — não é texto, ou passa do teto — de
 * propósito: quem chama já tinha um piso (`length < 3`) e uma mensagem de erro
 * própria, e o `?? ""` faz o valor grande demais cair exatamente nela. Uma
 * mensagem por motivo obrigaria a reescrever nove validações que hoje estão
 * certas; a que existe só precisa dizer também qual é o teto.
 */
export function textoDeEntrada(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;

  /* O teto vale sobre o texto CRU. Aparar antes deixaria passar um corpo de
     1 MB de espaço em branco, que é o mesmo custo de rede e de parse. */
  if (valor.length > limite) return null;

  return valor.trim();
}
