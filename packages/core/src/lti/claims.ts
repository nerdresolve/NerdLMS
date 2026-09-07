/**
 * LTI 1.3 — as claims do launch — F6-04 (guia §27).
 *
 * O que o LTI resolve: uma ferramenta de fora abre DENTRO do curso já sabendo
 * quem é o aluno e em que contexto ele está, sem pedir login de novo. E, com o
 * LTI Advantage, devolve a nota (AGS), lê a lista da turma (NRPS) e escolhe o
 * conteúdo na hora de configurar (Deep Linking).
 *
 * Este arquivo é puro: monta e valida claims. A assinatura vive no backend,
 * onde há `node:crypto`.
 *
 * As claims usam IRIs longos porque é assim que o padrão define — encurtá-los
 * quebraria a interoperabilidade, que é o ponto inteiro do LTI.
 */

import { NOME_PADRAO } from "../tenancy/branding.ts";

const NS = "https://purl.imsglobal.org/spec/lti/claim";
const NS_AGS = "https://purl.imsglobal.org/spec/lti-ags/claim";
const NS_NRPS = "https://purl.imsglobal.org/spec/lti-nrps/claim";
const NS_DL = "https://purl.imsglobal.org/spec/lti-dl/claim";

/** Os papéis do padrão. */
export const LTI_ROLES = {
  learner: "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
  instructor: "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  admin: "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator",
  manager: "http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor",
} as const;

export type PlatformRole = "learner" | "instructor" | "manager" | "admin";

/**
 * Os papéis LTI de quem está fazendo o launch.
 *
 * Devolve ARRAY porque o padrão define assim: uma pessoa pode ser instrutor de
 * um curso e aluno de outro, e a ferramenta precisa dos dois para decidir o que
 * mostrar. O admin recebe também `Instructor` — sem isso, uma ferramenta que só
 * olha papel de curso trataria o administrador como visitante.
 */
export function ltiRolesOf(role: PlatformRole): string[] {
  switch (role) {
    case "admin":
      return [LTI_ROLES.admin, LTI_ROLES.instructor];
    case "instructor":
      return [LTI_ROLES.instructor];
    case "manager":
      return [LTI_ROLES.manager];
    default:
      return [LTI_ROLES.learner];
  }
}

export interface LaunchInput {
  /** Nossa URL — o `iss` que a ferramenta espera. */
  issuer: string;
  /** O identificador que demos à ferramenta. */
  clientId: string;
  /** O `sub`: quem está fazendo o launch, do ponto de vista da ferramenta. */
  userId: string;
  userName: string;
  userEmail: string | null;
  role: PlatformRole;

  /** O contexto: o curso. */
  contextId: string;
  contextTitle: string;

  /** O recurso: onde a ferramenta foi colocada. */
  linkId: string;
  linkTitle: string;
  targetLinkUri: string;

  deploymentId: string;
  nonce: string;

  /** AGS: para onde a ferramenta lança nota. Ausente quando não vale nota. */
  ags?: {
    lineitemUrl: string;
    scopes: string[];
  };

  /** NRPS: onde a ferramenta lê a lista da turma. */
  nrps?: { contextMembershipsUrl: string };

  /** Segundos de validade do token. Curto: o launch dura segundos. */
  expiresInSeconds?: number;
  now?: number;
}

/**
 * As claims de um launch de recurso — o `LtiResourceLinkRequest`.
 *
 * Os campos obrigatórios do padrão estão todos aqui. Faltar um faz a ferramenta
 * recusar o launch com uma mensagem que não diz qual — daí valer a pena montar
 * num lugar só, testado.
 */
