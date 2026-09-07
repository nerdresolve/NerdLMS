/**
 * Slug de curso — o pedaço legível da URL.
 *
 * "Segurança em Operações de Campo" vira `seguranca-em-operacoes-de-campo`.
 * A URL é o que a pessoa copia e manda para um colega, então precisa
 * sobreviver a e-mail, WhatsApp e barra de endereço sem virar `%C3%A7`.
 *
 * Não é identificador: o curso é achado pelo `id`. O slug pode mudar se o
 * título mudar, e é por isso que ele não carrega significado além do humano.
 */

const MAX_LENGTH = 80;

/**
 * Converte um título em slug.
 *
 * Devolve string vazia quando não sobra nada — um título só de emoji ou de
 * pontuação não tem forma legível em ASCII, e quem chama decide o que fazer
 * (aqui, cair para um identificador genérico).
 */
export function slugify(title: string): string {
  return (
    title
      .normalize("NFD")
      /* Remove os acentos separados pelo NFD, não os caracteres em si:
         "ção" vira "cao", e não "c". */
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      /* Tudo que não é letra ASCII ou dígito vira hífen. Cirílico, grego e
         emoji caem aqui: a fonte da URL não os representa de forma estável. */
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_LENGTH)
      /* O corte pode deixar um hífen na ponta. */
      .replace(/-+$/g, "")
  );
}

/**
 * Garante que o slug não colida com um já existente.
 *
 * Dois cursos podem ter o mesmo título — "Integração" de projetos diferentes,
 * por exemplo — e a coluna é única. O sufixo numérico resolve sem impedir a
 * criação: barrar o segundo curso por causa do nome seria transformar um
 * detalhe de URL em regra de negócio.
 *
 * @param existentes slugs já usados. Quem chama consulta o banco.
 */
export function uniqueSlug(title: string, existentes: Iterable<string>): string {
  const usados = new Set(existentes);
  const base = slugify(title) || "curso";

  if (!usados.has(base)) return base;

  /* Começa em 2 porque o primeiro já é o sem sufixo: `curso`, `curso-2`,
     `curso-3`. Um `-1` implicaria que existe um `-0`. */
  for (let n = 2; n < 1000; n += 1) {
    const candidato = `${base}-${n}`;
    if (!usados.has(candidato)) return candidato;
  }

  /* Mil cursos com o mesmo título é cenário artificial, mas devolver algo
     colidido seria pior que devolver algo feio. */
  return `${base}-${Date.now()}`;
}
