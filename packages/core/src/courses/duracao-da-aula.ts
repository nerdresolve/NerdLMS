/**
 * Quanto uma aula pode durar.
 *
 * POR QUE EXISTE UM TETO
 *
 * Vídeo longo não é assistido: a pessoa começa, perde o fio, sai e volta do
 * começo. Quinze minutos é o corte que a área de treinamento definiu, e ele
 * também melhora o registro — uma aula de uma hora que a pessoa abandonou aos
 * cinquenta minutos aparece como não concluída, enquanto quatro aulas de quinze
 * mostram exatamente onde ela parou.
 *
 * O teto vale para VÍDEO. Documento e conteúdo interativo não têm duração
 * fixa, e aplicar o mesmo limite a eles não significaria nada.
 */

/** O teto, em segundos. */
export const MAXIMO_DA_AULA_SEGUNDOS = 15 * 60;

/**
 * Folga antes de recusar.
 *
 * Um vídeo de 15min02s é 15 minutos para quem gravou, e recusá-lo por dois
 * segundos seria pedantismo que a pessoa não tem como resolver sem reeditar. A
 * folga é curta o bastante para não abrir caminho a vídeos de vinte minutos.
 */
const TOLERANCIA_SEGUNDOS = 30;

export type VeredictoDaDuracao =
  | { aceita: true }
  | { aceita: false; excedeuSegundos: number; mensagem: string };

/** Minutos e segundos, para a mensagem dizer o tamanho real do arquivo. */
function relogio(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = Math.round(segundos % 60);
  return `${minutos}min${String(resto).padStart(2, "0")}`;
}

/**
 * O vídeo cabe numa aula?
 *
 * Duração desconhecida PASSA. O navegador nem sempre consegue ler os metadados
 * antes do envio, e recusar por isso trancaria quem não tem culpa. A conferência
 * é uma ajuda a quem monta o curso, e não uma barreira de segurança: nada aqui
 * protege contra quem chama a API direto.
 */
export function cabeNumaAula(duracaoSegundos: number | null): VeredictoDaDuracao {
  if (duracaoSegundos === null || !Number.isFinite(duracaoSegundos) || duracaoSegundos <= 0) {
    return { aceita: true };
  }

  const limite = MAXIMO_DA_AULA_SEGUNDOS + TOLERANCIA_SEGUNDOS;
  if (duracaoSegundos <= limite) return { aceita: true };

  const excedeu = Math.round(duracaoSegundos - MAXIMO_DA_AULA_SEGUNDOS);

  return {
    aceita: false,
    excedeuSegundos: excedeu,
    mensagem:
      `Este vídeo tem ${relogio(duracaoSegundos)}, e o limite por aula é de 15 minutos. ` +
      `Divida o conteúdo em aulas menores: além de facilitar assistir, o progresso ` +
      `passa a mostrar exatamente onde a pessoa parou.`,
  };
}

/**
 * Em quantas aulas um vídeo longo precisaria ser dividido.
 *
 * Serve para a mensagem sugerir um número em vez de deixar a conta para quem
 * está subindo o arquivo.
 */
export function aulasNecessarias(duracaoSegundos: number): number {
  if (!Number.isFinite(duracaoSegundos) || duracaoSegundos <= 0) return 1;
  return Math.max(1, Math.ceil(duracaoSegundos / MAXIMO_DA_AULA_SEGUNDOS));
}