export function resourceLinkClaims(input: LaunchInput): Record<string, unknown> {
  const agora = Math.floor((input.now ?? Date.now()) / 1000);

  return {
    iss: input.issuer,
    /* `aud` é o client_id da FERRAMENTA: é ela quem recebe e confere. */
    aud: input.clientId,
    sub: input.userId,
    iat: agora,
    exp: agora + (input.expiresInSeconds ?? 300),
    nonce: input.nonce,

    /* Perfil de quem faz o launch. O e-mail só entra quando existe — um campo
       vazio faria a ferramenta criar conta com endereço em branco. */
    name: input.userName,
    ...(input.userEmail ? { email: input.userEmail } : {}),

    [`${NS}/message_type`]: "LtiResourceLinkRequest",
    [`${NS}/version`]: "1.3.0",
    [`${NS}/deployment_id`]: input.deploymentId,
    [`${NS}/target_link_uri`]: input.targetLinkUri,

    [`${NS}/resource_link`]: {
      id: input.linkId,
      title: input.linkTitle,
    },

    [`${NS}/context`]: {
      id: input.contextId,
      label: input.contextTitle,
      title: input.contextTitle,
      type: ["http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering"],
    },

    [`${NS}/roles`]: ltiRolesOf(input.role),

    /* Quem é a plataforma. A ferramenta usa isto para mostrar de onde veio o
       launch e para distinguir instalações. */
    [`${NS}/tool_platform`]: {
      guid: input.issuer,
      name: NOME_PADRAO,
      product_family_code: "nerdlms",
      version: "1.0",
    },

    /* AGS e NRPS só entram quando a ferramenta tem permissão. Anunciar um
       serviço que a plataforma vai recusar faria a ferramenta falhar depois do
       launch, quando já parece que deu certo. */
    ...(input.ags
      ? {
          [`${NS_AGS}/endpoint`]: {
            scope: input.ags.scopes,
            lineitem: input.ags.lineitemUrl,
          },
        }
      : {}),

    ...(input.nrps
      ? {
          [`${NS_NRPS}/namesroleservice`]: {
            context_memberships_url: input.nrps.contextMembershipsUrl,
            service_versions: ["2.0"],
          },
        }
      : {}),
  };
}

export interface DeepLinkInput {
  issuer: string;
  clientId: string;
  userId: string;
  userName: string;
  role: PlatformRole;
  deploymentId: string;
  nonce: string;
  /** Para onde a ferramenta devolve o que foi escolhido. */
  returnUrl: string;
  contextId: string;
  contextTitle: string;
  expiresInSeconds?: number;
  now?: number;
}

/**
 * As claims de um Deep Linking — quando o instrutor vai ESCOLHER o conteúdo.
 *
 * É a diferença entre "abra a ferramenta" e "abra a ferramenta para eu
 * escolher qual exercício dela vai neste módulo". Sem Deep Linking, quem monta
 * o curso teria de copiar URLs à mão da ferramenta para cá.
 */
export function deepLinkClaims(input: DeepLinkInput): Record<string, unknown> {
  const agora = Math.floor((input.now ?? Date.now()) / 1000);

  return {
    iss: input.issuer,
    aud: input.clientId,
    sub: input.userId,
    iat: agora,
    exp: agora + (input.expiresInSeconds ?? 300),
    nonce: input.nonce,
    name: input.userName,

    [`${NS}/message_type`]: "LtiDeepLinkingRequest",
    [`${NS}/version`]: "1.3.0",
    [`${NS}/deployment_id`]: input.deploymentId,
    [`${NS}/roles`]: ltiRolesOf(input.role),

    [`${NS}/context`]: {
      id: input.contextId,
      label: input.contextTitle,
      title: input.contextTitle,
    },

    [`${NS_DL}/deep_linking_settings`]: {
      deep_link_return_url: input.returnUrl,
      /* O que aceitamos receber de volta. `ltiResourceLink` é o essencial:
         um item que vira um link no curso. */
      accept_types: ["ltiResourceLink"],
      accept_presentation_document_targets: ["iframe", "window"],
      accept_multiple: true,
      auto_create: false,
    },
  };
}

export type ClaimError =
  | "missing_iss"
  | "missing_sub"
  | "missing_nonce"
  | "wrong_audience"
  | "expired"
  | "not_yet_valid"
  | "wrong_message_type"
  | "missing_deployment";

/**
 * Confere as claims de um token que CHEGA — a resposta do Deep Linking.
 *
 * A ferramenta responde assinada, e conferir é o que impede alguém de forjar
 * "o instrutor escolheu este conteúdo". A assinatura é conferida no backend
 * contra o JWKS da ferramenta; aqui vão as regras que não dependem de cripto.
 *
 * A tolerância de relógio é de 60 segundos: servidores desalinhados são a
 * causa mais comum de launch recusado, e o padrão recomenda alguma folga.
 */
