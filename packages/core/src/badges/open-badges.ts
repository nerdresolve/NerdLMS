/**
 * Open Badges 2.0 — F6-01 (guia §19).
 *
 * O que o padrão resolve: um badge que só a plataforma que o emitiu entende não
 * serve para nada fora dela. Quem recebe quer colocá-lo no LinkedIn, num
 * currículo, num "badge backpack" — e quem lê precisa conseguir conferir a
 * origem sem confiar na nossa palavra.
 *
 * **Open Badges 2.0, e não 3.0.** A 3.0 é Verifiable Credentials: exige par de
 * chaves, assinatura de documento JSON-LD e um modelo de confiança inteiro.
 * A 2.0 com verificação hospedada (`HostedBadge`) resolve o mesmo problema para
 * um LMS corporativo — o verificador busca a URL no nosso domínio, e é o
 * domínio que responde pela autenticidade. Assinar sem ter onde guardar chave
 * com segurança seria pior que não assinar.
 *
 * Três documentos, cada um numa URL própria, como o padrão exige:
 *
 *   Assertion  — "esta pessoa ganhou este badge nesta data"
 *   BadgeClass — "o que este badge significa"
 *   Issuer     — "quem emite"
 */

const CONTEXTO = "https://w3id.org/openbadges/v2";

export interface IssuerInput {
  /** URL base da plataforma, sem barra no fim. */
  baseUrl: string;
  tenantName: string;
  /** E-mail de contato do cliente. */
  email: string | null;
}

/** O emissor: quem responde pelo badge. */
export function openBadgeIssuer(input: IssuerInput): Record<string, unknown> {
  return {
    "@context": CONTEXTO,
    type: "Issuer",
    id: `${input.baseUrl}/api/badges/issuer`,
    name: input.tenantName,
    url: input.baseUrl,
    ...(input.email ? { email: input.email } : {}),
  };
}

export interface BadgeClassInput {
  baseUrl: string;
  badgeId: string;
  name: string;
  description: string;
  /** Texto do critério, em linguagem de gente. */
  criteriaText: string;
}

/** O badge em si: o que ele significa e como se ganha. */
export function openBadgeClass(input: BadgeClassInput): Record<string, unknown> {
  return {
    "@context": CONTEXTO,
    type: "BadgeClass",
    id: `${input.baseUrl}/api/badges/${input.badgeId}`,
    name: input.name,
    description: input.description,
    /* A imagem é exigida pelo padrão. A plataforma gera um SVG a partir do
       ícone e da cor da marca — sem isto, o badge não renderiza em nenhum
       leitor externo. */
    image: `${input.baseUrl}/api/badges/${input.badgeId}/imagem.svg`,
    criteria: {
      type: "Criteria",
      narrative: input.criteriaText,
    },
    issuer: `${input.baseUrl}/api/badges/issuer`,
  };
}

export interface AssertionInput {
  baseUrl: string;
  code: string;
  badgeId: string;
  /** E-mail de quem recebeu. */
  recipientEmail: string;
  /** Sal para o hash do e-mail. */
  salt: string;
  awardedAt: string;
  expiresAt: string | null;
  revoked: boolean;
  revokedReason?: string | null;
}

/**
 * A emissão: esta pessoa, este badge, esta data.
 *
 * O E-MAIL VAI COMO HASH, não em texto.
 *
 * A assertion é um documento PÚBLICO — é o que o verificador busca. Publicar o
 * e-mail em texto transformaria cada badge compartilhado num endereço exposto a
 * quem coletar. O padrão prevê `IdentityObject` com `hashed: true` justamente
 * para isso: quem já sabe o e-mail confere o hash; quem não sabe, não descobre.
 *
 * O sal é por emissão e vai no documento — é assim que o padrão define, e é o
 * que permite conferir. Sem sal, um hash de e-mail é quebrável por dicionário
 * em segundos.
 */
export function openBadgeAssertion(
  input: AssertionInput,
  hashEmail: (email: string, salt: string) => string,
): Record<string, unknown> {
  return {
    "@context": CONTEXTO,
    type: "Assertion",
    id: `${input.baseUrl}/api/badges/emissao/${input.code}`,
    recipient: {
      type: "email",
      hashed: true,
      salt: input.salt,
      identity: hashEmail(input.recipientEmail, input.salt),
    },
    badge: `${input.baseUrl}/api/badges/${input.badgeId}`,
    issuedOn: input.awardedAt,
    ...(input.expiresAt ? { expires: input.expiresAt } : {}),
    verification: {
      /* Verificação HOSPEDADA: o verificador busca a `id` acima no nosso
         domínio e compara. Quem responde pela autenticidade é o domínio. */
      type: "HostedBadge",
    },
    /* O padrão pede que a assertion revogada continue acessível e se declare
       revogada. Sumir com ela faria o verificador ver "não encontrado", que é
       indistinguível de erro nosso. */
    ...(input.revoked
      ? { revoked: true, revocationReason: input.revokedReason ?? "Revogado pelo emissor." }
      : {}),
  };
}

/** O texto do critério, para o documento público e para a tela. */
export function criteriaNarrative(
  criterion: string,
  contexto: { courseName?: string | null; trackName?: string | null; threshold?: number | null },
): string {
  switch (criterion) {
    case "course_completed":
      return `Concluir o curso ${contexto.courseName ?? "indicado"}.`;

    case "track_completed":
      return `Concluir a trilha ${contexto.trackName ?? "indicada"}.`;

    case "courses_count":
      return `Concluir ${contexto.threshold ?? 0} cursos.`;

    case "lessons_count":
      return `Concluir ${contexto.threshold ?? 0} aulas.`;

    case "grade_above":
      return `Obter nota ${contexto.threshold ?? 0}% ou mais em ${contexto.courseName ?? "um curso"}.`;

    default:
      return "Concedido pela equipe responsável pelo treinamento.";
  }
}

/**
 * A imagem do badge, em SVG.
 *
 * Gerada, e não carregada: o padrão exige uma imagem, e pedir upload por badge
 * traria storage, formato e moderação para um problema que um desenho
 * paramétrico resolve. Também garante que o badge sempre TEM imagem — um
 * `image` quebrado invalida o documento em qualquer leitor.
 *
 * O texto vai no `<title>`: um leitor de tela precisa saber que badge é este, e
 * um SVG sem título é uma figura muda.
 */
export function badgeSvg(nome: string, cor: string, inicial: string): string {
  const seguro = (texto: string) =>
    texto.replace(/[&<>"']/g, (char) => {
      const mapa: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return mapa[char]!;
    });

  /* A cor vem da marca do cliente e é conferida antes de entrar: qualquer coisa
     que não seja um hex vira a cor padrão, para não injetar atributo no SVG. */
  const corSegura = /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#0A33CC";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-labelledby="t">
  <title id="t">${seguro(nome)}</title>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${corSegura}"/>
      <stop offset="100%" stop-color="${corSegura}" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="92" fill="url(#g)"/>
  <circle cx="100" cy="100" r="92" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4"/>
  <circle cx="100" cy="100" r="74" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
  <text x="100" y="100" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="72" font-weight="700" fill="#ffffff">${seguro(inicial.slice(0, 2).toUpperCase())}</text>
</svg>`;
}
