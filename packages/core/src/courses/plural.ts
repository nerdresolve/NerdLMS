/**
 * Concordância de número em rótulo curto.
 *
 * As telas escreviam `{n} aulas` direto, e um curso de uma aula exibia
 * "1 aulas". Some quando o texto vier de i18n com regra de plural própria.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