export function validateIncomingClaims(
  claims: Record<string, unknown>,
  esperado: { issuer: string; clientId: string; messageType?: string },
  now = Date.now(),
): { ok: true } | { ok: false; error: ClaimError } {
  const agora = Math.floor(now / 1000);
  const TOLERANCIA = 60;

  if (typeof claims.iss !== "string" || claims.iss === "") {
    return { ok: false, error: "missing_iss" };
  }

  if (typeof claims.sub !== "string" || claims.sub === "") {
    return { ok: false, error: "missing_sub" };
  }

  if (typeof claims.nonce !== "string" || claims.nonce === "") {
    return { ok: false, error: "missing_nonce" };
  }

  /* `aud` pode ser string ou array — o padrão permite os dois. */
  const audiencia = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiencia.includes(esperado.issuer)) {
    return { ok: false, error: "wrong_audience" };
  }

  if (typeof claims.exp === "number" && claims.exp + TOLERANCIA < agora) {
    return { ok: false, error: "expired" };
  }

  if (typeof claims.iat === "number" && claims.iat - TOLERANCIA > agora) {
    return { ok: false, error: "not_yet_valid" };
  }

  if (esperado.messageType) {
    const tipo = claims[`${NS}/message_type`];
    if (tipo !== esperado.messageType) {
      return { ok: false, error: "wrong_message_type" };
    }
  }

  if (typeof claims[`${NS}/deployment_id`] !== "string") {
    return { ok: false, error: "missing_deployment" };
  }

  return { ok: true };
}

export const CLAIM_MESSAGE: Record<ClaimError, string> = {
  missing_iss: "O token não diz quem o emitiu (`iss`).",
  missing_sub: "O token não diz de quem é (`sub`).",
  missing_nonce: "O token não tem `nonce`.",
  wrong_audience: "O token não foi emitido para esta plataforma.",
  expired: "O token expirou.",
  not_yet_valid: "O token foi emitido no futuro, confira o relógio do servidor.",
  wrong_message_type: "O tipo de mensagem não é o esperado para esta etapa.",
  missing_deployment: "O token não tem `deployment_id`.",
};

/** Os itens que o Deep Linking devolveu, filtrados pelos que sabemos usar. */
export interface DeepLinkItem {
  type: string;
  title: string;
  url: string;
  /** Nota máxima, quando o item vale nota. */
  lineItemScoreMaximum: number | null;
}

export function parseDeepLinkItems(claims: Record<string, unknown>): DeepLinkItem[] {
  const bruto = claims[`${NS_DL}/content_items`];
  if (!Array.isArray(bruto)) return [];

  const itens: DeepLinkItem[] = [];

  for (const item of bruto) {
    if (typeof item !== "object" || item === null) continue;

    const dados = item as Record<string, unknown>;

    /* Só `ltiResourceLink`: é o que declaramos aceitar em `accept_types`, e
       aceitar mais do que se anunciou surpreenderia quem monta o curso com um
       tipo de item que a tela não sabe mostrar. */
    if (dados.type !== "ltiResourceLink") continue;
    if (typeof dados.url !== "string" || !/^https:\/\//.test(dados.url)) continue;

    const lineItem = dados.lineItem as { scoreMaximum?: unknown } | undefined;

    itens.push({
      type: "ltiResourceLink",
      title: typeof dados.title === "string" && dados.title !== "" ? dados.title : "Atividade",
      url: dados.url,
      lineItemScoreMaximum:
        typeof lineItem?.scoreMaximum === "number" && lineItem.scoreMaximum > 0
          ? lineItem.scoreMaximum
          : null,
    });
  }

  return itens;
}

/** Os escopos do AGS que a plataforma concede. */
export const AGS_SCOPES = [
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
  "https://purl.imsglobal.org/spec/lti-ags/scope/score",
] as const;

export const NRPS_SCOPE =
  "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";

/**
 * A nota que a ferramenta lança, convertida para o que o livro de notas usa.
 *
 * O AGS manda `scoreGiven` e `scoreMaximum`. O nosso `grade_entries` guarda
 * `points_earned` e `points_possible` — os mesmos dois números, com outro nome.
 *
 * `activityProgress` e `gradingProgress` NÃO são nota: dizem em que ponto a
 * atividade está. Uma nota com `gradingProgress: "PendingManual"` é parcial, e
 * lançá-la como final colocaria no livro um número que ainda vai mudar.
 */
export function isFinalScore(gradingProgress: unknown): boolean {
  return gradingProgress === "FullyGraded";
}
